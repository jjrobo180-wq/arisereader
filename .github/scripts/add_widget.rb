#!/usr/bin/env ruby
# Adds the AriseWidgets extension (native/widget-extension/AriseWidgets.swift) to a Capacitor iOS project.
#
#   ruby add_widget.rb <App.xcodeproj> <host bundle id> '["Name 1","Name 2","Name 3"]' <tint hex>
#
# The extension is called AriseWidgets, its bundle id is <host>.widgets, and it reads the App Group
# group.<host> that the AriseWidgets plugin writes to. Run after `npx cap add ios && npx cap sync ios`.
# The Apple side (an App ID for the extension, the App Group, a provisioning profile) is only needed for a
# signed build; a simulator build compiles without them.
require "xcodeproj"
require "json"
require "fileutils"

project_path, host, names_json, tint = ARGV
abort "usage: add_widget.rb <App.xcodeproj> <host bundle id> <names json> <tint>" unless project_path && host && names_json
names = JSON.parse(names_json)
abort "need exactly three widget names" unless names.length == 3

root = File.expand_path("../..", __dir__)
src = File.read(File.join(root, "native/widget-extension/AriseWidgets.swift"))
src = src.sub("__NAMES__", JSON.generate(names)).sub("__TINT__", tint || "ff5a1f")

ios_dir = File.dirname(project_path)
dir = File.join(ios_dir, "AriseWidgets")
FileUtils.mkdir_p(dir)
File.write(File.join(dir, "AriseWidgets.swift"), src)
File.write(File.join(dir, "Info.plist"), <<~PLIST)
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict>
    <key>CFBundleDevelopmentRegion</key><string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key><string>#{names[0]}</string>
    <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
    <key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>
  </dict></plist>
PLIST
File.write(File.join(dir, "AriseWidgets.entitlements"), <<~PLIST)
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict>
    <key>com.apple.security.application-groups</key><array><string>group.#{host}</string></array>
  </dict></plist>
PLIST

proj = Xcodeproj::Project.open(project_path)
app = proj.targets.find { |t| t.name == "App" } or abort "no App target"
abort "AriseWidgets is already in the project" if proj.targets.any? { |t| t.name == "AriseWidgets" }

ext = proj.new_target(:app_extension, "AriseWidgets", :ios, "17.0")
group = proj.main_group.new_group("AriseWidgets", "AriseWidgets")
swift = group.new_file("AriseWidgets.swift")
group.new_file("Info.plist")
group.new_file("AriseWidgets.entitlements")
ext.add_file_references([swift])

app_cfg = app.build_configurations.first.build_settings
ext.build_configurations.each do |c|
  s = c.build_settings
  s["PRODUCT_BUNDLE_IDENTIFIER"] = "#{host}.widgets"
  s["PRODUCT_NAME"] = "$(TARGET_NAME)"
  s["INFOPLIST_FILE"] = "AriseWidgets/Info.plist"
  s["CODE_SIGN_ENTITLEMENTS"] = "AriseWidgets/AriseWidgets.entitlements"
  s["SWIFT_VERSION"] = "5.0"
  s["TARGETED_DEVICE_FAMILY"] = "1,2"
  s["IPHONEOS_DEPLOYMENT_TARGET"] = "17.0"
  s["SKIP_INSTALL"] = "YES"
  s["MARKETING_VERSION"] = app_cfg["MARKETING_VERSION"] || "1.0"
  s["CURRENT_PROJECT_VERSION"] = app_cfg["CURRENT_PROJECT_VERSION"] || "1"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
  s["GENERATE_INFOPLIST_FILE"] = "NO"
end

app.add_dependency(ext)
embed = app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.symbol_dst_subfolder_spec = :plug_ins
build_file = embed.add_file_reference(ext.product_reference, true)
build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

proj.save
puts "Added AriseWidgets (#{host}.widgets) with #{names.join(', ')}"
