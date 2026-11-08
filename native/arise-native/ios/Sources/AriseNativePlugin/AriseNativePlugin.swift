// Native screens for the iPhone app. The web app stays the source of truth: it hands this plugin a snapshot of
// the to-dos, the native screen shows them, and what the person does (tick, add, delete) is queued here for the
// web app to apply and send back.
//   openTasks({ tasks, lists })   shows the native Tasks screen over the web app
//   updateTasks({ tasks, lists }) refreshes it with the web app's latest
//   takeActions()                 -> { actions: [{ type, id?, title?, due?, listId? }] } and clears the queue
//   closeTasks()                  closes it
import Foundation
import Capacitor
import SwiftUI
import UIKit

@objc(AriseNativePlugin)
public class AriseNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AriseNativePlugin"
    public let jsName = "AriseNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openTasks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateTasks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeTasks", returnType: CAPPluginReturnPromise)
    ]

    private let model = TasksModel()
    private var host: UIViewController?
    private var pending: [[String: Any]] = []
    private let lock = NSLock()

    private func queue(_ action: [String: Any]) {
        lock.lock(); pending.append(action); lock.unlock()
    }

    @objc func openTasks(_ call: CAPPluginCall) {
        model.load(tasks: call.getArray("tasks") as? [[String: Any]] ?? [], lists: call.getArray("lists") as? [[String: Any]] ?? [])
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let presenter = self.bridge?.viewController else { call.reject("The app isn't ready."); return }
            if self.host != nil { call.resolve(); return }
            let view = TasksView(model: self.model, send: { [weak self] action in self?.queue(action) }, close: { [weak self] in self?.dismissTasks() })
            let controller = UIHostingController(rootView: view)
            controller.modalPresentationStyle = .fullScreen
            self.host = controller
            presenter.present(controller, animated: true) { call.resolve() }
        }
    }

    @objc func updateTasks(_ call: CAPPluginCall) {
        let tasks = call.getArray("tasks") as? [[String: Any]] ?? []
        let lists = call.getArray("lists") as? [[String: Any]] ?? []
        DispatchQueue.main.async { [weak self] in
            self?.model.load(tasks: tasks, lists: lists)
            call.resolve()
        }
    }

    @objc func takeActions(_ call: CAPPluginCall) {
        lock.lock(); let out = pending; pending = []; lock.unlock()
        call.resolve(["actions": out])
    }

    @objc func closeTasks(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.host?.dismiss(animated: true)
            self?.host = nil
            call.resolve()
        }
    }

    private func dismissTasks() {
        host?.dismiss(animated: true)
        host = nil
        queue(["type": "closed"])
    }
}
