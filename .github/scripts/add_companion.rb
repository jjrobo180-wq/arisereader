#!/usr/bin/env ruby
# Adds an Apple Watch or Apple TV app to a generated Capacitor project (the Arise apps' companions:
# native/duo-watch, native/fit-watch, native/notes-watch, native/duo-tv, native/fit-tv).
#
#   ruby add_companion.rb <App.xcodeproj> --kind watch|tv --name DuoWatch --display "Arise Duo"
#        --host com.arisereader.arisetodo [--bundle <id>] --sources a.swift,b.swift [--resources x.json]
#        [--icon icon-1024.png] [--embed] [--healthkit] [--mic]
#
#   watch  watchOS 10+, bundle id <host>.watchkitapp unless --bundle; --embed puts it inside the iPhone
#          app (how a watch app ships). --healthkit adds Health (workouts) with its permission sentences.
#          --mic adds the microphone (recording meetings) and background audio, so it keeps recording with
#          the screen off.
#   tv     tvOS 17+, the same bundle id as the iPhone app unless --bundle (one App Store listing). Its icon
#          and Top Shelf come from native/tv-app/make_tv_assets.py --icon (run here when Pillow is there,
#          otherwise a plain icon set is written so the build still works).
# Signing (Release): SIGN_TEAM and COMPANION_PROFILE (a provisioning profile name) in the environment.
# A scheme named after the target is saved, so `xcodebuild -scheme <name>` builds or archives it.
require "xcodeproj"
require "fileutils"
require "optparse"

opts = { sources: [], resources: [] }
project_path = ARGV.shift or abort "usage: add_companion.rb <App.xcodeproj> --kind watch|tv ..."
OptionParser.new do |o|
  o.on("--kind KIND") { |v| opts[:kind] = v }
  o.on("--name NAME") { |v| opts[:name] = v }
  o.on("--display NAME") { |v| opts[:display] = v }
  o.on("--host ID") { |v| opts[:host] = v }
  o.on("--bundle ID") { |v| opts[:bundle] = v }
  o.on("--sources LIST") { |v| opts[:sources] = v.split(",") }
  o.on("--resources LIST") { |v| opts[:resources] = v.split(",") }
  o.on("--icon PATH") { |v| opts[:icon] = v }
  o.on("--tv-assets DIR") { |v| opts[:tv_assets] = v }
  o.on("--embed") { opts[:embed] = true }
  o.on("--healthkit") { opts[:healthkit] = true }
  o.on("--mic") { opts[:mic] = true }
end.parse!(ARGV)
%i[kind name display host].each { |k| abort "--#{k} is needed" unless opts[k] }
watch = opts[:kind] == "watch"
root = File.expand_path("../..", __dir__)
abs = ->(p) { File.expand_path(p, root) }
name = opts[:name]
bundle = opts[:bundle] || (watch ? "#{opts[:host]}.watchkitapp" : opts[:host])
ios_dir = File.dirname(project_path)
dir = File.join(ios_dir, name)

proj = Xcodeproj::Project.open(project_path)
app = proj.targets.find { |t| t.name == "App" } or abort "no App target"
abort "#{name} is already in the project" if proj.targets.any? { |t| t.name == name }
app_cfg = app.build_configurations.first.build_settings
version = app_cfg["MARKETING_VERSION"] || "1.0"
build = ENV["BUILD_NUMBER"] || app_cfg["CURRENT_PROJECT_VERSION"] || "1"

def plist_value(v)
  case v
  when true then "<true/>"
  when false then "<false/>"
  when Hash then "<dict>" + v.map { |k, x| "<key>#{k}</key>#{plist_value(x)}" }.join + "</dict>"
  when Array then "<array>" + v.map { |x| plist_value(x) }.join + "</array>"
  else "<string>#{v.to_s.gsub('&', '&amp;').gsub('<', '&lt;')}</string>"
  end
end

def write_plist(path, entries)
  body = entries.map { |k, v| "  <key>#{k}</key>#{plist_value(v)}" }.join("\n")
  File.write(path, %(<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n#{body}\n</dict></plist>\n))
end

FileUtils.mkdir_p(dir)
files = (opts[:sources] + opts[:resources]).map { |s| FileUtils.cp(abs.(s), dir); File.basename(s) }

# Icons
assets = File.join(dir, "Assets.xcassets")
FileUtils.rm_rf(assets)
icon = opts[:icon] && abs.(opts[:icon])
if watch
  set = File.join(assets, "AppIcon.appiconset")
  FileUtils.mkdir_p(set)
  File.write(File.join(assets, "Contents.json"), '{"info":{"author":"xcode","version":1}}')
  if icon && File.exist?(icon)
    FileUtils.cp(icon, File.join(set, "AppIcon-1024.png"))
    File.write(File.join(set, "Contents.json"), '{"images":[{"filename":"AppIcon-1024.png","idiom":"universal","platform":"watchos","size":"1024x1024"}],"info":{"author":"xcode","version":1}}')
  else
    File.write(File.join(set, "Contents.json"), '{"images":[],"info":{"author":"xcode","version":1}}')
  end
else
  src = opts[:tv_assets] && abs.(opts[:tv_assets])
  abort "--tv-assets #{src} is missing (make it with native/tv-app/make_tv_assets.py)" unless src && File.directory?(src)
  FileUtils.cp_r(src, assets)
end

info = {
  "CFBundleDevelopmentRegion" => "$(DEVELOPMENT_LANGUAGE)",
  "CFBundleDisplayName" => opts[:display],
  "CFBundleExecutable" => "$(EXECUTABLE_NAME)",
  "CFBundleIdentifier" => "$(PRODUCT_BUNDLE_IDENTIFIER)",
  "CFBundleInfoDictionaryVersion" => "6.0",
  "CFBundleName" => "$(PRODUCT_NAME)",
  "CFBundlePackageType" => "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
  "CFBundleShortVersionString" => "$(MARKETING_VERSION)",
  "CFBundleVersion" => "$(CURRENT_PROJECT_VERSION)",
  "ITSAppUsesNonExemptEncryption" => false,
}
if watch
  info["WKApplication"] = true
  info["WKCompanionAppBundleIdentifier"] = opts[:host]
  if opts[:healthkit]
    info["NSHealthShareUsageDescription"] = "#{opts[:display]} reads your heart rate and calories during a workout to show them on your watch."
    info["NSHealthUpdateUsageDescription"] = "#{opts[:display]} saves workouts you track on your watch to Apple Health."
    info["WKBackgroundModes"] = ["workout-processing"]
  end
  if opts[:mic]
    info["NSMicrophoneUsageDescription"] = "#{opts[:display]} records your meetings so your iPhone can write them down and summarize them."
    # Recording with the screen off: UIBackgroundModes "audio" (App Store Connect rejects "audio" in WKBackgroundModes).
    info["UIBackgroundModes"] = ["audio"]
  end
else
  info["UILaunchScreen"] = {}
  info["UIRequiredDeviceCapabilities"] = ["arm64"]
end
write_plist(File.join(dir, "Info.plist"), info)
if opts[:healthkit]
  write_plist(File.join(dir, "#{name}.entitlements"), { "com.apple.developer.healthkit" => true, "com.apple.developer.healthkit.access" => [] })
end

platform = watch ? :watchos : :tvos
target = proj.new_target(:application, name, platform, watch ? "10.0" : "17.0")
group = proj.main_group.new_group(name, name)
swift = files.select { |f| f.end_with?(".swift") }
other = files.reject { |f| f.end_with?(".swift") }
target.add_file_references(swift.map { |f| group.new_file(f) })
other.each { |f| target.resources_build_phase.add_file_reference(group.new_file(f)) }
target.resources_build_phase.add_file_reference(group.new_file("Assets.xcassets"))
group.new_file("Info.plist")
group.new_file("#{name}.entitlements") if opts[:healthkit]

target.build_configurations.each do |c|
  s = c.build_settings
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["PRODUCT_BUNDLE_IDENTIFIER"] = bundle
  s["INFOPLIST_FILE"] = "#{name}/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["SWIFT_VERSION"] = "5.0"
  s["MARKETING_VERSION"] = version
  s["CURRENT_PROJECT_VERSION"] = build
  s["ENABLE_PREVIEWS"] = "NO"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks"]
  if watch
    s["SDKROOT"] = "watchos"
    s["TARGETED_DEVICE_FAMILY"] = "4"
    s["WATCHOS_DEPLOYMENT_TARGET"] = "10.0"
    s["SKIP_INSTALL"] = "YES"
    s["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon"
  else
    s["SDKROOT"] = "appletvos"
    s["TARGETED_DEVICE_FAMILY"] = "3"
    s["TVOS_DEPLOYMENT_TARGET"] = "17.0"
    s["ASSETCATALOG_COMPILER_APPICON_NAME"] = "App Icon & Top Shelf Image"
  end
  s["CODE_SIGN_ENTITLEMENTS"] = "#{name}/#{name}.entitlements" if opts[:healthkit]
  if c.name == "Release" && ENV["SIGN_TEAM"] && ENV["COMPANION_PROFILE"] && !ENV["COMPANION_PROFILE"].empty?
    s["CODE_SIGN_STYLE"] = "Manual"
    s["DEVELOPMENT_TEAM"] = ENV["SIGN_TEAM"]
    s["CODE_SIGN_IDENTITY"] = "Apple Distribution"
    s["PROVISIONING_PROFILE_SPECIFIER"] = ENV["COMPANION_PROFILE"]
  end
end

if watch && opts[:embed]
  app.add_dependency(target)
  phase = app.copy_files_build_phases.find { |p| p.name == "Embed Watch Content" } || app.new_copy_files_build_phase("Embed Watch Content")
  phase.dst_subfolder_spec = "16"
  phase.dst_path = "$(CONTENTS_FOLDER_PATH)/Watch"
  phase.add_file_reference(target.product_reference, true).settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

proj.save
scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(target, nil)
scheme.save_as(project_path, name, true)
puts "Added #{name} (#{watch ? 'Apple Watch' : 'Apple TV'}, #{bundle}#{opts[:embed] ? ', inside the iPhone app' : ''})"
