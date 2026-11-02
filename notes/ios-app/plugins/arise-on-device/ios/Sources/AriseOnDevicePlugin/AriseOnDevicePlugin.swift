// Arise Notes, Private and Strict modes: speech to text that never leaves the iPhone (Apple's Speech
// framework with requiresOnDeviceRecognition), and, for Strict mode, Apple's on-device language model
// (Foundation Models, iOS 26 and Apple Intelligence) to write the summary.
//
// JavaScript calls (client/src/lib/onDevice.ts):
//   status({ locale })            -> { speech: "granted"|"denied"|"restricted"|"prompt", onDevice: Bool, ai: String, locale }
//   requestSpeech()               -> { speech }
//   transcribe({ audio, ext, locale, hints }) -> { lines: [{ start, end, text }], duration }
//   generate({ instructions, prompt })         -> { text }
import Foundation
import AVFoundation
import Capacitor
import Speech
#if canImport(FoundationModels)
import FoundationModels
#endif

@objc(AriseOnDevicePlugin)
public class AriseOnDevicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AriseOnDevicePlugin"
    public let jsName = "AriseOnDevice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestSpeech", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise)
    ]

    /// Running recognitions, kept so they aren't released before they finish.
    private var tasks: [String: SFSpeechRecognitionTask] = [:]
    private let lock = NSLock()

    private func recognizer(_ locale: String?) -> SFSpeechRecognizer? {
        if let id = locale, !id.isEmpty, let r = SFSpeechRecognizer(locale: Locale(identifier: id)) { return r }
        return SFSpeechRecognizer()
    }

    private func authWord(_ s: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }

    /// "available", or why not: "device" (iPhone can't), "off" (Apple Intelligence is off),
    /// "downloading" (the model isn't ready yet), "unsupported" (older iOS).
    private func aiWord() -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let availability = SystemLanguageModel.default.availability
            if case .available = availability { return "available" }
            let why = String(describing: availability)
            if why.contains("deviceNotEligible") { return "device" }
            if why.contains("appleIntelligenceNotEnabled") { return "off" }
            if why.contains("modelNotReady") { return "downloading" }
            return "unavailable"
        }
        #endif
        return "unsupported"
    }

    @objc func status(_ call: CAPPluginCall) {
        let r = recognizer(call.getString("locale"))
        call.resolve([
            "speech": authWord(SFSpeechRecognizer.authorizationStatus()),
            "onDevice": r?.supportsOnDeviceRecognition ?? false,
            "ai": aiWord(),
            "locale": r?.locale.identifier ?? ""
        ])
    }

    @objc func requestSpeech(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { s in
            call.resolve(["speech": self.authWord(s)])
        }
    }

    /// Words grouped into transcript lines: a new line after a pause, at the end of a sentence once the
    /// line has a few words, or when it gets long.
    private func lines(_ segments: [SFTranscriptionSegment]) -> [[String: Any]] {
        var out: [[String: Any]] = []
        var words: [String] = []
        var start = 0.0
        var end = 0.0
        func flush() {
            let text = words.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { out.append(["start": start, "end": max(end, start), "text": text]) }
            words = []
        }
        for s in segments {
            let word = s.substring.trimmingCharacters(in: .whitespacesAndNewlines)
            if word.isEmpty { continue }
            if !words.isEmpty && (s.timestamp - end > 0.9 || words.count >= 28) { flush() }
            if words.isEmpty { start = s.timestamp }
            words.append(word)
            end = s.timestamp + s.duration
            if let last = word.last, ".?!".contains(last), words.count >= 8 { flush() }
        }
        flush()
        return out
    }

    @objc func transcribe(_ call: CAPPluginCall) {
        guard let b64 = call.getString("audio"), let data = Data(base64Encoded: b64), !data.isEmpty else {
            call.reject("No audio arrived.")
            return
        }
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            call.reject("Speech recognition is off for Arise Notes. Turn it on in Settings, Privacy & Security, Speech Recognition.", "NOT_ALLOWED")
            return
        }
        guard let rec = recognizer(call.getString("locale")) else {
            call.reject("Speech recognition isn't available for this language on this iPhone.", "NO_LANGUAGE")
            return
        }
        guard rec.supportsOnDeviceRecognition else {
            call.reject("This iPhone can't write down speech on the device for this language.", "NO_ON_DEVICE")
            return
        }
        let raw = (call.getString("ext") ?? "m4a").lowercased().filter { $0.isLetter || $0.isNumber }
        let ext = raw.isEmpty ? "m4a" : String(raw.prefix(5))
        let id = UUID().uuidString
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("arise-\(id).\(ext)")
        do { try data.write(to: url) } catch {
            call.reject("The audio couldn't be saved for a moment. Try again.")
            return
        }
        let duration = CMTimeGetSeconds(AVURLAsset(url: url).duration)

        let request = SFSpeechURLRecognitionRequest(url: url)
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = false
        request.taskHint = .dictation
        if #available(iOS 16.0, *) { request.addsPunctuation = true }
        if let hints = call.getArray("hints", String.self), !hints.isEmpty { request.contextualStrings = Array(hints.prefix(100)) }

        var done = false
        let finish: () -> Void = { [weak self] in
            try? FileManager.default.removeItem(at: url)
            guard let self = self else { return }
            self.lock.lock(); self.tasks[id] = nil; self.lock.unlock()
        }
        let task = rec.recognitionTask(with: request) { [weak self] result, error in
            if done { return }
            if let result = result, result.isFinal {
                done = true
                let found = self?.lines(result.bestTranscription.segments) ?? []
                finish()
                call.resolve(["lines": found, "duration": duration.isFinite ? duration : 0])
                return
            }
            if let error = error {
                done = true
                finish()
                let ns = error as NSError
                // "No speech detected": a quiet part is an empty part, not a failure.
                if ns.code == 1110 || ns.code == 203 {
                    call.resolve(["lines": [], "duration": duration.isFinite ? duration : 0])
                } else {
                    call.reject("This part couldn't be written down on the iPhone (\(ns.localizedDescription)).", "FAILED")
                }
            }
        }
        lock.lock(); tasks[id] = task; lock.unlock()
    }

    @objc func generate(_ call: CAPPluginCall) {
        let instructions = call.getString("instructions") ?? ""
        let prompt = call.getString("prompt") ?? ""
        if prompt.isEmpty { call.reject("Nothing to work on."); return }
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            guard case .available = SystemLanguageModel.default.availability else {
                call.reject("Apple Intelligence isn't ready on this iPhone.", "AI_UNAVAILABLE")
                return
            }
            Task {
                do {
                    let session = LanguageModelSession(instructions: instructions)
                    let response = try await session.respond(to: prompt)
                    call.resolve(["text": response.content])
                } catch {
                    call.reject("The iPhone's AI couldn't write this (\(error.localizedDescription)).", "AI_FAILED")
                }
            }
            return
        }
        #endif
        call.reject("Strict mode summaries need iOS 26 and Apple Intelligence.", "AI_UNAVAILABLE")
    }
}
