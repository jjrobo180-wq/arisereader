// How each game's title logo looks: the family ("legend" = carved Cinzel,
// "strike" = tall Teko), the metal gradient, the glow, and the accent used for
// its Play button.
export type LogoStyle = {
  family: "legend" | "strike";
  metal: [string, string, string];
  glow: string;
  accent: string;
};

const gold: LogoStyle["metal"] = ["#fff6d8", "#ffcf55", "#9a5a06"];

export const LOGO: Record<string, LogoStyle> = {
  four: { family: "strike", metal: ["#ffffff", "#bfe0ff", "#5a86c8"], glow: "rgba(95,180,255,.55)", accent: "#69b8ff" },
  checkers: { family: "legend", metal: gold, glow: "rgba(255,190,80,.45)", accent: "#ffcf55" },
  reversi: { family: "legend", metal: ["#ffffff", "#f3e8cc", "#9a8a64"], glow: "rgba(255,220,150,.5)", accent: "#ffe3a0" },
  mancala: { family: "legend", metal: ["#fff1d6", "#ffb35c", "#9a4a18"], glow: "rgba(255,150,80,.45)", accent: "#ffa35c" },
  dots: { family: "strike", metal: ["#ffffff", "#ff9be8", "#ff3fd0"], glow: "rgba(255,63,208,.7)", accent: "#ff5fd8" },
  gomoku: { family: "legend", metal: ["#ffffff", "#f3e6c8", "#b39a6a"], glow: "rgba(255,240,200,.45)", accent: "#f0dcae" },
  chess: { family: "legend", metal: gold, glow: "rgba(255,200,110,.5)", accent: "#ffd27a" },
  tictactoe: { family: "strike", metal: ["#fff4d6", "#ffb03d", "#ff4d3d"], glow: "rgba(255,90,60,.6)", accent: "#ff7a4d" },
  gobble: { family: "legend", metal: ["#fff1e0", "#ffb070", "#a8401a"], glow: "rgba(255,130,60,.5)", accent: "#ff9a5c" },
  rps: { family: "strike", metal: ["#fffaf0", "#ffd08a", "#c4511f"], glow: "rgba(255,160,80,.5)", accent: "#ffb26b" },
  memory: { family: "strike", metal: ["#ffffff", "#9ffff0", "#2fbfa8"], glow: "rgba(61,242,208,.55)", accent: "#3df2d0" },
  ultimate: { family: "legend", metal: ["#ffffff", "#ffe0f2", "#b98ad6"], glow: "rgba(255,190,230,.55)", accent: "#e0a8ff" },
  seabattle: { family: "strike", metal: ["#ffffff", "#cfe3f5", "#5d7a99"], glow: "rgba(160,210,255,.45)", accent: "#8fc8ff" },
  codebreaker: { family: "strike", metal: ["#f2fff7", "#7dffbd", "#1fa865"], glow: "rgba(61,255,156,.55)", accent: "#5dffb0" },
  nim: { family: "legend", metal: ["#ffffff", "#cfefff", "#6a8fb8"], glow: "rgba(160,230,255,.5)", accent: "#9fe8ff" },
  fifteen: { family: "legend", metal: ["#fff6d8", "#ffd27a", "#b06bff"], glow: "rgba(190,120,255,.55)", accent: "#c79bff" },
  eights: { family: "strike", metal: ["#fffbe8", "#ffd060", "#c27a10"], glow: "rgba(255,200,80,.5)", accent: "#ffd060" },
  gofish: { family: "legend", metal: ["#f6eaff", "#d9a8ff", "#7a3a9a"], glow: "rgba(200,140,255,.5)", accent: "#d4a0ff" },
  pig: { family: "strike", metal: ["#fff1d6", "#ffb347", "#c45a12"], glow: "rgba(255,160,70,.55)", accent: "#ffb347" },
  word_tiles: { family: "legend", metal: ["#ffffff", "#c9f3ff", "#58b6d8"], glow: "rgba(127,227,255,.55)", accent: "#7fe3ff" },
  word_rescue: { family: "strike", metal: ["#ffffff", "#ffd2cc", "#ff3b30"], glow: "rgba(255,80,60,.5)", accent: "#ff7a6b" },
  synonym_sprint: { family: "legend", metal: ["#ffffff", "#ffd6ea", "#d27aa8"], glow: "rgba(255,200,230,.55)", accent: "#ffb0d4" },
  sentence_fix: { family: "legend", metal: ["#fffbe6", "#ffd36b", "#ff6a1a"], glow: "rgba(255,140,40,.6)", accent: "#ffa04d" },
  spelling: { family: "legend", metal: ["#fffaf0", "#ffe7a3", "#a97aff"], glow: "rgba(180,140,255,.55)", accent: "#c4a3ff" },
  math_duel: { family: "strike", metal: ["#ffffff", "#bfe6ff", "#4f9fff"], glow: "rgba(110,190,255,.6)", accent: "#7fc8ff" },
  pattern_power: { family: "strike", metal: ["#d6fcff", "#ff9be8", "#ffd36b"], glow: "rgba(255,95,216,.5)", accent: "#ff8ae0" },
  fact_dash: { family: "strike", metal: ["#ffffff", "#bff8ff", "#3fb8e8"], glow: "rgba(95,243,255,.55)", accent: "#6ff0ff" },
  geography: { family: "legend", metal: ["#fffbe6", "#ffd36b", "#b8800c"], glow: "rgba(79,195,255,.5)", accent: "#6fd0ff" },
};

export const logoFor = (id: string): LogoStyle => LOGO[id] || { family: "strike", metal: ["#ffffff", "#dfe6ff", "#8a96c8"], glow: "rgba(160,180,255,.4)", accent: "#c8d2ff" };

/** Splits a title into logo lines: two-word titles stack. */
export const logoLines = (title: string) => (title.includes(" ") ? title.split(" ") : [title]);

/**
 * Font size for a logo, as a share of the available width, so long titles
 * shrink and short ones stay big.
 */
export function logoScale(title: string, family: LogoStyle["family"], max: number) {
  // Wide letters (W, M) take more room, narrow ones (I) less.
  const units = (line: string) => [...line].reduce((n, ch) => n + (ch === "W" || ch === "M" ? 1.35 : ch === "I" ? 0.55 : 1), 0);
  const longest = Math.max(...logoLines(title).map(units));
  const perLetter = family === "legend" ? 0.8 : 0.58;
  return Math.min(max, 100 / (longest * perLetter));
}
