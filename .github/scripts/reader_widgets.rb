# Arise Reader iPhone app: adds the Home Screen widget extension (ios/App/ReaderWidgets, copied
# there by reader_widgets.py) to the Xcode project, embeds it in the app, and gives each target its
# own bundle ID, signing profile and entitlements (both share the keychain group the widget reads).
#
# Usage (from reader/ios-app): ruby ../../.github/scripts/reader_widgets.rb ios/App/App.xcodeproj
# Environment: APP_PROFILE and WIDGET_PROFILE (provisioning profile names) when signing; without
# them the targets build unsigned (the simulator check).
require "xcodeproj"

project_path = ARGV[0] || "ios/App/App.xcodeproj"
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |t| t.name == "App" } or abort("No App target")
abort("Widgets already added") if project.targets.any? { |t| t.name == "ReaderWidgets" }

app_settings = app.build_configurations.first.build_settings
marketing = app_settings["MARKETING_VERSION"] || "1.0"
plist_path = File.join(File.dirname(project_path), "App", "Info.plist")
build_number = `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "#{plist_path}" 2>/dev/null`.strip
build_number = app_settings["CURRENT_PROJECT_VERSION"] || "1" if build_number.empty? || build_number.start_with?("$(")

widget = project.new_target(:app_extension, "ReaderWidgets", :ios, "16.0", nil, :swift)
group = project.main_group.new_group("ReaderWidgets", "ReaderWidgets")
widget.add_file_references([group.new_file("ReaderWidgets.swift")])
group.new_file("Info.plist")
group.new_file("ReaderWidgets.entitlements")

widget.build_configurations.each do |c|
  s = c.build_settings
  s["PRODUCT_BUNDLE_IDENTIFIER"] = "com.arisereader.reader.widgets"
  s["PRODUCT_NAME"] = "ReaderWidgets"
  s["INFOPLIST_FILE"] = "ReaderWidgets/Info.plist"
  s["GENERATE_INFOPLIST_FILE"] = "NO"
  s["CODE_SIGN_ENTITLEMENTS"] = "ReaderWidgets/ReaderWidgets.entitlements"
  s["SWIFT_VERSION"] = "5.0"
  s["TARGETED_DEVICE_FAMILY"] = "1,2"
  s["IPHONEOS_DEPLOYMENT_TARGET"] = "16.0"
  s["MARKETING_VERSION"] = marketing
  s["CURRENT_PROJECT_VERSION"] = build_number
  s["SKIP_INSTALL"] = "YES"
  s["APPLICATION_EXTENSION_API_ONLY"] = "YES"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks"]
  s["PROVISIONING_PROFILE_SPECIFIER"] = ENV["WIDGET_PROFILE"] if ENV["WIDGET_PROFILE"].to_s != ""
end

# The app's own bundle ID, profile and entitlements move from the command line into its target,
# so the widget can have different ones.
app.build_configurations.each do |c|
  s = c.build_settings
  s["PRODUCT_BUNDLE_IDENTIFIER"] = "com.arisereader.reader"
  s["CODE_SIGN_ENTITLEMENTS"] = "App/App.entitlements"
  s["PROVISIONING_PROFILE_SPECIFIER"] = ENV["APP_PROFILE"] if ENV["APP_PROFILE"].to_s != ""
end

app.add_dependency(widget)
embed = app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.symbol_dst_subfolder_spec = :plug_ins
file = embed.add_file_reference(widget.product_reference, true)
file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "Widgets: ReaderWidgets extension added (build #{build_number}, version #{marketing})"
