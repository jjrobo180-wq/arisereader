#!/usr/bin/env ruby
# Puts PrivacyInfo.xcprivacy into the app and into every extension, watch and TV target of the generated
# Xcode project, as a bundled resource.   Usage: ruby add_privacy_manifest.rb <App.xcodeproj> <PrivacyInfo.xcprivacy>
require "xcodeproj"
require "fileutils"

proj_path, manifest = ARGV
abort "usage: add_privacy_manifest.rb <App.xcodeproj> <PrivacyInfo.xcprivacy>" unless proj_path && manifest && File.exist?(manifest)

proj = Xcodeproj::Project.open(proj_path)
root = File.dirname(proj_path)
added = []

proj.native_targets.each do |target|
  next unless target.product_type =~ /application|app-extension|watchapp|watchkit/
  rel = Dir.exist?(File.join(root, target.name)) ? target.name : "App"
  FileUtils.mkdir_p(File.join(root, rel))
  FileUtils.cp(manifest, File.join(root, rel, "PrivacyInfo.xcprivacy"))
  path = "#{rel}/PrivacyInfo.xcprivacy"
  ref = proj.files.find { |f| f.real_path.to_s == File.join(root, path) } || proj.main_group.new_file(path)
  phase = target.resources_build_phase
  phase.add_file_reference(ref, true) unless phase.files_references.include?(ref)
  added << target.name
end

proj.save
puts "Privacy manifest added to: #{added.join(', ')}"
abort "No targets found" if added.empty?
