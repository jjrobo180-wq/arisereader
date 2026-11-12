// Arise To Duo for Mac: the To Duo web app (arisetodo.com/app) in a real Mac window, with Mac menus and
// keyboard shortcuts (⌘1 LifeHub, ⌘2 WorkHub, ⌘R reload, ⌘[ / ⌘] back and forward, ⌘+ / ⌘- zoom),
// sign-in kept between launches, links to other sites opened in the browser, file pickers for
// uploads, and a page when you're offline. Built and uploaded by .github/workflows/arisetodo-mac.yml.
import SwiftUI
import WebKit

let startURL = URL(string: "https://arisetodo.com/app")!

/// Pages that stay in the window: To Duo itself, and the sign-in and checkout pages it sends you to.
func staysInside(_ url: URL) -> Bool {
    guard let host = url.host?.lowercased() else { return url.scheme == "about" }
    let inside = ["arisetodo.com", "www.arisetodo.com", "accounts.google.com", "appleid.apple.com", "checkout.stripe.com", "billing.stripe.com"]
    return inside.contains(host) || host.hasSuffix(".supabase.co")
}

final class Browser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    let web: WKWebView
    @Published var offline = false

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.isElementFullscreenEnabled = true
        config.applicationNameForUserAgent = "AriseToDuoMac/1.0"
        web = WKWebView(frame: .zero, configuration: config)
        super.init()
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.allowsMagnification = true
        web.load(URLRequest(url: startURL))
    }

    func go(_ path: String) { if let u = URL(string: "https://arisetodo.com" + path) { offline = false; web.load(URLRequest(url: u)) } }
    func reload() { offline = false; if web.url == nil { web.load(URLRequest(url: startURL)) } else { web.reload() } }
    func zoom(_ by: CGFloat) { web.pageZoom = by == 0 ? 1 : max(0.5, min(2.5, web.pageZoom + by)) }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if url.scheme == "mailto" || url.scheme == "tel" || ((url.scheme == "https" || url.scheme == "http") && !staysInside(url)) {
            NSWorkspace.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // Links that open a new window: To Duo's own open here, everything else in the browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if staysInside(url) { webView.load(URLRequest(url: url)) } else { NSWorkspace.shared.open(url) }
        }
        return nil
    }

    // Choosing a photo or file to attach.
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.begin { completionHandler($0 == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.runModal(); completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Cancel")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { offline = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    private func failed(_ error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled || code == 102 { return }  // a link handed to the browser, or a download
        offline = true
    }
}

struct WebView: NSViewRepresentable {
    let browser: Browser
    func makeNSView(context: Context) -> WKWebView { browser.web }
    func updateNSView(_ view: WKWebView, context: Context) {}
}

struct ContentView: View {
    @ObservedObject var browser: Browser
    var body: some View {
        ZStack {
            WebView(browser: browser)
            if browser.offline {
                VStack(spacing: 14) {
                    Image(nsImage: NSApp.applicationIconImage).resizable().frame(width: 72, height: 72)
                    Text("You're offline").font(.title2).bold()
                    Text("Arise To Duo needs the internet to load your hubs. Check your connection and try again.")
                        .multilineTextAlignment(.center).foregroundStyle(.secondary).frame(maxWidth: 360)
                    Button("Try again") { browser.reload() }.keyboardShortcut(.defaultAction)
                }
                .padding(40)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.background)
            }
        }
        .frame(minWidth: 420, minHeight: 560)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main
struct AriseToDuoApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var browser = Browser()

    var body: some Scene {
        WindowGroup("Arise To Duo") {
            ContentView(browser: browser)
        }
        .defaultSize(width: 1280, height: 820)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("Go") {
                Button("LifeHub") { browser.go("/app#/lifehub") }.keyboardShortcut("1")
                Button("WorkHub") { browser.go("/app#/workhub") }.keyboardShortcut("2")
                Divider()
                Button("Back") { if browser.web.canGoBack { browser.web.goBack() } }.keyboardShortcut("[")
                Button("Forward") { if browser.web.canGoForward { browser.web.goForward() } }.keyboardShortcut("]")
                Button("Home") { browser.go("/app") }.keyboardShortcut("h", modifiers: [.command, .shift])
            }
            CommandGroup(after: .toolbar) {
                Button("Reload") { browser.reload() }.keyboardShortcut("r")
                Button("Actual Size") { browser.zoom(0) }.keyboardShortcut("0")
                Button("Zoom In") { browser.zoom(0.1) }.keyboardShortcut("+")
                Button("Zoom Out") { browser.zoom(-0.1) }.keyboardShortcut("-")
            }
            CommandGroup(replacing: .help) {
                Button("Arise To Duo Help") { NSWorkspace.shared.open(URL(string: "https://arisetodo.com/support")!) }
            }
        }
    }
}
