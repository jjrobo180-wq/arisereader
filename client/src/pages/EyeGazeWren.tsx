import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

/** Wren, the AI-voice talker, opened full screen inside the Eye Gazer app. Wren itself lives at /eyegaze/wren/. */
export default function EyeGazeWren() {
  const [, navigate] = useLocation();
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f7f8ff]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[#e5e8f4] bg-white px-3 sm:px-5">
        <button type="button" onClick={() => navigate("/eye-gaze-home")} className="eg-press inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-700 px-4 text-sm font-bold text-white" data-testid="button-wren-home">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Home
        </button>
        <span className="eg-title text-lg font-extrabold tracking-tight text-[#191b35]">Wren <span className="text-violet-700">Talker</span></span>
      </div>
      <iframe src="/eyegaze/wren/" title="Wren talker" allow="autoplay; camera" className="w-full flex-1 border-0 bg-white" data-testid="frame-wren" />
    </div>
  );
}
