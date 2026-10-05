import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

/**
 * Shows one of the self-contained games from client/public/standalone (built
 * from client/standalone-games). The game fills the page and keeps each
 * reader's own save. Its "Back to Games" buttons post "arise-game-exit" to this
 * page, which then returns to the Games page.
 */
export default function StandaloneGame({ file, title }: { file: string; title: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data && e.data.type === "arise-game-exit") navigate("/games");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  const src = `/standalone/${file}.html?host=arise&u=${encodeURIComponent(String(user?.id ?? ""))}`;
  return (
    <main className="club-world-root relative h-[100dvh] overflow-hidden bg-[#0b0a16]" aria-label={title}>
      <iframe
        ref={frame}
        src={src}
        title={title}
        allow="fullscreen; autoplay"
        // the game reads the keyboard, so it needs the focus as soon as it loads
        onLoad={() => frame.current?.contentWindow?.focus()}
        className="absolute inset-0 block h-full w-full border-0"
        data-testid={`frame-${file}`}
      />
    </main>
  );
}
