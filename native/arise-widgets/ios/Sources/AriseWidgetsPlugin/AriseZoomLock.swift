import UIKit
import WebKit

/// The app never zooms IN: not when a text box is tapped, not on a double tap, not with two fingers.
/// iPhone's own focus zoom animates the web view's scroll view, so any zoom above the page's own resting scale
/// is put straight back. The resting scale is 1 on a normal page, or a compact one (Arise To Duo rests at 0.93,
/// Arise Fit at 0.9): a zoom from 0.93 up to 1 is a zoom in too, and it used to slip through.
final class AriseZoomLock: NSObject {
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
                let low = view.minimumZoomScale
                let resting: CGFloat = low > 0.8 && low <= 1 ? low : 1
                guard view.zoomScale > resting + 0.001 else { return }
                DispatchQueue.main.async {
                    view.maximumZoomScale = 1
                    view.pinchGestureRecognizer?.isEnabled = false
                    // Back to the page's own scale (1 on a normal page).
                    let own = view.minimumZoomScale
                    view.setZoomScale(own > 0.8 && own <= 1 ? own : 1, animated: false)
                }
            }
        }
    }
}
