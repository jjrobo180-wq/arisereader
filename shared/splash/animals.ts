// Animal Splash — the animals, their real photos (Wikimedia Commons) and the speech/answer logic.
// Pure data + helpers (no DOM, no three.js) so the game and the tests share them.

export type Animal = {
  id: string; name: string; accepted: string[]; emoji: string; fact: string; color: number;
  file: string; hash: string; credit: string;
};

const A = (id: string, name: string, emoji: string, file: string, hash: string, credit: string, fact: string, color: number, extra: string[] = []): Animal =>
  ({ id, name, emoji, file, hash, credit, fact, color, accepted: [name, ...extra] });

export const ANIMALS: Animal[] = [
  A("duck", "duck", "🦆", "White domesticated duck, stretching.jpg", "7/74", "White domesticated duck", "Ducks have waterproof feathers, so they stay dry in the water.", 0xffd23f, ["white duck", "ducky", "duckie"]),
  A("turtle", "turtle", "🐢", "Green turtle swimming in Kona May 2010.jpg", "4/41", "Green turtle", "Sea turtles can hold their breath for a long, long time.", 0x3fbf6a, ["sea turtle", "green turtle", "tortoise"]),
  A("frog", "frog", "🐸", "African dwarf frog.jpg", "2/23", "African dwarf frog", "Frogs can breathe through their skin.", 0x7dd65a, ["dwarf frog", "froggy", "toad"]),
  A("hippo", "hippo", "🦛", "Portrait Hippopotamus in the water.jpg", "f/f2", "Hippopotamus", "Hippos can't really swim. They walk and bounce along the river bottom!", 0xa98ad6, ["hippopotamus", "hippos"]),
  A("penguin", "penguin", "🐧", "Emperor Penguin Manchot empereur.jpg", "0/07", "Emperor penguin", "Penguins use their wings like flippers to swim fast.", 0x4a90e2, ["emperor penguin"]),
  A("seal", "seal", "🦭", "Hawaiian monk seal close-up (Neomonachus schauinslandi).jpg", "a/a1", "Hawaiian monk seal", "Seals can take naps in the water.", 0x8aa0b8, ["monk seal", "sea lion"]),
  A("elephant", "elephant", "🐘", "African Bush Elephants.jpg", "a/a9", "African bush elephants", "Elephants can use their trunks like a snorkel when they swim.", 0x9aa6b2, ["elephants"]),
  A("lion", "lion", "🦁", "Male Lion on Rock.jpg", "4/49", "Male lion", "Lions like to stay dry, but they can swim if they need to.", 0xf2a33a, ["lions", "lion king"]),
  A("dolphin", "dolphin", "🐬", "Bottlenose Dolphin.jpg", "9/9f", "Bottlenose dolphin", "Dolphins talk to each other with clicks and whistles.", 0x37b4ea, ["bottlenose dolphin", "dolphins"]),
  A("otter", "otter", "🦦", "River otter.jpg", "4/41", "River otter", "Some otters hold hands when they sleep so they don't float away.", 0xb07a4a, ["river otter", "otters", "sea otter"]),
  A("crocodile", "crocodile", "🐊", "Crocodile --.jpg", "b/b6", "Crocodile", "Crocodiles can float so still that they look like a log.", 0x5f8f3a, ["croc", "alligator", "gator"]),
  A("flamingo", "flamingo", "🦩", "Flamingo .jpg", "0/02", "Greater flamingo", "Flamingos are pink because of the food they eat.", 0xff7ab8, ["flamingos"]),
  A("polar-bear", "polar bear", "🐻‍❄️", "PolarBear.jpg", "c/ce", "Polar bear", "Polar bears are amazing swimmers in icy water.", 0xdfeef8, ["bear", "white bear"]),
  A("beaver", "beaver", "🦫", "Beaver.jpg", "7/77", "Beaver", "Beavers build homes called lodges out of sticks and mud.", 0x9a6a3a, ["beavers"]),
  A("shark", "shark", "🦈", "Great White Shark (Carcharodon carcharias) (32096717593).jpg", "b/b2", "Great white shark", "Sharks grow new teeth all the time.", 0x7a9ab8, ["great white shark", "great white", "sharks"]),
  A("whale", "whale", "🐋", "A Whale.jpg", "5/58", "Whale", "Whales breathe air through a blowhole on top of their head.", 0x3a6ab8, ["whales", "big fish"]),
];

/** Photo URLs to try, best first. The direct upload server allows cross-origin use (needed to draw on a 3D card). */
export function photoUrls(a: Animal, width = 500) {
  const name = a.file.replace(/ /g, "_");
  const enc = encodeURIComponent(name);
  return [
    `https://upload.wikimedia.org/wikipedia/commons/thumb/${a.hash}/${enc}/${width}px-${enc}`,
    `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(a.file)}?width=${width}`,
  ];
}
export const pageUrl = (a: Animal) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(a.file.replace(/ /g, "_"))}`;

const FILLER = /\b(it is|its|thats|that is|this is|i think|the animal is|is it|a|an|the|um|uh|oh|my|mister|mr)\b/g;
export function normalizeSpeech(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z\s]/g, " ").replace(FILLER, " ").replace(/\s+/g, " ").trim();
}
/** True when anything the child said names this animal (accepts plurals and short phrases around the word). */
export function isCorrectAnswer(transcript: string, animal: Animal) {
  const said = ` ${normalizeSpeech(transcript)} `;
  return animal.accepted.some(answer => {
    const clean = normalizeSpeech(answer);
    if (!clean) return false;
    return said.includes(` ${clean} `) || said.includes(` ${clean}s `) || said.includes(` ${clean}es `);
  });
}
/** Does what they said name a *different* animal? (so "dog" for a duck is wrong, but silence/noise just asks again) */
export function namesOtherAnimal(transcript: string, animal: Animal) {
  return ANIMALS.some(a => a.id !== animal.id && isCorrectAnswer(transcript, a) && !isCorrectAnswer(transcript, animal));
}

function rng(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
/** The correct name plus (count-1) different, clearly-different animals, shuffled. */
export function answerChoices(animal: Animal, count: number, seed = Date.now()) {
  const r = rng(seed);
  const others = ANIMALS.filter(a => a.id !== animal.id && a.name[0] !== animal.name[0]);
  const picks: string[] = [];
  while (picks.length < Math.max(1, count - 1) && others.length) picks.push(others.splice(Math.floor(r() * others.length), 1)[0].name);
  const all = [animal.name, ...picks];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}
