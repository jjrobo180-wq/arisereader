// Arise All Access bought inside the iPhone app with Apple's in-app purchase (StoreKit 2).
// The web app drives it (client/src/lib/appleStore.ts); the server checks every purchase Apple signs
// (server/appleStore.ts) before it turns All Access on.
//   storefront()                 -> { country }                the App Store country, e.g. "USA"
//   product({ id })              -> { available, displayPrice, title, period }
//   purchase({ id, token })      -> { status: "purchased" | "pending" | "cancelled", jws? }
//   entitlements()               -> { transactions: [jws] }    subscriptions running now
//   restore()                    -> { transactions: [jws] }    asks the App Store to sync first
//   manage()                     opens Apple's Manage Subscriptions sheet
// Renewals that arrive while the app is open come as the "transaction" event ({ jws }).
import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(AriseStorePlugin)
public class AriseStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AriseStorePlugin"
    public let jsName = "AriseStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "storefront", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]

    private var updates: Task<Void, Never>?

    public override func load() {
        // Renewals, purchases approved later (Ask to Buy) and refunds: finish them and tell the web app.
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish() }
                self?.notifyListeners("transaction", data: ["jws": result.jwsRepresentation])
            }
        }
    }

    deinit { updates?.cancel() }

    @objc func storefront(_ call: CAPPluginCall) {
        Task {
            let country = await Storefront.current?.countryCode ?? ""
            call.resolve(["country": country])
        }
    }

    @objc func product(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else { call.reject("No product."); return }
        Task {
            do {
                guard let p = try await Product.products(for: [id]).first else { call.resolve(["available": false]); return }
                var period = ""
                if let s = p.subscription?.subscriptionPeriod {
                    switch s.unit { case .day: period = "day"; case .week: period = "week"; case .month: period = "month"; case .year: period = "year"; @unknown default: period = "" }
                }
                call.resolve(["available": true, "displayPrice": p.displayPrice, "title": p.displayName, "period": period])
            } catch {
                call.resolve(["available": false, "error": error.localizedDescription])
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else { call.reject("No product."); return }
        let token = call.getString("token").flatMap { UUID(uuidString: $0) }
        Task {
            do {
                guard let p = try await Product.products(for: [id]).first else { call.reject("This plan isn't available in the App Store right now."); return }
                var options: Set<Product.PurchaseOption> = []
                if let token = token { options.insert(.appAccountToken(token)) }
                let result = try await p.purchase(options: options)
                switch result {
                case .success(let verification):
                    if case .verified(let t) = verification { await t.finish() }
                    call.resolve(["status": "purchased", "jws": verification.jwsRepresentation])
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.resolve(["status": "cancelled"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func current() async -> [String] {
        var out: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.productType == .autoRenewable { out.append(result.jwsRepresentation) }
        }
        return out
    }

    @objc func entitlements(_ call: CAPPluginCall) {
        Task { call.resolve(["transactions": await current()]) }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do { try await AppStore.sync() } catch { call.reject(error.localizedDescription); return }
            call.resolve(["transactions": await current()])
        }
    }

    @objc func manage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                if let url = URL(string: "https://apps.apple.com/account/subscriptions") { UIApplication.shared.open(url) }
                call.resolve(); return
            }
            Task {
                do { try await AppStore.showManageSubscriptions(in: scene) } catch {
                    if let url = URL(string: "https://apps.apple.com/account/subscriptions") { await UIApplication.shared.open(url) }
                }
                call.resolve()
            }
        }
    }
}
