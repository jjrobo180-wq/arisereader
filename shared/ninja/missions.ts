// Reading Ninja — the 15 levels: what to slice, what to leave alone, and which world each one is set in.
import { LOOKS, type Thing, type WorldLook } from "../runner/missions";

export type NinjaLevel = { prompt: string; target: Thing; distractors: Thing[]; goal: number; name: string; badge: string; look: WorldLook; juice: number };

// Each arena borrows a Reading Runner world look (sky, skyline, ground, props) with its own name and mood.
const L = (base: WorldLook, o: Partial<WorldLook>): WorldLook => ({ ...base, ...o });
const dojo = L(LOOKS.castle, { key: "dojo", sky: [0xff8a5c, 0xffd29a, 0xfff0d2], fog: 0xffd8b0, props: ["pine", "lamp", "rock", "bush", "pine"], skyline: "mountains", skylineColor: 0xc98a7a, arch: null, ambient: "leaves", ground: "dirt", groundTint: 0xc9a46a, ui: "linear-gradient(160deg,#ff8a5c 0%,#7a2f4a 100%)" });
const sunrise = L(LOOKS.farm, { key: "sunrise", sky: [0x7ab8ff, 0xffd6a8, 0xfff2dc], fog: 0xffe6c8, ambient: "pollen", ui: "linear-gradient(160deg,#ffb36b 0%,#c97555 100%)" });
const storm = L(LOOKS.park, { key: "storm", sky: [0x4a6aa8, 0xb8c8e8, 0xe8eef8], fog: 0xc8d4ea, ambient: "none", sunI: 1.6, ui: "linear-gradient(160deg,#4e78c5 0%,#ffe970 140%)" });
const vault = L(LOOKS.castle, { key: "vault", sky: [0x3a2a1a, 0x9a6a3a, 0xffcb65], fog: 0x8a6a4a, night: true, hemi: 0.8, ambient: "sparkle", props: ["castle", "crystal", "banner", "rock"], ui: "linear-gradient(160deg,#2b1e22 0%,#ffcb65 100%)" });

const T = (label: string, emoji: string): Thing => ({ label, emoji });
const lv = (prompt: string, target: Thing, distractors: Thing[], name: string, badge: string, look: WorldLook, juice: number, goal = 9): NinjaLevel => ({ prompt, target, distractors, name, badge, look, juice, goal });

export const LEVELS: NinjaLevel[] = [
  lv("Find the apples!", T("apple", "🍎"), [T("banana", "🍌"), T("orange", "🍊"), T("grapes", "🍇"), T("pear", "🍐")], "Fruit Dojo", "🍎", dojo, 0xff3b3b),
  lv("Find the cats!", T("cat", "🐱"), [T("dog", "🐶"), T("rabbit", "🐰"), T("frog", "🐸"), T("bear", "🐻")], "Animal Garden", "🐱", LOOKS.park, 0xffb02e),
  lv("Slice the stars!", T("star", "⭐"), [T("moon", "🌙"), T("planet", "🪐"), T("rocket", "🚀"), T("comet", "☄️")], "Galaxy Hunt", "⭐", LOOKS.space, 0xffe14a),
  lv("Catch the dogs!", T("dog", "🐶"), [T("cat", "🐱"), T("cow", "🐮"), T("pig", "🐷"), T("fox", "🦊")], "Pet Park", "🐶", L(LOOKS.park, { key: "petpark", props: ["tree", "slide", "swing", "bush"] }), 0xc98a4a),
  lv("Spot the books!", T("book", "📘"), [T("pencil", "✏️"), T("backpack", "🎒"), T("scissors", "✂️"), T("ruler", "📏")], "School Lab", "📘", LOOKS.school, 0x3f8aff),
  lv("Get the fish!", T("fish", "🐟"), [T("crab", "🦀"), T("turtle", "🐢"), T("octopus", "🐙"), T("shell", "🐚")], "Ocean Splash", "🐟", LOOKS.ocean, 0x5fd6f0),
  lv("Chop the carrots!", T("carrot", "🥕"), [T("corn", "🌽"), T("tomato", "🍅"), T("potato", "🥔"), T("pepper", "🫑")], "Farm Chop", "🥕", LOOKS.farm, 0xff8a1f),
  lv("Pop the lollipops!", T("lollipop", "🍭"), [T("candy", "🍬"), T("cupcake", "🧁"), T("donut", "🍩"), T("cake", "🎂")], "Candy Storm", "🍭", LOOKS.candy, 0xff5fae),
  lv("Hit the soccer balls!", T("soccer ball", "⚽"), [T("basketball", "🏀"), T("football", "🏈"), T("baseball", "⚾"), T("tennis ball", "🎾")], "Sports Arena", "⚽", LOOKS.night, 0x7dff6b),
  lv("Find the monkeys!", T("monkey", "🐒"), [T("tiger", "🐯"), T("snake", "🐍"), T("parrot", "🦜"), T("frog", "🐸")], "Jungle Search", "🐒", LOOKS.jungle, 0xb7ff62),
  lv("Slice the snowflakes!", T("snowflake", "❄️"), [T("snowman", "⛄"), T("tree", "🌲"), T("mountain", "🏔️"), T("sled", "🛷")], "Snow Search", "❄️", LOOKS.snow, 0x9fe8ff),
  lv("Collect the gems!", T("gem", "💎"), [T("alien", "👾"), T("game", "🎮"), T("joystick", "🕹️"), T("star", "⭐")], "Neon Arcade", "💎", LOOKS.arcade, 0x00f6ff, 10),
  lv("Grab the pancakes!", T("pancake", "🥞"), [T("egg", "🍳"), T("milk", "🥛"), T("bread", "🍞"), T("coffee", "☕")], "Breakfast Rush", "🥞", sunrise, 0xffc24a),
  lv("Slice the suns!", T("sun", "☀️"), [T("cloud", "☁️"), T("rain", "🌧️"), T("rainbow", "🌈"), T("lightning", "⚡")], "Weather Lab", "☀️", storm, 0xffe14a),
  lv("Collect the crowns!", T("crown", "👑"), [T("gem", "💎"), T("key", "🗝️"), T("castle", "🏰"), T("shield", "🛡️")], "Treasure Vault", "👑", vault, 0xffcf4a, 10),
];
