// Animal Splash — the animals (each has a 3D model in client/src/game/splash/creatures.ts) and the speech/answer logic.
// Pure data + helpers (no DOM, no three.js) so the game and the tests share them.

export type Animal = { id: string; name: string; accepted: string[]; emoji: string; fact: string; color: number };

const A = (id: string, name: string, emoji: string, fact: string, color: number, extra: string[] = []): Animal =>
  ({ id, name, emoji, fact, color, accepted: [name, ...extra] });

export const ANIMALS: Animal[] = [
  A("duck", "duck", "🦆", "Ducks have waterproof feathers, so they stay dry in the water.", 0xffd23f, ["white duck", "ducky", "duckie"]),
  A("turtle", "turtle", "🐢", "Sea turtles can hold their breath for a long, long time.", 0x3fbf6a, ["sea turtle", "green turtle", "tortoise"]),
  A("frog", "frog", "🐸", "Frogs can breathe through their skin.", 0x7dd65a, ["dwarf frog", "froggy", "toad"]),
  A("hippo", "hippo", "🦛", "Hippos can't really swim. They walk and bounce along the river bottom!", 0xa98ad6, ["hippopotamus", "hippos"]),
  A("penguin", "penguin", "🐧", "Penguins use their wings like flippers to swim fast.", 0x4a90e2, ["emperor penguin"]),
  A("seal", "seal", "🦭", "Seals can take naps in the water.", 0x8aa0b8, ["monk seal", "sea lion"]),
  A("elephant", "elephant", "🐘", "Elephants can use their trunks like a snorkel when they swim.", 0x9aa6b2, ["elephants"]),
  A("lion", "lion", "🦁", "Lions like to stay dry, but they can swim if they need to.", 0xf2a33a, ["lions", "lion king"]),
  A("dolphin", "dolphin", "🐬", "Dolphins talk to each other with clicks and whistles.", 0x37b4ea, ["bottlenose dolphin", "dolphins"]),
  A("otter", "otter", "🦦", "Some otters hold hands when they sleep so they don't float away.", 0xb07a4a, ["river otter", "otters", "sea otter"]),
  A("crocodile", "crocodile", "🐊", "Crocodiles can float so still that they look like a log.", 0x5f8f3a, ["croc", "alligator", "gator"]),
  A("flamingo", "flamingo", "🦩", "Flamingos are pink because of the food they eat.", 0xff7ab8, ["flamingos"]),
  A("polar-bear", "polar bear", "🐻‍❄️", "Polar bears are amazing swimmers in icy water.", 0xdfeef8, ["bear", "white bear"]),
  A("beaver", "beaver", "🦫", "Beavers build homes called lodges out of sticks and mud.", 0x9a6a3a, ["beavers"]),
  A("shark", "shark", "🦈", "Sharks grow new teeth all the time.", 0x7a9ab8, ["great white shark", "great white", "sharks"]),
  A("whale", "whale", "🐋", "Whales breathe air through a blowhole on top of their head.", 0x3a6ab8, ["whales", "big fish"]),
];

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
