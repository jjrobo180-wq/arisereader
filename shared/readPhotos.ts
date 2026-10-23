// Real photos for every A.R.I.S.E. Original (the 5-Minute Reads shelf and the library).
// A story about a person shows that person; a story about an animal, a planet or a science idea
// shows a real photo of it. Nothing here is a drawing.
//
// `wikipediaTitle` is the Wikipedia page whose main photo we use (server/newsPhotos.ts checks the
// photo on Wikimedia Commons and only uses it when its license lets anyone reuse it).
// `alsoTry` are more pages to try, in order, when the first has no reusable photo (many pages about
// a league or a tournament only have a logo).
// `search` is a last resort: a Wikimedia Commons search for a free photo of the subject, and
// `mustMention` is a word the photo's file name has to contain, so a search can't pick a stranger.

export type ReadPhoto = { wikipediaTitle: string; alt: string; focus?: string; alsoTry?: string[]; search?: string; mustMention?: string };

/** Photos for the stories that didn't have one yet, by story slug. */
export const READ_PHOTOS: Record<string, ReadPhoto> = {
  "comedy-wildlife-2026": { wikipediaTitle: "Moose", alt: "A moose standing in a field", alsoTry: ["Red squirrel"] },
  "monarch-migration": { wikipediaTitle: "Monarch butterfly", alt: "An orange and black monarch butterfly on a flower", search: "monarch butterfly", mustMention: "monarch" },
  "new-stick-insects": { wikipediaTitle: "Phasmatodea", alt: "A stick insect that looks just like a twig", search: "stick insect", mustMention: "stick" },
  "new-wild-cat-tilcayo": { wikipediaTitle: "Oncilla", alt: "An oncilla, a small spotted wild cat from South America and a close cousin of the tilcayo", alsoTry: ["Pampas cat", "Leopardus"] },
  "octopus-genius": { wikipediaTitle: "Octopus", alt: "An octopus on the sea floor", alsoTry: ["Common octopus"] },
  "matisse-painting-with-scissors": { wikipediaTitle: "Henri Matisse", alt: "A photo of the artist Henri Matisse", focus: "50% 30%" },
  "louis-braille": { wikipediaTitle: "Louis Braille", alt: "Louis Braille, who invented the braille alphabet", focus: "50% 30%", alsoTry: ["Braille"] },
  "sleep-superpower": { wikipediaTitle: "Sleep", alt: "A child sleeping", search: "sleeping child", mustMention: "sleep" },
  "why-leaves-change-color": { wikipediaTitle: "Autumn leaf color", alt: "Red, orange and yellow autumn leaves on a tree", alsoTry: ["Autumn"] },
  "libraries-on-the-move": { wikipediaTitle: "Bookmobile", alt: "A bookmobile, a library on wheels", alsoTry: ["Mobile library"], search: "bookmobile", mustMention: "bookmobile" },
  "bees-tiny-workers": { wikipediaTitle: "Western honey bee", alt: "A honey bee on a flower", alsoTry: ["Honey bee", "Bee"] },
  "new-sea-spiders": { wikipediaTitle: "Sea spider", alt: "A sea spider on the ocean floor", alsoTry: ["Pycnogonida"] },
  "math-of-a-soccer-ball": { wikipediaTitle: "Ball (association football)", alt: "A soccer ball on the grass", search: "football soccer ball grass", mustMention: "ball" },
  "spain-wins-world-cup": { wikipediaTitle: "FIFA World Cup Trophy", alt: "The FIFA World Cup trophy", alsoTry: ["Spain national football team"], search: "FIFA World Cup trophy", mustMention: "cup" },
  "a-day-on-venus": { wikipediaTitle: "Venus", alt: "The planet Venus seen from space" },
  "artemis-iii-rocket-stacking": { wikipediaTitle: "Space Launch System", alt: "NASA's Space Launch System rocket on the launch pad", alsoTry: ["Artemis program"] },
  "crew-13-record-trip": { wikipediaTitle: "International Space Station", alt: "The International Space Station orbiting Earth" },
  "saturn-opposition-2026": { wikipediaTitle: "Saturn", alt: "The planet Saturn and its rings" },
  "why-the-moon-changes-shape": { wikipediaTitle: "Moon", alt: "The full Moon", alsoTry: ["Lunar phase"] },
  "asian-games-2026-close": { wikipediaTitle: "Asian Games", alt: "Athletes at the Asian Games", alsoTry: ["2026 Asian Games"], search: "Asian Games athletics", mustMention: "asian" },
  "berlin-marathon-2026": { wikipediaTitle: "Berlin Marathon", alt: "Runners in the Berlin Marathon", search: "Berlin Marathon runners", mustMention: "marathon" },
};

/** Extra pages to try for stories whose first page often has only a logo or a drawing. */
export const READ_PHOTO_FALLBACKS: Record<string, Pick<ReadPhoto, "alsoTry" | "search" | "mustMention">> = {
  "wnba-thirtieth-season-2026": { alsoTry: ["A'ja Wilson", "Caitlin Clark"], search: "WNBA basketball game", mustMention: "wnba" },
  "spain-wins-2026-world-cup-final-story": { alsoTry: ["FIFA World Cup Trophy", "MetLife Stadium"], search: "FIFA World Cup trophy", mustMention: "cup" },
  "soccer-world-cup-how-qualifying-works": { alsoTry: ["FIFA World Cup Trophy"], search: "FIFA World Cup trophy", mustMention: "cup" },
  "first-world-cup-1930": { alsoTry: ["Estadio Centenario"] },
  "video-game-accessibility-design": { alsoTry: ["Xbox Adaptive Controller", "Video game controller"], search: "Xbox Adaptive Controller", mustMention: "controller" },
  "offside-rule-explained": { alsoTry: ["Assistant referee (association football)", "Association football"] },
  "hiccup-science": { alsoTry: ["Thoracic diaphragm"] },
  "why-curveballs-curve": { alsoTry: ["Pitcher", "Baseball"] },
  "aphmau-minecraft-worlds-friends": { search: "Aphmau", mustMention: "aphmau" },
  "dantdm-minecraft-storyteller": { search: "DanTDM", mustMention: "dantdm" },
  "pokimane-online-community": { search: "Pokimane", mustMention: "pokimane" },
  "mrbeast-videos-to-team-trees": { search: "MrBeast", mustMention: "beast" },
  "mark-rober-science-squirrels-mars": { search: "Mark Rober", mustMention: "rober" },
};
