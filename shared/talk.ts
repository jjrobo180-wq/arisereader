// Arise Talk: a picture-and-word communicator (AAC), like TouchChat, that speaks only in natural AI
// voices. Tap words to build a message and the app says it. Every board, button, phrase and setting
// is the person's to change. Pure data and functions: the app, the server (backups) and the tests
// share them.

export type TalkKind = "people" | "action" | "describe" | "thing" | "social" | "question" | "little" | "stop";
export const KINDS: TalkKind[] = ["people", "action", "describe", "thing", "social", "question", "little", "stop"];
/** Word colors (the Fitzgerald key that speech therapists use): people yellow, actions green,
 *  describing blue, things orange, social pink, questions purple, little words gray, stop red. */
export const KIND_INFO: Record<TalkKind, { name: string; light: string; edge: string; dark: string }> = {
  people: { name: "People", light: "#fff4c7", edge: "#f0c419", dark: "#3d3412" },
  action: { name: "Actions", light: "#ddf6e0", edge: "#3fbf5f", dark: "#173823" },
  describe: { name: "Describing", light: "#deebff", edge: "#4a8af4", dark: "#172c4d" },
  thing: { name: "Things", light: "#ffe7d4", edge: "#f28b3c", dark: "#43281a" },
  social: { name: "Social", light: "#ffe1ee", edge: "#ec5f99", dark: "#45182e" },
  question: { name: "Questions", light: "#eee5ff", edge: "#9466f2", dark: "#2e2150" },
  little: { name: "Little words", light: "#eef0f4", edge: "#a2a9b6", dark: "#2a2e36" },
  stop: { name: "Stop and no", light: "#ffe2e0", edge: "#ef4c43", dark: "#4a1b19" },
};

export type TalkButton = {
  id: string;
  label: string;
  /** What it says or adds to the message, when that isn't the label ("{name}" is the person's name). */
  say?: string;
  emoji?: string;
  /** A photo (a small JPEG data URL) instead of the emoji. */
  photo?: string;
  kind: TalkKind;
  /** Opens this board (a folder). */
  opens?: string;
  /** Says it straight away instead of adding it to the message (a whole phrase). */
  now?: boolean;
  hidden?: boolean;
};
export type TalkBoard = { id: string; name: string; emoji: string; buttons: TalkButton[]; mine?: boolean };
export type TalkPhrase = { id: string; text: string; group: string };
export type TalkVoice = "hannah" | "autumn" | "diana" | "austin" | "daniel" | "troy";
export type TalkSettings = {
  voice: TalkVoice;
  /** 0.75 to 1.5. */ rate: number;
  speakWords: boolean;
  clearAfter: boolean;
  /** 0 = automatic (by screen width), else 3 to 8. */ cols: number;
  text: "s" | "m" | "l";
  labels: boolean;
  theme: "light" | "dark" | "auto";
  /** Hold a button this long (ms) before it counts: 0, 300, 600 or 1000. */ hold: number;
  /** Ignore a second tap within this many ms: 0, 500 or 1000. */ repeat: number;
  haptics: boolean;
  /** A 4-digit code to change boards, buttons and settings, or "" for none. */ lock: string;
  quick: string[];
};
export type AboutMe = { name: string; contact: string; phone: string; allergies: string; notes: string };
export type TalkData = { v: 1; boards: TalkBoard[]; phrases: TalkPhrase[]; recent: string[]; settings: TalkSettings; about: AboutMe; onboarded: boolean; updatedAt: string };

export const VOICES: { id: TalkVoice; name: string; blurb: string; free: boolean }[] = [
  { id: "hannah", name: "Hannah", blurb: "Warm and clear", free: true },
  { id: "austin", name: "Austin", blurb: "Friendly and easy", free: true },
  { id: "autumn", name: "Autumn", blurb: "Calm and gentle", free: false },
  { id: "diana", name: "Diana", blurb: "Bright and lively", free: false },
  { id: "daniel", name: "Daniel", blurb: "Deep and steady", free: false },
  { id: "troy", name: "Troy", blurb: "Young and upbeat", free: false },
];
export const isVoice = (v: unknown): v is TalkVoice => VOICES.some((x) => x.id === v);

/** Arise Talk Premium. Talking itself is always free: Premium adds the AI helpers, the other voices and photos. */
export const PREMIUM = { name: "Arise Talk Premium", monthCents: 799, yearCents: 5999, trialDays: 7 } as const;
export const PREMIUM_PERKS = [
  { icon: "ear", title: "Listen and reply", text: "It hears what someone says to you and offers replies to tap." },
  { icon: "sparkles", title: "Smart sentences", text: "Turns a few words into a full sentence, said naturally." },
  { icon: "camera", title: "Snap to talk", text: "Take a photo and get words and phrases about what's in it." },
  { icon: "voices", title: "All six AI voices", text: "Autumn, Diana, Daniel and Troy, as well as Hannah and Austin." },
  { icon: "image", title: "Your own photos", text: "Put real photos of people, places and things on buttons." },
] as const;

// ——— The words ———————————————————————————————————————————————————————————————————————————————————
type Row = [label: string, emoji?: string, kind?: TalkKind, say?: string, now?: boolean];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function board(id: string, name: string, emoji: string, kind: TalkKind, rows: Row[]): TalkBoard {
  return { id, name, emoji, buttons: rows.map(([label, e, k, say, now]) => ({ id: `${id}.${slug(label)}`, label, ...(e ? { emoji: e } : {}), kind: k ?? kind, ...(say ? { say } : {}), ...(now ? { now: true } : {}) })) };
}

/** The core words: the few hundred everyday words most of what people say is made from, five to a
 *  row by color, so the same word is always in the same place. */
const CORE = board("core", "Core", "⭐", "little", [
  ["I", "🙋", "people"], ["you", "👉", "people"], ["he", "👦", "people"], ["she", "👧", "people"], ["we", "👫", "people"],
  ["want", "🤲", "action"], ["need", "❗", "action"], ["like", "❤️", "action"], ["go", "🚶", "action"], ["help", "🤝", "action"],
  ["eat", "🍽️", "action"], ["drink", "🥤", "action"], ["play", "🧸", "action"], ["feel", "💗", "action"], ["look", "👀", "action"],
  ["get", "🙌", "action"], ["make", "🛠️", "action"], ["do", "✔️", "action"], ["have", "👐", "action"], ["stop", "✋", "stop"],
  ["more", "➕", "describe"], ["all done", "🏁", "describe"], ["good", "😊", "describe"], ["bad", "😣", "describe"], ["different", "🔀", "describe"],
  ["what", "❓", "question"], ["where", "📍", "question"], ["who", "🧑", "question"], ["when", "⏰", "question"], ["why", "🤷", "question"],
  ["yes", "👍", "social"], ["no", "👎", "stop"], ["please", "🙏", "social"], ["thank you", "💐", "social"], ["hi", "👋", "social"],
  ["not", "🚫", "stop"], ["it", "📦"], ["that", "👆"], ["in", "📥"], ["on", "🔛"],
  ["is", undefined], ["to", undefined], ["the", undefined], ["a", undefined], ["and", undefined],
  ["up", "⬆️"], ["down", "⬇️"], ["here", "📌"], ["now", "⏱️", "describe"], ["again", "🔁", "describe"],
]);

const BOARDS: TalkBoard[] = [
  CORE,
  board("social", "Social", "👋", "social", [
    ["hello", "👋"], ["goodbye", "🖐️"], ["please", "🙏"], ["thank you", "💐"], ["sorry", "😔"],
    ["yes", "👍"], ["no", "👎", "stop"], ["maybe", "🤔"], ["okay", "👌"], ["I don't know", "🤷"],
    ["How are you?", "🙂", "question", undefined, true], ["I'm good", "😊", undefined, "I'm good, thanks.", true], ["My name is…", "🙋", undefined, "My name is {name}.", true], ["What's your name?", "🏷️", "question", undefined, true], ["Nice to meet you", "🤝", undefined, "Nice to meet you!", true],
    ["excuse me", "🙋‍♀️"], ["you're welcome", "🤗"], ["me too", "🙌"], ["my turn", "☝️"], ["your turn", "👉"],
    ["I love you", "❤️", undefined, "I love you.", true], ["That's funny!", "😂", undefined, undefined, true], ["Cool!", "😎", undefined, undefined, true], ["Wait a minute", "⏳", undefined, "Wait a minute, please.", true], ["Leave me alone", "🚪", "stop", "Please leave me alone.", true],
    ["good morning", "🌅"], ["good night", "🌙"], ["see you later", "🚶"], ["no thanks", "🙅", "stop"], ["I need a break", "🛑", "stop", "I need a break.", true],
  ]),
  board("feelings", "Feelings", "😊", "describe", [
    ["happy", "😀"], ["sad", "😢"], ["angry", "😠"], ["scared", "😨"], ["tired", "😴"],
    ["sick", "🤒"], ["hurt", "🤕"], ["bored", "😑"], ["excited", "🤩"], ["calm", "😌"],
    ["worried", "😟"], ["frustrated", "😤"], ["silly", "🤪"], ["proud", "🥳"], ["lonely", "😔"],
    ["confused", "😕"], ["surprised", "😲"], ["embarrassed", "😳"], ["nervous", "😬"], ["okay", "👌"],
    ["hungry", "😋"], ["thirsty", "🥵"], ["hot", "🔥"], ["cold", "🥶"], ["in pain", "😣"],
    ["I feel", "💗", "action"], ["I'm", "🙋", "people", "I am"], ["not", "🚫", "stop"], ["a little", "🤏"], ["very", "⭐"],
  ]),
  board("food", "Food", "🍎", "thing", [
    ["breakfast", "🌅"], ["lunch", "🕛"], ["dinner", "🌙"], ["snack", "🥨"], ["hungry", "😋", "describe"],
    ["apple", "🍎"], ["banana", "🍌"], ["orange", "🍊"], ["grapes", "🍇"], ["strawberries", "🍓"],
    ["watermelon", "🍉"], ["bread", "🍞"], ["cereal", "🥣"], ["eggs", "🍳"], ["pancakes", "🥞"],
    ["sandwich", "🥪"], ["pizza", "🍕"], ["burger", "🍔"], ["fries", "🍟"], ["chicken", "🍗"],
    ["pasta", "🍝"], ["rice", "🍚"], ["soup", "🍲"], ["salad", "🥗"], ["taco", "🌮"],
    ["hot dog", "🌭"], ["cheese", "🧀"], ["carrots", "🥕"], ["broccoli", "🥦"], ["corn", "🌽"],
    ["cookie", "🍪"], ["cake", "🍰"], ["ice cream", "🍨"], ["chocolate", "🍫"], ["candy", "🍬"],
    ["popcorn", "🍿"], ["noodles", "🍜"], ["sushi", "🍣"], ["fish", "🐟"], ["yogurt", "🥄"],
  ]),
  board("drinks", "Drinks", "🧃", "thing", [
    ["water", "💧"], ["juice", "🧃"], ["milk", "🥛"], ["chocolate milk", "🍫"], ["soda", "🥤"],
    ["tea", "🍵"], ["coffee", "☕"], ["smoothie", "🍹"], ["lemonade", "🍋"], ["hot chocolate", "☕"],
    ["ice", "🧊"], ["straw", "🥤"], ["cup", "🥛"], ["thirsty", "🥵", "describe"], ["more", "➕", "describe"],
  ]),
  board("people", "People", "👨‍👩‍👧", "people", [
    ["me", "🙋"], ["you", "👉"], ["mom", "👩"], ["dad", "👨"], ["sister", "👧"],
    ["brother", "👦"], ["baby", "👶"], ["grandma", "👵"], ["grandpa", "👴"], ["aunt", "👩‍🦰"],
    ["uncle", "👨‍🦱"], ["friend", "🧑‍🤝‍🧑"], ["teacher", "🧑‍🏫"], ["doctor", "🧑‍⚕️"], ["nurse", "👩‍⚕️"],
    ["therapist", "🧑‍💼"], ["family", "👪"], ["everyone", "👥"], ["they", "👥"], ["pet", "🐾"],
    ["my", "🫵"], ["your", "👉"], ["his", "👦"], ["her", "👧"], ["our", "👫"],
  ]),
  board("places", "Places", "🏠", "thing", [
    ["home", "🏠"], ["school", "🏫"], ["work", "💼"], ["bathroom", "🚽"], ["bedroom", "🛏️"],
    ["kitchen", "🍳"], ["outside", "🌳"], ["park", "🏞️"], ["store", "🛒"], ["restaurant", "🍽️"],
    ["hospital", "🏥"], ["doctor's office", "🩺"], ["car", "🚗"], ["bus", "🚌"], ["church", "⛪"],
    ["library", "📚"], ["playground", "🎠"], ["pool", "🏊"], ["beach", "🏖️"], ["gym", "🏋️"],
    ["grandma's house", "🏡"], ["friend's house", "🏘️"], ["movies", "🎬"], ["mall", "🛍️"], ["go to", "🚶", "action"],
  ]),
  board("actions", "Actions", "🏃", "action", [
    ["come", "👋"], ["give", "🎁"], ["take", "✊"], ["open", "🔓"], ["close", "🔒"],
    ["put", "📥"], ["read", "📖"], ["watch", "📺"], ["listen", "🎧"], ["talk", "🗣️"],
    ["sleep", "😴"], ["sit", "🪑"], ["stand", "🧍"], ["walk", "🚶"], ["run", "🏃"],
    ["wash", "🧼"], ["brush", "🪥"], ["wait", "⏳"], ["turn", "🔄"], ["try", "🎯"],
    ["finish", "🏁"], ["think", "💭"], ["know", "💡"], ["say", "💬"], ["see", "👀"],
    ["hug", "🤗"], ["buy", "💳"], ["call", "📞"], ["ride", "🚲"], ["swim", "🏊"],
    ["draw", "✏️"], ["write", "📝"], ["cook", "🍳"], ["clean", "🧹"], ["fix", "🔧"],
    ["find", "🔍"], ["show", "🖼️"], ["tell", "🗨️"], ["love", "❤️"], ["share", "🤲"],
  ]),
  board("describe", "Describe", "🎨", "describe", [
    ["big", "🐘"], ["little", "🐭"], ["hot", "🔥"], ["cold", "🥶"], ["fast", "⚡"],
    ["slow", "🐢"], ["loud", "📢"], ["quiet", "🤫"], ["clean", "✨"], ["dirty", "🟤"],
    ["wet", "💦"], ["dry", "🏜️"], ["soft", "🧸"], ["hard", "🪨"], ["full", "🈵"],
    ["empty", "⭕"], ["new", "🆕"], ["old", "🕰️"], ["nice", "😊"], ["funny", "😂"],
    ["easy", "👌"], ["same", "👯"], ["right", "✅"], ["wrong", "❌", "stop"], ["broken", "💔"],
    ["all", "💯"], ["some", "🔹"], ["too", "➕"], ["very", "⭐"], ["more", "➕"],
  ]),
  board("questions", "Questions", "❓", "question", [
    ["what", "❓"], ["where", "📍"], ["who", "🧑"], ["when", "⏰"], ["why", "🤷"],
    ["how", "🛠️"], ["which", "🔀"], ["how many", "🔢"], ["how much", "💲"], ["can I", "🙋"],
    ["can you", "👉"], ["do you", "🤔"], ["are you", "🙂"], ["is it", "📦"], ["what's that?", "👆", undefined, "What's that?", true],
    ["Where is…", "📍", undefined, "Where is"], ["What time is it?", "⏰", undefined, undefined, true], ["What happened?", "😮", undefined, undefined, true], ["Are you okay?", "💗", undefined, undefined, true], ["Can I have some?", "🙏", undefined, undefined, true],
    ["What are we doing?", "📋", undefined, undefined, true], ["Can I go?", "🚪", undefined, undefined, true], ["What's for dinner?", "🍽️", undefined, undefined, true], ["Can you help me?", "🤝", undefined, undefined, true], ["Say it again?", "🔁", undefined, "Can you say that again?", true],
  ]),
  board("time", "Time", "🕒", "describe", [
    ["now", "⏱️"], ["later", "⏳"], ["soon", "🔜"], ["today", "📅"], ["tomorrow", "➡️"],
    ["yesterday", "⬅️"], ["morning", "🌅"], ["afternoon", "☀️"], ["night", "🌙"], ["weekend", "🎉"],
    ["first", "1️⃣"], ["next", "⏭️"], ["last", "🔚"], ["before", "⏪"], ["after", "⏩"],
    ["always", "♾️"], ["never", "🚫", "stop"], ["minute", "⏲️"], ["hour", "🕐"], ["day", "📆"],
    ["Monday", undefined], ["Tuesday", undefined], ["Wednesday", undefined], ["Thursday", undefined], ["Friday", undefined],
    ["Saturday", undefined], ["Sunday", undefined], ["birthday", "🎂"], ["holiday", "🎄"], ["week", "🗓️"],
  ]),
  board("body", "Body and health", "🩺", "thing", [
    ["head", "🙆"], ["eyes", "👀"], ["ears", "👂"], ["nose", "👃"], ["mouth", "👄"],
    ["teeth", "🦷"], ["throat", "🗣️"], ["tummy", "🤰"], ["back", "🔙"], ["chest", "🫁"],
    ["arm", "💪"], ["hand", "✋"], ["leg", "🦵"], ["foot", "🦶"], ["skin", "🖐️"],
    ["hurts", "🤕", "describe"], ["itchy", "🐜", "describe"], ["dizzy", "😵", "describe"], ["sick", "🤒", "describe"], ["throw up", "🤮", "action"],
    ["medicine", "💊"], ["bandage", "🩹"], ["doctor", "🧑‍⚕️", "people"], ["toilet", "🚽"], ["pee", "🚻", "action"],
    ["poop", "💩", "action"], ["period", "🩸"], ["allergy", "🤧"], ["breathe", "🌬️", "action"], ["glasses", "👓"],
    ["It hurts here", "👇", "stop", "It hurts here.", true], ["I need my medicine", "💊", undefined, "I need my medicine.", true], ["I feel sick", "🤒", "describe", "I feel sick.", true], ["Call my doctor", "📞", "action", "Please call my doctor.", true], ["I'm allergic", "🤧", "stop", "I'm allergic to {allergies}.", true],
  ]),
  board("activities", "Activities", "⚽", "thing", [
    ["play", "🧸", "action"], ["games", "🎮"], ["tablet", "📱"], ["TV", "📺"], ["music", "🎵"],
    ["movie", "🎬"], ["book", "📖"], ["puzzle", "🧩"], ["blocks", "🧱"], ["ball", "⚽"],
    ["art", "🎨"], ["color", "🖍️", "action"], ["dance", "💃", "action"], ["sing", "🎤", "action"], ["bike", "🚲"],
    ["swing", "🎠"], ["walk", "🚶", "action"], ["cards", "🃏"], ["video games", "🕹️"], ["videos", "🎞️"],
    ["phone", "📱"], ["computer", "💻"], ["camera", "📷"], ["sports", "🏅"], ["basketball", "🏀"],
    ["football", "🏈"], ["soccer", "⚽"], ["baseball", "⚾"], ["yoga", "🧘"], ["bath", "🛁"],
  ]),
  board("clothes", "Clothes", "👕", "thing", [
    ["shirt", "👕"], ["pants", "👖"], ["shorts", "🩳"], ["dress", "👗"], ["jacket", "🧥"],
    ["socks", "🧦"], ["shoes", "👟"], ["boots", "🥾"], ["hat", "🧢"], ["gloves", "🧤"],
    ["scarf", "🧣"], ["pajamas", "🌙"], ["underwear", "🩲"], ["swimsuit", "🩱"], ["backpack", "🎒"],
    ["get dressed", "👔", "action"], ["change", "🔄", "action"], ["too big", "🐘", "describe"], ["too small", "🐭", "describe"], ["I'm cold", "🥶", "describe", "I'm cold.", true],
  ]),
  board("school", "School and work", "🎒", "thing", [
    ["school", "🏫"], ["class", "🧑‍🏫"], ["homework", "📝"], ["test", "📄"], ["pencil", "✏️"],
    ["paper", "📄"], ["book", "📚"], ["computer", "💻"], ["lunch", "🥪"], ["recess", "🛝"],
    ["break", "☕"], ["work", "💼"], ["meeting", "👥"], ["email", "📧"], ["phone", "📞"],
    ["I don't understand", "🤔", "question", "I don't understand.", true], ["Say it again, please", "🔁", "social", "Can you say that again, please?", true], ["Slow down, please", "🐢", "social", "Please slow down.", true], ["I'm finished", "🏁", "describe", "I'm finished.", true], ["I need help", "🤝", "action", "I need help, please.", true],
  ]),
  board("animals", "Animals", "🐶", "thing", [
    ["dog", "🐶"], ["cat", "🐱"], ["fish", "🐟"], ["bird", "🐦"], ["horse", "🐴"],
    ["cow", "🐮"], ["pig", "🐷"], ["chicken", "🐔"], ["duck", "🦆"], ["sheep", "🐑"],
    ["rabbit", "🐰"], ["mouse", "🐭"], ["bear", "🐻"], ["lion", "🦁"], ["tiger", "🐯"],
    ["elephant", "🐘"], ["monkey", "🐒"], ["giraffe", "🦒"], ["frog", "🐸"], ["turtle", "🐢"],
    ["snake", "🐍"], ["butterfly", "🦋"], ["bug", "🐛"], ["dinosaur", "🦖"], ["unicorn", "🦄"],
    ["shark", "🦈"], ["whale", "🐳"], ["penguin", "🐧"], ["owl", "🦉"], ["zebra", "🦓"],
  ]),
  board("colors", "Colors", "🌈", "describe", [
    ["red", "🔴"], ["orange", "🟠"], ["yellow", "🟡"], ["green", "🟢"], ["blue", "🔵"],
    ["purple", "🟣"], ["pink", "💗"], ["brown", "🟤"], ["black", "⚫"], ["white", "⚪"],
    ["gray", "🌫️"], ["gold", "🥇"], ["silver", "🥈"], ["rainbow", "🌈"], ["color", "🎨", "action"],
  ]),
  board("numbers", "Numbers", "🔢", "describe", [
    ["zero", "0️⃣", undefined, "0"], ["one", "1️⃣", undefined, "1"], ["two", "2️⃣", undefined, "2"], ["three", "3️⃣", undefined, "3"], ["four", "4️⃣", undefined, "4"],
    ["five", "5️⃣", undefined, "5"], ["six", "6️⃣", undefined, "6"], ["seven", "7️⃣", undefined, "7"], ["eight", "8️⃣", undefined, "8"], ["nine", "9️⃣", undefined, "9"],
    ["ten", "🔟", undefined, "10"], ["a lot", "💯"], ["a little", "🤏"], ["how many", "🔢", "question"], ["more", "➕"],
  ]),
  board("weather", "Weather", "☀️", "thing", [
    ["sunny", "☀️", "describe"], ["cloudy", "☁️", "describe"], ["rain", "🌧️"], ["snow", "❄️"], ["windy", "💨", "describe"],
    ["storm", "⛈️"], ["hot", "🔥", "describe"], ["cold", "🥶", "describe"], ["warm", "🌤️", "describe"], ["umbrella", "☂️"],
    ["rainbow", "🌈"], ["thunder", "⚡"], ["fog", "🌫️"], ["outside", "🌳"], ["coat", "🧥"],
  ]),
];

/** Ready-made phrases, by group. "{name}", "{contact}" and "{allergies}" come from About me. */
const PHRASES: [group: string, texts: string[]][] = [
  ["Quick", ["Yes.", "No.", "Help, please.", "Wait.", "Stop.", "I don't know."]],
  ["About me", ["My name is {name}.", "I use this app to talk.", "Please give me time to answer.", "Please ask me yes or no questions.", "I understand you. I just can't say it out loud.", "Please talk to me, not about me."]],
  ["Needs", ["I need to use the bathroom.", "I'm hungry.", "I'm thirsty.", "I'm tired.", "I need a break.", "I'm in pain.", "I need help, please.", "I need my medicine.", "I'm cold.", "I'm hot.", "Can you help me?", "Please wait for me."]],
  ["Feelings", ["I'm happy.", "I'm frustrated.", "I'm not okay.", "I feel sick.", "I'm scared.", "I'm excited!", "I'm sad.", "I'm okay."]],
  ["Chat", ["Hi! How are you?", "I'm good, thanks. How are you?", "That's so funny!", "Tell me more.", "Me too!", "Nice to meet you.", "I love you.", "Thank you so much.", "See you later!", "What did you do today?"]],
  ["Medical", ["I have pain here.", "It hurts a lot.", "It's a little better.", "I'm allergic to {allergies}.", "Please call {contact}.", "I need to see a doctor.", "I can hear you fine.", "Please explain that again, slowly."]],
  ["Out and about", ["Can I have the check, please?", "I'd like to order this.", "How much is it?", "Where is the bathroom?", "Can you say that again?", "Please speak slowly.", "No, thank you.", "Excuse me."]],
];

export const DEFAULT_SETTINGS: TalkSettings = {
  voice: "hannah", rate: 1, speakWords: true, clearAfter: false, cols: 0, text: "m", labels: true, theme: "light",
  hold: 0, repeat: 0, haptics: true, lock: "", quick: [],
};
const EMPTY_ABOUT: AboutMe = { name: "", contact: "", phone: "", allergies: "", notes: "" };

export function starterPhrases(): TalkPhrase[] {
  return PHRASES.flatMap(([group, texts]) => texts.map((text, i) => ({ id: `${slug(group)}-${i}`, text, group })));
}
export function starterData(): TalkData {
  const phrases = starterPhrases();
  return {
    v: 1, boards: BOARDS.map((b) => ({ ...b, buttons: b.buttons.map((x) => ({ ...x })) })), phrases, recent: [],
    settings: { ...DEFAULT_SETTINGS, quick: phrases.filter((p) => p.group === "Quick").map((p) => p.id) },
    about: { ...EMPTY_ABOUT }, onboarded: false, updatedAt: new Date(0).toISOString(),
  };
}
export const BUILT_IN_BOARD_IDS = BOARDS.map((b) => b.id);
export const builtInBoard = (id: string) => BOARDS.find((b) => b.id === id);

// ——— Saving and loading safely ————————————————————————————————————————————————————————————————————
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const LIMITS = { boards: 120, buttons: 150, phrases: 600, recent: 60, photo: 90_000, label: 40, say: 300, phrase: 300 } as const;

function cleanButton(raw: any, i: number, boardId: string): TalkButton | null {
  const label = str(raw?.label, LIMITS.label);
  if (!label) return null;
  const b: TalkButton = { id: str(raw?.id, 80) || `${boardId}.b${i}`, label, kind: KINDS.includes(raw?.kind) ? raw.kind : "little" };
  const say = str(raw?.say, LIMITS.say); if (say && say !== label) b.say = say;
  const emoji = str(raw?.emoji, 16); if (emoji) b.emoji = emoji;
  if (typeof raw?.photo === "string" && raw.photo.length <= LIMITS.photo && PHOTO.test(raw.photo)) b.photo = raw.photo;
  const opens = str(raw?.opens, 80); if (opens) b.opens = opens;
  if (raw?.now === true) b.now = true;
  if (raw?.hidden === true) b.hidden = true;
  return b;
}
/** Anything read back from storage or a backup, made safe: unknown fields dropped, sizes capped. */
export function cleanTalk(raw: any): TalkData {
  const start = starterData();
  if (!raw || typeof raw !== "object" || raw.v !== 1) return start;
  const seen = new Set<string>();
  const boards: TalkBoard[] = (Array.isArray(raw.boards) ? raw.boards : []).slice(0, LIMITS.boards).flatMap((b: any) => {
    const id = str(b?.id, 80); if (!id || seen.has(id)) return [];
    seen.add(id);
    const ids = new Set<string>();
    const buttons = (Array.isArray(b?.buttons) ? b.buttons : []).slice(0, LIMITS.buttons).map((x: any, i: number) => cleanButton(x, i, id)).filter((x: TalkButton | null): x is TalkButton => !!x && !ids.has(x.id) && !!ids.add(x.id));
    return [{ id, name: str(b?.name, 40) || "Board", emoji: str(b?.emoji, 16) || "📁", buttons, ...(b?.mine ? { mine: true } : {}) }];
  });
  if (!boards.some((b) => b.id === "core")) boards.unshift(start.boards[0]);
  const ids = new Set(boards.map((b) => b.id));
  for (const b of boards) for (const x of b.buttons) if (x.opens && !ids.has(x.opens)) delete x.opens;
  const phrases: TalkPhrase[] = (Array.isArray(raw.phrases) ? raw.phrases : []).slice(0, LIMITS.phrases).flatMap((p: any, i: number) => {
    const text = str(p?.text, LIMITS.phrase); return text ? [{ id: str(p?.id, 80) || `p${i}`, text, group: str(p?.group, 30) || "Mine" }] : [];
  });
  const s = raw.settings || {};
  const pick = <T,>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d);
  const settings: TalkSettings = {
    voice: isVoice(s.voice) ? s.voice : DEFAULT_SETTINGS.voice,
    rate: Math.min(1.5, Math.max(0.75, Number(s.rate) || 1)),
    speakWords: s.speakWords !== false, clearAfter: s.clearAfter === true,
    cols: Number.isInteger(s.cols) && (s.cols === 0 || (s.cols >= 3 && s.cols <= 8)) ? s.cols : 0,
    text: pick(s.text, ["s", "m", "l"] as const, "m"), labels: s.labels !== false,
    theme: pick(s.theme, ["light", "dark", "auto"] as const, "light"),
    hold: pick(Number(s.hold), [0, 300, 600, 1000] as const, 0), repeat: pick(Number(s.repeat), [0, 500, 1000] as const, 0),
    haptics: s.haptics !== false, lock: /^\d{4}$/.test(String(s.lock || "")) ? String(s.lock) : "",
    quick: (Array.isArray(s.quick) ? s.quick : []).map((q: unknown) => str(q, 80)).filter((q: string) => phrases.some((p) => p.id === q)).slice(0, 8),
  };
  const a = raw.about || {};
  return {
    v: 1, boards, phrases, settings,
    recent: (Array.isArray(raw.recent) ? raw.recent : []).map((r: unknown) => str(r, LIMITS.phrase)).filter(Boolean).slice(0, LIMITS.recent),
    about: { name: str(a.name, 60), contact: str(a.contact, 60), phone: str(a.phone, 30).replace(/[^\d+()\-\s.]/g, ""), allergies: str(a.allergies, 120), notes: str(a.notes, 400) },
    onboarded: raw.onboarded === true,
    updatedAt: typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : start.updatedAt,
  };
}

// ——— Saying things ————————————————————————————————————————————————————————————————————————————————
/** "{name}" and friends filled in from About me (left out politely when there's nothing to fill). */
export function fillIn(text: string, about: AboutMe): string {
  return text
    .replace(/\{name\}/g, about.name || "…")
    .replace(/\{contact\}/g, about.contact || "my emergency contact")
    .replace(/\{allergies\}/g, about.allergies || "something");
}
/** What a button says. */
export const spoken = (b: Pick<TalkButton, "label" | "say">, about: AboutMe) => fillIn(b.say || b.label, about);

const QUESTION_START = /^(what|where|who|when|why|how|which|can|could|do|does|did|is|are|am|will|would|should|may)\b/i;
/** The message as one line to say: words joined, "I" capitalized, a full stop or a question mark at the end. */
export function messageText(words: string[]): string {
  let t = words.map((w) => w.trim()).filter(Boolean).join(" ").replace(/\s+([,.!?])/g, "$1").replace(/\bi\b/g, "I");
  if (!t) return "";
  t = t[0].toUpperCase() + t.slice(1);
  if (!/[.!?…]$/.test(t)) t += QUESTION_START.test(t) ? "?" : ".";
  return t;
}

// ——— Word forms (tap and hold a word) ————————————————————————————————————————————————————————————————
const IRREGULAR: Record<string, string[]> = {
  i: ["me", "my", "mine", "myself"], you: ["your", "yours", "yourself"], he: ["him", "his", "himself"], she: ["her", "hers", "herself"],
  we: ["us", "our", "ours"], they: ["them", "their", "theirs"], it: ["its", "itself"],
  go: ["goes", "going", "went", "gone"], do: ["does", "doing", "did", "done", "don't"], have: ["has", "having", "had"],
  eat: ["eats", "eating", "ate", "eaten"], drink: ["drinks", "drinking", "drank"], get: ["gets", "getting", "got"],
  make: ["makes", "making", "made"], feel: ["feels", "feeling", "felt"], see: ["sees", "seeing", "saw", "seen"],
  give: ["gives", "giving", "gave", "given"], take: ["takes", "taking", "took", "taken"], come: ["comes", "coming", "came"],
  run: ["runs", "running", "ran"], sit: ["sits", "sitting", "sat"], stand: ["stands", "standing", "stood"],
  sleep: ["sleeps", "sleeping", "slept"], read: ["reads", "reading"], write: ["writes", "writing", "wrote"],
  say: ["says", "saying", "said"], tell: ["tells", "telling", "told"], think: ["thinks", "thinking", "thought"],
  know: ["knows", "knowing", "knew"], buy: ["buys", "buying", "bought"], find: ["finds", "finding", "found"],
  is: ["am", "are", "was", "were", "be", "being", "isn't"], can: ["can't", "could", "couldn't"], want: ["wants", "wanting", "wanted", "don't want"],
  like: ["likes", "liking", "liked", "don't like"], need: ["needs", "needing", "needed", "don't need"],
  good: ["better", "best"], bad: ["worse", "worst"], big: ["bigger", "biggest"], little: ["littler", "smaller", "smallest"],
  child: ["children"], person: ["people"], man: ["men"], woman: ["women"], foot: ["feet"], tooth: ["teeth"], mouse: ["mice"],
  not: ["don't", "can't", "won't", "isn't"], that: ["this", "these", "those"], a: ["an"],
};
/** One syllable ending consonant-vowel-consonant (stop, big): the last letter doubles (stopping, bigger). */
const CVC = /^[^aeiou]*[aeiou][bdgmnprt]$/;
/** Other forms of a word: go → goes, going, went, gone; cat → cats; happy → happier. */
export function wordForms(word: string, kind?: TalkKind): string[] {
  const w = word.trim().toLowerCase();
  if (!w || /\s/.test(w) && !IRREGULAR[w]) return [];
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (kind === "action") {
    const ing = w.endsWith("e") && !w.endsWith("ee") ? w.slice(0, -1) + "ing" : CVC.test(w) ? w + w.slice(-1) + "ing" : w + "ing";
    const ed = w.endsWith("e") ? w + "d" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ied" : CVC.test(w) ? w + w.slice(-1) + "ed" : w + "ed";
    return [plural(w), ing, ed];
  }
  if (kind === "describe") {
    if (w.length > 7 || w.split(/\s/).length > 1) return [];
    const base = /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "i" : w.endsWith("e") ? w.slice(0, -1) : CVC.test(w) ? w + w.slice(-1) : w;
    return [base + "er", base + "est"];
  }
  if (kind === "thing" || kind === "people") return [plural(w)];
  return [];
}
function plural(w: string) {
  if (/(s|x|z|ch|sh)$/.test(w)) return w + "es";
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
}

// ——— What might come next (free, on the phone) —————————————————————————————————————————————————————
const STARTS = "I want|I need|I like|I don't|I feel|I'm|I am|I can|Can I|Can you|I want to|I need to|I want to go|Where is|What is|Let's|Do you|Are you|Please|Thank you|I love|Help me|Give me|I have|It is|That is|You are|We are|Look at";
const FOLLOW: Record<string, string[]> = {
  i: ["want", "need", "like", "feel", "am", "don't", "can", "love", "have", "think"], you: ["want", "are", "can", "like", "need", "do"],
  want: ["to", "more", "that", "it", "a", "the", "some"], need: ["to", "help", "a", "the", "more", "my"], like: ["it", "that", "to", "the", "you"],
  to: ["go", "eat", "drink", "play", "see", "sleep", "the", "watch", "talk", "be"], go: ["to", "home", "outside", "now", "there", "with"],
  feel: ["sick", "happy", "sad", "tired", "good", "bad", "better"], am: ["happy", "tired", "hungry", "okay", "not", "sad", "done"],
  is: ["it", "the", "that", "good", "my", "not"], the: ["bathroom", "car", "door", "TV", "store", "park"], more: ["please", "food", "water", "time"],
  help: ["me", "please", "with"], can: ["I", "you", "we", "have"], what: ["is", "are", "time", "happened", "do"], where: ["is", "are", "do", "we"],
  please: ["help", "stop", "wait", "come", "give"], not: ["now", "that", "good", "okay", "want"], my: ["turn", "name", "mom", "dad", "friend"],
  eat: ["now", "lunch", "dinner", "something", "more"], drink: ["water", "juice", "milk", "more"], play: ["with", "outside", "a", "games"],
  all: ["done", "of"], thank: ["you"], how: ["are", "much", "many", "do"], who: ["is", "are"], "don't": ["want", "like", "know", "need"],
};
/** Up to `n` likely next words, from what was just said and what this person says often. */
export function nextWords(words: string[], recent: string[], n = 6): string[] {
  const last = (words[words.length - 1] || "").toLowerCase().split(/\s+/).pop() || "";
  const out: string[] = [];
  const add = (w: string) => { const x = w.trim(); if (x && !out.some((o) => o.toLowerCase() === x.toLowerCase()) && out.length < n) out.push(x); };
  // What came after this word in their own recent messages comes first.
  for (const r of recent) {
    const t = r.replace(/[.!?]/g, "").split(/\s+/);
    for (let i = 0; i < t.length - 1; i++) if (t[i].toLowerCase() === last) add(t[i + 1]);
  }
  if (!last) { for (const s of STARTS.split("|")) add(s); return out; }
  for (const w of FOLLOW[last] ?? []) add(w);
  return out;
}
