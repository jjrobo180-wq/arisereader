#!/usr/bin/env ruby
# Adds Pod+ for Apple Watch (native/watch-app) and Pod+ for Apple TV (native/tv-app) to the generated
# Capacitor project, both built from the same native core as CarPlay (native/arise-carplay: PodCore,
# PodEngine, PodLink).
#
#   ruby add_watch_tv.rb <App.xcodeproj> [--embed-watch]
#
#   PodPlusWatch  watchOS 10+, bundle id com.arisereader.podplus.watchkitapp, companion of the iPhone app.
#                 --embed-watch puts it inside the iPhone app (how a watch app ships); without it the
#                 watch app is only built on its own (the simulator check builds it separately).
#   PodPlusTV     tvOS 16+, bundle id com.arisereader.podplus (the same app on the App Store: one purchase,
#                 one listing, with a TV build alongside the iPhone one).
# Run after `npx cap add ios && npx cap sync ios`. A simulator build needs nothing from Apple; a signed
# build needs App IDs and provisioning profiles for both (see podscroll/ios-app/README.md).
require "xcodeproj"
require "fileutils"

project_path = ARGV[0] or abort "usage: add_watch_tv.rb <App.xcodeproj> [--embed-watch]"
embed_watch = ARGV.include?("--embed-watch")
host = "com.arisereader.podplus"
root = File.expand_path("../..", __dir__)
ios_dir = File.dirname(project_path)
core = File.join(root, "native/arise-carplay/ios/Sources/AriseCarPlayPlugin")
icon = File.join(root, "client/public/app-icons/podplus-1024.png")

proj = Xcodeproj::Project.open(project_path)
app = proj.targets.find { |t| t.name == "App" } or abort "no App target"
abort "Pod+ Watch and TV are already in the project" if proj.targets.any? { |t| t.name == "PodPlusWatch" || t.name == "PodPlusTV" }
app_cfg = app.build_configurations.first.build_settings
version = app_cfg["MARKETING_VERSION"] || "1.0"
build = ENV["BUILD_NUMBER"] || app_cfg["CURRENT_PROJECT_VERSION"] || "1"

def plist(path, entries)
  body = entries.map do |k, v|
    val = case v
          when true then "<true/>"
          when false then "<false/>"
          when Array then "<array>" + v.map { |x| "<string>#{x}</string>" }.join + "</array>"
          else "<string>#{v}</string>"
          end
    "    <key>#{k}</key>#{val}"
  end.join("\n")
  File.write(path, %(<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n#{body}\n</dict></plist>\n))
end

def icon_set(dir, platform, icon)
  set = File.join(dir, "Assets.xcassets", "AppIcon.appiconset")
  FileUtils.mkdir_p(set)
  File.write(File.join(dir, "Assets.xcassets", "Contents.json"), '{"info":{"author":"xcode","version":1}}')
  if File.exist?(icon)
    FileUtils.cp(icon, File.join(set, "AppIcon-1024.png"))
    File.write(File.join(set, "Contents.json"), %({"images":[{"filename":"AppIcon-1024.png","idiom":"universal","platform":"#{platform}","size":"1024x1024"}],"info":{"author":"xcode","version":1}}))
  else
    File.write(File.join(set, "Contents.json"), '{"images":[],"info":{"author":"xcode","version":1}}')
  end
end

# Copies the native core and the app's own files next to the project and adds a target for them.
add = lambda do |name, platform, deployment, sources, info, settings|
  dir = File.join(ios_dir, name)
  FileUtils.mkdir_p(dir)
  files = sources.map { |src| FileUtils.cp(src, dir); File.basename(src) }
  plist(File.join(dir, "Info.plist"), info)
  if platform == :watchos
    icon_set(dir, "watchos", icon)
  else
    FileUtils.rm_rf(File.join(dir, "Assets.xcassets"))
    FileUtils.cp_r(File.join(root, "native/tv-app/Assets.xcassets"), dir)
  end
  target = proj.new_target(:application, name, platform, deployment)
  group = proj.main_group.new_group(name, name)
  refs = files.map { |f| group.new_file(f) }
  group.new_file("Info.plist")
  target.add_file_references(refs)
  assets = group.new_file("Assets.xcassets")
  target.resources_build_phase.add_file_reference(assets)
  target.build_configurations.each do |c|
    s = c.build_settings
    s["PRODUCT_NAME"] = "$(TARGET_NAME)"
    s["INFOPLIST_FILE"] = "#{name}/Info.plist"
    s["GENERATE_INFOPLIST_FILE"] = "NO"
    s["SWIFT_VERSION"] = "5.0"
    s["MARKETING_VERSION"] = version
    s["CURRENT_PROJECT_VERSION"] = build
    s["ENABLE_PREVIEWS"] = "NO"
    s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks"]
    settings.each { |k, v| s[k] = v }
  end
  target
end

common = lambda do |display|
  {
    "CFBundleDevelopmentRegion" => "$(DEVELOPMENT_LANGUAGE)",
    "CFBundleDisplayName" => display,
    "CFBundleExecutable" => "$(EXECUTABLE_NAME)",
    "CFBundleIdentifier" => "$(PRODUCT_BUNDLE_IDENTIFIER)",
    "CFBundleInfoDictionaryVersion" => "6.0",
    "CFBundleName" => "$(PRODUCT_NAME)",
    "CFBundlePackageType" => "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
    "CFBundleShortVersionString" => "$(MARKETING_VERSION)",
    "CFBundleVersion" => "$(CURRENT_PROJECT_VERSION)",
    "ITSAppUsesNonExemptEncryption" => false,
  }
end

core_files = %w[PodCore.swift PodEngine.swift PodLink.swift].map { |f| File.join(core, f) }

# --- Apple Watch ---
watch = add.call("PodPlusWatch", :watchos, "10.0",
  core_files + [File.join(root, "native/watch-app/PodWatchApp.swift")],
  common.call("Pod+").merge(
    "WKApplication" => true,
    "WKCompanionAppBundleIdentifier" => host,
    "UIBackgroundModes" => ["audio"],
  ),
  {
    "PRODUCT_BUNDLE_IDENTIFIER" => "#{host}.watchkitapp",
    "SDKROOT" => "watchos",
    "TARGETED_DEVICE_FAMILY" => "4",
    "WATCHOS_DEPLOYMENT_TARGET" => "10.0",
    "SKIP_INSTALL" => "YES",
    "ASSETCATALOG_COMPILER_APPICON_NAME" => "AppIcon",
  })

# --- Apple TV ---
tv = add.call("PodPlusTV", :tvos, "16.0",
  core_files.reject { |f| f.end_with?("PodLink.swift") } + [File.join(root, "native/tv-app/PodTVApp.swift")],
  common.call("Pod+").merge(
    "UIBackgroundModes" => ["audio"],
    "UILaunchScreen" => "",
    "UIRequiredDeviceCapabilities" => ["arm64"],
  ),
  {
    "PRODUCT_BUNDLE_IDENTIFIER" => host,
    "SDKROOT" => "appletvos",
    "TARGETED_DEVICE_FAMILY" => "3",
    "TVOS_DEPLOYMENT_TARGET" => "16.0",
    "ASSETCATALOG_COMPILER_APPICON_NAME" => "App Icon & Top Shelf Image",
  })
# UILaunchScreen is a dictionary (an empty one: the system's plain launch screen).
tv_plist = File.join(ios_dir, "PodPlusTV", "Info.plist")
File.write(tv_plist, File.read(tv_plist).sub("<key>UILaunchScreen</key><string></string>", "<key>UILaunchScreen</key><dict/>"))

if embed_watch
  app.add_dependency(watch)
  phase = app.new_copy_files_build_phase("Embed Watch Content")
  phase.dst_subfolder_spec = "16"
  phase.dst_path = "$(CONTENTS_FOLDER_PATH)/Watch"
  bf = phase.add_file_reference(watch.product_reference, true)
  bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
end

if ENV["SIGN_TEAM"]
  [[watch, ENV["WATCH_PROFILE"]], [tv, ENV["TV_PROFILE"]]].each do |target, profile|
    next unless profile && !profile.empty?
    target.build_configurations.each do |c|
      next unless c.name == "Release"
      c.build_settings["CODE_SIGN_STYLE"] = "Manual"
      c.build_settings["DEVELOPMENT_TEAM"] = ENV["SIGN_TEAM"]
      c.build_settings["CODE_SIGN_IDENTITY"] = "Apple Distribution"
      c.build_settings["PROVISIONING_PROFILE_SPECIFIER"] = profile
    end
  end
end

proj.save

# Shared schemes, so the TV app can be archived on its own (and the watch app built on its own).
[tv, watch].each do |t|
  scheme = Xcodeproj::XCScheme.new
  scheme.configure_with_targets(t, nil)
  scheme.save_as(project_path, t.name, true)
end
puts "Added PodPlusWatch (#{host}.watchkitapp#{embed_watch ? ', inside the iPhone app' : ''}) and PodPlusTV (#{host}, tvOS)"
