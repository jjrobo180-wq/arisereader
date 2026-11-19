// YouTube refuses to play in the iPhone apps' own address (capacitor://localhost: "Video player
// configuration error", error 153). Inside an app the player runs on a real https page instead
// (public/yt-bridge.html on arisetodo.com), and this object stands in for YT.Player so the Shorts
// screen drives it the same way: mute, unMute, playVideo, pauseVideo, loadVideoById, destroy.
export const YT_BRIDGE_URL = "https://arisetodo.com/yt-bridge.html";

type Events = { onReady?: (e: any) => void; onAutoplayBlocked?: (e: any) => void; onStateChange?: (e: any) => void; onError?: (e: any) => void };

export function createBridgePlayer(host: HTMLElement, opts: { videoId: string; playerVars: Record<string, unknown>; events: Events }) {
  const frame = document.createElement("iframe");
  frame.src = YT_BRIDGE_URL;
  frame.title = "Short";
  frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
  frame.style.cssText = "width:100%;height:100%;border:0;background:#000";
  host.replaceChildren(frame);

  let videoId = opts.videoId;
  const post = (msg: Record<string, unknown>) => { try { frame.contentWindow?.postMessage({ ytb: 1, ...msg }, "*"); } catch {} };
  const proxy: any = {
    getIframe: () => frame,
    getVideoData: () => ({ video_id: videoId }),
    destroy: () => { window.removeEventListener("message", onMessage); },
    mute: () => post({ cmd: "call", fn: "mute", args: [] }),
    unMute: () => post({ cmd: "call", fn: "unMute", args: [] }),
    playVideo: () => post({ cmd: "call", fn: "playVideo", args: [] }),
    pauseVideo: () => post({ cmd: "call", fn: "pauseVideo", args: [] }),
    seekTo: (s: number, a?: boolean) => post({ cmd: "call", fn: "seekTo", args: [s, a] }),
    loadVideoById: (arg: { videoId: string }) => { videoId = arg.videoId; post({ cmd: "call", fn: "loadVideoById", args: [arg] }); },
  };
  const onMessage = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow) return;
    const m = e.data;
    if (!m || m.ytb !== 1) return;
    const ev = { target: proxy, data: m.data };
    if (m.ev === "loaded") post({ cmd: "init", videoId, playerVars: opts.playerVars });
    else if (m.ev === "ready") opts.events.onReady?.(ev);
    else if (m.ev === "autoplay") opts.events.onAutoplayBlocked?.(ev);
    else if (m.ev === "state") opts.events.onStateChange?.(ev);
    else if (m.ev === "error") {
      if (m.videoId) videoId = m.videoId;
      opts.events.onError?.(ev);
    }
  };
  window.addEventListener("message", onMessage);
  return proxy;
}
