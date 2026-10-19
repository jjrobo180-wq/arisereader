// Scanning food barcodes with the phone's camera. Where the browser has a barcode reader built in
// (Chrome on Android) that reads the frames; everywhere else, including Safari on iPhone and iPad,
// the app's own reader does (shared/barcode.ts), so scanning works on every phone with a camera.
import { expandUpcE, lookupCode, readPicture } from "@shared/barcode";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/** Whether this browser can use a camera at all (the page has to be on https). */
export const canUseCamera = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && (typeof window === "undefined" || window.isSecureContext !== false);

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]> };

/** The browser's own barcode reader, if it has one that reads food barcodes. */
async function builtInReader(): Promise<Detector | null> {
  const BD = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (!BD) return null;
  try {
    const supported: string[] = typeof BD.getSupportedFormats === "function" ? await BD.getSupportedFormats() : FORMATS;
    const formats = FORMATS.filter((f) => supported.includes(f));
    return formats.length ? (new BD({ formats }) as Detector) : null;
  } catch {
    return null;
  }
}

function cameraMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") return "The camera isn't allowed. Allow camera access when your phone asks (or in Settings), or type the numbers under the barcode.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found. Type the numbers under the barcode instead.";
  if (name === "NotReadableError" || name === "AbortError") return "The camera is busy in another app. Close that app and try again, or type the numbers under the barcode.";
  return "The camera couldn't start. Type the numbers under the barcode instead.";
}

/** Shows the back camera in `video` and reads each frame until a barcode is found. `onFound` gets
 *  the number to look up. Returns a function that stops the camera. */
export function scanWithCamera(video: HTMLVideoElement, onFound: (code: string) => void, onError: (message: string) => void): () => void {
  let stopped = false;
  let timer = 0;
  let stream: MediaStream | null = null;
  const stop = () => {
    stopped = true;
    window.clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (video.srcObject) video.srcObject = null;
  };

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      // Keep refocusing as the package moves, where the camera allows it.
      const track = stream.getVideoTracks()[0];
      try {
        const caps = (track as unknown as { getCapabilities?: () => { focusMode?: string[] } }).getCapabilities?.();
        if (caps?.focusMode?.includes("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
      } catch { /* not every camera lets the page choose */ }

      const builtIn = await builtInReader();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let previous = "";

      const look = async () => {
        if (stopped) return;
        let code: string | null = null;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          if (builtIn) {
            try {
              const hit = (await builtIn.detect(video)).find((f) => /^\d{8,14}$/.test(f.rawValue));
              if (hit) code = hit.format === "upc_e" ? expandUpcE(hit.rawValue) ?? hit.rawValue : hit.rawValue;
            } catch { /* try the next frame */ }
          } else if (ctx) {
            // Full size up to 1920 pixels: a barcode held at a comfortable distance is small.
            const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
            const w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
            ctx.drawImage(video, 0, 0, w, h);
            const reads = readPicture({ width: w, height: h, data: ctx.getImageData(0, 0, w, h).data, channels: 4 });
            const best = reads[0];
            // Two lines in one frame agreeing, or the same code in two frames running.
            if (best && (best.hits >= 2 || `${best.format}:${best.text}` === previous)) code = lookupCode(best);
            previous = best ? `${best.format}:${best.text}` : "";
          }
        }
        if (stopped) return;
        if (code) { stop(); onFound(code); return; }
        timer = window.setTimeout(() => void look(), builtIn ? 150 : 60);
      };
      void look();
    } catch (error) {
      if (stopped) return;
      stop();
      onError(cameraMessage(error));
    }
  })();

  return stop;
}
