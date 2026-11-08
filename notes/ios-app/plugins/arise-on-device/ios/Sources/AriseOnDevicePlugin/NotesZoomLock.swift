import UIKit
import WebKit

/// The app never zooms IN: not when a text box is tapped, not on a double tap, not with two fingers.
/// iPhone's own focus zoom animates the web view's scroll view, so any zoom above the page's own scale is put
/// straight back. The page's own fit-to-screen scale is left alone, so the page is never cut off at the edge.
final class NotesZoomLock: NSObject {
    private static var watch: NSKeyValueObservation?

    static func install(on webView: WKWebView?) {
        DispatchQueue.main.async {
            guard let scroll = webView?.scrollView else { return }
            scroll.maximumZoomScale = 1
            scroll.bouncesZoom = false
            scroll.alwaysBounceHorizontal = false
            scroll.showsHorizontalScrollIndicator = false
            scroll.pinchGestureRecognizer?.isEnabled = false
            watch = scroll.observe(\.zoomScale, options: [.new]) { view, _ in
                // Any zoom above the page's own scale is put back (a zoom up to exactly 1 from a smaller page scale too).
                let own = view.minimumZoomScale > 0.5 && view.minimumZoomScale <= 1 ? view.minimumZoomScale : 1
                guard view.zoomScale > own + 0.001 else { return }
                DispatchQueue.main.async {
                    view.maximumZoomScale = max(own, view.minimumZoomScale)
                    view.pinchGestureRecognizer?.isEnabled = false
                    view.setZoomScale(own, animated: false)
                }
            }
        }
    }
}
