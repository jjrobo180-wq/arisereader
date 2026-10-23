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

/**
 * The exact Wikimedia Commons photo for every story, the same way the biographies (Bad Bunny, LeBron…)
 * already work: the browser loads the file straight from Commons, with no lookup that can fail.
 * Every file on Commons is free to reuse. These win over any page lookup above.
 */
export const READ_PHOTO_FILES: Record<string, string> = {
  "comedy-wildlife-2026": "Moose (cropped).jpg",
  "monarch-migration": "Monarch Butterfly Danaus plexippus on Echinacea purpurea 2800px.jpg",
  "new-stick-insects": "Stick insect (15048094723).jpg",
  "new-wild-cat-tilcayo": "Leopardus tilcayo (5x3 cropped).jpg",
  "octopus-genius": "Common octopus Octopus vulgaris (4681010396).jpg",
  "matisse-painting-with-scissors": "Portrait of Henri Matisse 1933 May 20.jpg",
  "louis-braille": "Louis Braille.jpg",
  "sleep-superpower": "Sleeping baby with arm extended.jpg",
  "why-leaves-change-color": "Red autumn leaves.jpg",
  "libraries-on-the-move": "Bookmobile - Fresno County Public Library (exterior).jpg",
  "bees-tiny-workers": "Honey bee on mustard flower.jpg",
  "new-sea-spiders": "Yellow Kneed Sea Spider-Calipallenid pycnogonid.jpg",
  "math-of-a-soccer-ball": "Adidas soccer ball on a grass pitch (Unsplash).jpg",
  "spain-wins-world-cup": "Spain World Cup Winners Argentina v Spain 19 July 2026-1.jpg",
  "a-day-on-venus": "Venus-real color.jpg",
  "artemis-iii-rocket-stacking": "SLS on the launchpad, two days before launch of Artemis 1.jpg",
  "crew-13-record-trip": "STS-134 International Space Station after undocking.jpg",
  "saturn-opposition-2026": "PIA05380 - Saturn from Cassini Orbiter (square).jpg",
  "why-the-moon-changes-shape": "Full Moon Luc Viatour.jpg",
  "asian-games-2026-close": "Asian Games 2018 GBK Stadium Opening 01.jpg",
  "berlin-marathon-2026": "Berlin-Marathon 2015 Runners 0.jpg",
  "first-world-cup-1930": "Uruguay goal v argentina 1930.jpg",
  "spain-wins-2026-world-cup-final-story": "Spain World Cup Winners Argentina v Spain 19 July 2026-1.jpg",
  "aja-wilson-two-ends-of-court": "A'ja Wilson (53756794398) (cropped).jpg",
  "aphmau-minecraft-worlds-friends": "Minecraft Cosplay @ Comiket 84 - Summer 2013 @ Tokyo Big Sight (9490347671).jpg",
  "one-small-step": "Aldrin Apollo 11 (jha).jpg",
  "artemis-two-moon-journey-2026": "Artemis 2 Crew Portrait.jpg",
  "auroras-lights-near-poles": "Aurora-borealis andoya.jpg",
  "axolotls-and-regrowing-limbs": "Ajolote (Ambystoma mexicanum).jpg",
  "basketball-shot-arc-physics": "Kevin Durant jumpshot.jpg",
  "beyonce-from-group-to-renaissance": "Beyonce - The Formation World Tour, at Wembley Stadium in London, England.jpg",
  "bruno-mars-performing-from-hawaii": "Bruno Mars - 24K Magic Tour 2017.jpg",
  "caitlin-clark-passing-and-shooting": "Caitlin Clark three-pointer (cropped).jpg",
  "why-cats-purr": "Orange Tabby Cat.jpg",
  "cristiano-ronaldo-practice-and-goals": "Cristiano Ronaldo 2275 (cropped).jpg",
  "why-curveballs-curve": "Baseball pitching motion 2004.jpg",
  "dantdm-minecraft-storyteller": "DanTDM @ Sportsfile (Web Summit) (cropped).jpg",
  "dia-de-los-muertos-memories": "Ofrenda Dia de Muertos.jpg",
  "soccer-world-cup-how-qualifying-works": "Luzhniki Stadium, 2018 FIFA World Cup.jpg",
  "gps-satellites-help-you-navigate": "GPS Block IIIA.jpg",
  "hangul-koreas-writing-system": "Seoul-Korean-Hangul-Insadong-Papers.jpg",
  "hiccup-science": "Enfant buvant un verre d'eau.jpg",
  "hip-hop-born-in-the-bronx": "Breakdance cypher.JPG",
  "basketball-peach-baskets": "James Naismith with a basketball.jpg",
  "jackie-robinson-42": "Jackie Robinson, Brooklyn Dodgers, 1954.jpg",
  "we-choose-the-moon": "John F. Kennedy speaks at Rice University.jpg",
  "katherine-johnson-numbers": "Katherine Johnson at NASA, in 1966.jpg",
  "katie-ledecky-lap-by-lap": "Katie Ledecky (USA) Rio 2016.jpg",
  "kente-cloth-patterns-ghana": "Kente fashion in Ghana.jpg",
  "kylian-mbappe-speed-and-timing": "Kylian Mbappé 2018.jpg",
  "lewis-hamilton-racing-decisions": "Lewis Hamilton 2022.jpg",
  "lou-gehrig-luckiest-man": "Lou Gehrig as a new Yankee 11 Jun 1923.jpg",
  "malala-one-pen": "Malala Yousafzai 2015.jpg",
  "mangroves-trees-in-saltwater": "Mangrove trees in Everglades.JPG",
  "mark-rober-science-squirrels-mars": "Mark Rober 2020.jpg",
  "mrbeast-videos-to-team-trees": "MrBeast 2023.jpg",
  "offside-rule-explained": "Assistant referee 15abr2007.jpg",
  "olivia-rodrigo-songwriter-stories": "Olivia Rodrigo at KCA 2022.jpg",
  "origami-the-math-of-folding": "Origami cranes.jpg",
  "patrick-mahomes-football-reading-defenses": "Patrick Mahomes (51615475056).jpg",
  "pele-king-of-soccer": "Pelé 1960.jpg",
  "pokimane-online-community": "Pokimane 2019.jpg",
  "rainbow-light-refraction": "Double rainbow italy.jpg",
  "rihanna-barbados-global-music": "Rihanna 2012 (Headshot).jpg",
  "how-roller-coasters-work": "Olympia Looping - steel roller coaster.jpg",
  "sabrina-carpenter-acting-to-pop": "Sabrina Carpenter - O2 Arena 2025 - 086 (cropped).jpg",
  "shacarri-richardson-speed-science": "Sha'Carri Richardson Budapest 2023.jpg",
  "skateboarding-olympic-teens": "Skateboarding at Mexico City - Ollie - 043.JPG",
  "steelpan-music-trinidad-tobago": "Steelpan Instruments at Trinidad and Tobago Carnival.jpg",
  "suni-lee-gymnastics-precision": "US Olympic Gymnast Suni Lee.jpg",
  "tacos-mexican-food-regions": "01 Tacos al Pastor.jpg",
  "how-ocean-tides-work": "Bay of Fundy - Hopewell Rocks.jpg",
  "victor-wembanyama-basketball-new-style": "Victor Wembanyama San Antonio Spurs 2024.jpg",
  "video-game-accessibility-design": "Xbox Adaptive Controller V&A.JPG",
  "wind-turbines-turning-air-to-electricity": "Rows of wind turbines at wind farm at hills.jpg",
  "wnba-thirtieth-season-2026": "WNBA Sue Bird cropped.jpg",
  "wright-brothers-first-flight": "Wright First Flight 1903Dec17 (full restore 115, colorized).jpg",
};
