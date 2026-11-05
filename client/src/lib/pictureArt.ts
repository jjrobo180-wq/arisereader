// Pictures for the Picture box tile when nobody has added a photo yet: a few calm landscapes drawn as
// SVG (sunset hills, a lake at dawn, night mountains, a beach), so the tile always shows a real picture.
const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;

export const PICTURE_ART: string[] = [
  // Sunset over rolling hills
  svg(`<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7e5f"/><stop offset=".55" stop-color="#feb47b"/><stop offset="1" stop-color="#ffd8a8"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#s)"/><circle cx="270" cy="210" r="52" fill="#fff4d6" opacity=".95"/>
  <path d="M0 260 Q100 200 200 250 T400 230 V400 H0Z" fill="#c0587e"/><path d="M0 300 Q120 250 240 300 T400 290 V400 H0Z" fill="#8e3b6b"/><path d="M0 340 Q140 300 280 345 T400 335 V400 H0Z" fill="#4e1f4f"/>`),
  // A lake at dawn with pines
  svg(`<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a1c4fd"/><stop offset="1" stop-color="#fbc2eb"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2a7e8"/><stop offset="1" stop-color="#6d83c9"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#d)"/><path d="M0 230 L80 150 L150 210 L230 120 L320 200 L400 160 V250 H0Z" fill="#7b8fc4" opacity=".7"/>
  <rect y="250" width="400" height="150" fill="url(#w)"/><path d="M20 250 l14 -60 l14 60z M50 250 l18 -80 l18 80z M330 250 l16 -70 l16 70z M360 250 l12 -50 l12 50z" fill="#2c3e6b"/>
  <rect x="120" y="280" width="160" height="3" fill="#fff" opacity=".5"/><rect x="160" y="300" width="80" height="2" fill="#fff" opacity=".4"/>`),
  // Mountains under the stars
  svg(`<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2027"/><stop offset=".6" stop-color="#203a43"/><stop offset="1" stop-color="#2c5364"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#n)"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 220}" r="${(i % 3) * 0.6 + 0.6}" fill="#fff" opacity="${0.4 + (i % 5) * 0.12}"/>`).join("")}
  <circle cx="310" cy="80" r="26" fill="#f6f1d5"/><path d="M0 300 L90 180 L150 250 L230 140 L330 260 L400 210 V400 H0Z" fill="#16313d"/><path d="M230 140 L255 172 L240 168 L228 182 L212 166 L205 172Z" fill="#e8f1f5"/><path d="M0 340 L110 270 L200 330 L300 280 L400 330 V400 H0Z" fill="#0b1c22"/>`),
  // A beach in the afternoon
  svg(`<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4facfe"/><stop offset="1" stop-color="#00f2fe"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#b)"/><circle cx="90" cy="90" r="34" fill="#fff6b3"/><rect y="220" width="400" height="90" fill="#1c8fd6"/>
  <path d="M0 300 Q100 285 200 300 T400 295 V400 H0Z" fill="#f6dfa8"/><path d="M0 300 Q100 285 200 300 T400 295" fill="none" stroke="#fff" stroke-width="4" opacity=".8"/>
  <path d="M300 300 Q305 240 330 200" stroke="#6b4a2b" stroke-width="7" fill="none"/><path d="M330 200 q-40 -5 -55 15 M330 200 q35 -10 50 10 M330 200 q-10 -30 -35 -35 M330 200 q20 -30 45 -25" stroke="#2f8f4e" stroke-width="9" fill="none" stroke-linecap="round"/>`),
];
