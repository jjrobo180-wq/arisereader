import UIKit
import WebKit

/// The app never zooms: not when a text box is tapped, not on a double tap, not with two fingers.
/// iPhone's own focus zoom animates the web view's scroll view, so the zoom is held at 1 there,
/// and any change is put straight back.
final class NotesZoomLock: NSObject {
    private static var watch: NSKeyValueObservation?

    static func install(on webView: WKWebView?) {
        DispatchQueue.main.async {
            guard let scroll = webView?.scrollView else { return }
            scroll.minimumZoomScale = 1
            scroll.maximumZoomScale = 1
            scroll.bouncesZoom = false
            scroll.pinchGestureRecognizer?.isEnabled = false
            watch = scroll.observe(\.zoomScale, options: [.new]) { view, _ in
                guard abs(view.zoomScale - 1) > 0.001 else { return }
                DispatchQueue.main.async {
                    view.minimumZoomScale = 1
                    view.maximumZoomScale = 1
                    view.pinchGestureRecognizer?.isEnabled = false
                    view.setZoomScale(1, animated: false)
                }
            }
        }
    }
}
