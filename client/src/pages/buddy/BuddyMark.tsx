// TTS Buddy's mark: a speech bubble holding a line of text, the part being read underlined in yellow.
export function BuddyMark({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
    <rect width="64" height="64" rx="16" fill="#ff6b3d" />
    <path d="M14 16h36a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H30l-9 8v-8h-7a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4Z" fill="#fff" />
    <rect x="18" y="23" width="13" height="5" rx="2.5" fill="#1d2433" />
    <rect x="33" y="21.5" width="15" height="8" rx="3" fill="#ffe066" /><rect x="35" y="23" width="11" height="5" rx="2.5" fill="#1d2433" />
    <rect x="18" y="33" width="22" height="5" rx="2.5" fill="#1d2433" opacity=".35" />
  </svg>;
}
