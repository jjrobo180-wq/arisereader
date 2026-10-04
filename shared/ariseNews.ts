// Arise News: articles readers can read right on the site. Each story becomes a 5-point quiz
// in the library (see server/ariseNews.ts), so readers earn points the same way
// they do for books: read, then pass the quiz (70% or better).
//
// Two kinds of story:
// - features are timeless (science, nature, history, the arts)
// - news reports something that really happened recently, checked against at
//   least two reliable sources, which are listed with the story
// House rules: stick to facts and neutral wording; never mock or put down any
// person or group; leave out religion, elections, political figures and wars.
// Keep paragraphs short, define harder words in `words`, and write five
// questions that can be answered from the text.

export type NewsSection = "Science" | "Animals" | "Space" | "World" | "History" | "Nature" | "Health" | "Sports" | "Arts" | "Reading";

export type NewsBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "fact"; title: string; text: string }
  | { kind: "quote"; text: string; by?: string }
  | { kind: "list"; title: string; items: string[] };

export type NewsQuestion = { question: string; options: [string, string, string, string]; correct: "A" | "B" | "C" | "D" };

export type NewsSource = { name: string; url: string };

export type NewsArticle = {
  slug: string;
  /** "news" stories report recent events and list their sources; "feature" stories are timeless. */
  kind?: "news" | "feature";
  /** Where the news happened, shown at the start of the story (e.g. "BERLIN, Germany"). */
  dateline?: string;
  sources?: NewsSource[];
  section: NewsSection;
  title: string;
  /** The one-line summary under the headline (also the library description). */
  dek: string;
  grades: string;
  publishedOn: string; // YYYY-MM-DD
  body: NewsBlock[];
  words: { word: string; meaning: string }[];
  questions: NewsQuestion[];
};

export const NEWS_AUTHOR = "Arise News";
export const NEWS_POINTS = 5;
export const NEWS_ISSUE = { number: 2, name: "October 2026", publishedOn: "2026-10-04" };

export const SECTION_COLORS: Record<NewsSection, { ink: string; tint: string; deep: string }> = {
  Science: { ink: "#0f9f9a", tint: "#d8f5f2", deep: "#06504d" },
  Animals: { ink: "#e2780c", tint: "#fdebd3", deep: "#7a3c00" },
  Space: { ink: "#5b4cf0", tint: "#e4e1fe", deep: "#271c84" },
  World: { ink: "#d61f69", tint: "#fbdce9", deep: "#74073a" },
  History: { ink: "#a1620b", tint: "#f6e7cf", deep: "#57330a" },
  Nature: { ink: "#2f9e44", tint: "#dcf3e0", deep: "#14522a" },
  Health: { ink: "#0c7fd6", tint: "#d9ecfb", deep: "#06406f" },
  Sports: { ink: "#e8590c", tint: "#fde3d3", deep: "#7b2a00" },
  Arts: { ink: "#c2255c", tint: "#f9dbe6", deep: "#6b0e31" },
  Reading: { ink: "#7048e8", tint: "#e9e1fd", deep: "#3a1d8f" },
};

const p = (text: string): NewsBlock => ({ kind: "p", text });
const h = (text: string): NewsBlock => ({ kind: "h", text });
const fact = (title: string, text: string): NewsBlock => ({ kind: "fact", title, text });
const quote = (text: string, by?: string): NewsBlock => ({ kind: "quote", text, by });
const list = (title: string, items: string[]): NewsBlock => ({ kind: "list", title, items });

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: "asian-games-2026-close",
    kind: "news",
    section: "Sports",
    title: "The Asian Games Wrap Up in Japan",
    dek: "After 16 days of competition in Aichi and Nagoya, athletes from 45 countries said goodbye, and more than 50 world records fell.",
    grades: "Grades 3–7",
    publishedOn: "2026-10-04",
    dateline: "NAGOYA, Japan",
    body: [
      p("The 2026 Asian Games ended on Sunday, October 4, with a 90-minute closing ceremony at Mizuho Park Athletic Stadium in Nagoya, Japan. The Games began on September 19 in Aichi Prefecture and its biggest city, Nagoya."),
      p("The Asian Games happen every four years. They are the largest sports event in Asia, and after the Olympics they are one of the biggest multi-sport events in the world. Athletes from 45 countries took part this year."),
      h("Records everywhere"),
      p("Organizers said more than 350 records were broken, including more than 50 world records. That is the most world records ever set at an Asian Games."),
      p("Athletes competed in dozens of sports, from swimming and track to badminton, archery, hockey and cricket. Some events also gave athletes a chance to earn a spot at the next Olympics."),
      h("The medal table"),
      list("Most gold medals", ["China: 169 gold, 341 medals in all", "Japan (the host): 83 gold, 269 medals in all", "South Korea: 39 gold", "India: 21 gold, 85 medals in all"]),
      p("One of India's stars was trap shooter Neeru Dhanda, who won two gold medals and a silver. She also carried India's flag at the closing ceremony."),
      fact("A ship for a village", "Most big Games build an athletes' village. Aichi-Nagoya did something different: some athletes stayed on a cruise ship, along with hotels and other temporary housing."),
      h("See you in Doha"),
      p("At the end of the ceremony, the Asian Games flag was handed on to Doha, Qatar, which will host the next Games in 2030. It will be the second time Doha has hosted, after 2006."),
      quote("Tonight, as we lower the flag on Aichi-Nagoya 2026, we close these Games, but we raise the bar for Asian sport.", "Sheikh Joaan Bin Hamad Al Thani, president of the Olympic Council of Asia"),
    ],
    words: [
      { word: "multi-sport", meaning: "having many different sports in one event" },
      { word: "host", meaning: "the place that holds an event and welcomes the visitors" },
      { word: "trap shooter", meaning: "an athlete who aims at flying clay targets" },
    ],
    questions: [
      { question: "Where were the 2026 Asian Games held?", options: ["Aichi and Nagoya, Japan", "Doha, Qatar", "Seoul, South Korea", "Beijing, China"], correct: "A" },
      { question: "How often do the Asian Games happen?", options: ["Every year", "Every two years", "Every four years", "Every ten years"], correct: "C" },
      { question: "Which country won the most gold medals?", options: ["Japan", "India", "South Korea", "China"], correct: "D" },
      { question: "What was unusual about where some athletes stayed?", options: ["They stayed in tents", "They stayed on a cruise ship", "They slept in the stadium", "They stayed in castles"], correct: "B" },
      { question: "Where will the next Asian Games be held in 2030?", options: ["Tokyo, Japan", "Doha, Qatar", "Mumbai, India", "Nagoya, Japan"], correct: "B" },
    ],
    sources: [
      { name: "The Tribune: Aichi-Nagoya Games conclude with a dazzling ceremony", url: "https://www.tribuneindia.com/news/sports/aichi-nagoya-games-conclude-with-a-dazzling-ceremony" },
      { name: "The Sports 247: Asian Games 2026 closing ceremony", url: "https://www.thesports247.com/asian-games-2026-closing-ceremony-aichi-nagoya-bids-farewell-doha-takes-over-for-2030-games/" },
      { name: "2026 Asian Games overview", url: "https://en.wikipedia.org/wiki/2026_Asian_Games" },
    ],
  },
  {
    slug: "saturn-opposition-2026",
    kind: "news",
    section: "Space",
    title: "Saturn Is at Its Brightest This Week",
    dek: "On October 4, Saturn lined up opposite the Sun. Here's how to spot the ringed planet, and why its rings look thin right now.",
    grades: "Grades 3–8",
    publishedOn: "2026-10-04",
    dateline: "NIGHT SKY",
    body: [
      p("If you look east after sunset this week, you may spot a steady, golden point of light. That's Saturn, and on Sunday, October 4, 2026, it reached a special spot in its orbit called opposition."),
      h("What is opposition?"),
      p("Opposition happens when Earth passes between the Sun and an outer planet. From Earth, the planet sits directly opposite the Sun in the sky. It rises at sunset, is up all night, and is fully lit by sunlight, so it looks its brightest of the year."),
      fact("How far away?", "At opposition, Saturn was about 1.26 billion kilometers (784 million miles) from Earth. Its light takes about 70 minutes to reach us, so you see Saturn as it was over an hour ago."),
      h("How to find it"),
      list("Saturn-spotting tips", ["Find a place with an open view to the east and few bright lights", "Look below the Great Square of Pegasus, a big square of four stars", "Saturn shines steadily, while stars twinkle", "It's bright enough to see with just your eyes"]),
      h("Where did the rings go?"),
      p("You need a telescope to see Saturn's rings, and even a small one can show them. But this year they look thin. The rings are tilted only about 7.5 degrees toward us. In March 2025, they were almost exactly edge-on and nearly vanished from view."),
      p("They aren't really disappearing. As Saturn travels around the Sun, we see its rings from different angles. They will keep opening up until 2032, when they'll be tilted about 27 degrees and look wide and bright."),
      p("The rings are made of billions of pieces of ice and rock, from tiny grains like dust to chunks as big as a house."),
      p("Saturn is the second-largest planet in our solar system, after Jupiter. It takes about 29 Earth years to travel once around the Sun."),
    ],
    words: [
      { word: "opposition", meaning: "when a planet is on the opposite side of Earth from the Sun" },
      { word: "orbit", meaning: "the curved path a planet takes around the Sun" },
      { word: "tilted", meaning: "leaning at an angle" },
    ],
    questions: [
      { question: "What happened to Saturn on October 4, 2026?", options: ["It reached opposition", "It lost its rings", "It passed the Moon", "It moved closer than Mars"], correct: "A" },
      { question: "Why does a planet look brightest at opposition?", options: ["It gets bigger", "It is fully lit by the Sun and up all night", "It is closest to the Sun", "Its rings glow"], correct: "B" },
      { question: "Which direction should you look after sunset to find Saturn?", options: ["North", "West", "East", "Straight down"], correct: "C" },
      { question: "Why do Saturn's rings look thin this year?", options: ["They are melting", "Part of them broke off", "We are seeing them from a low angle", "Clouds cover them"], correct: "C" },
      { question: "What are Saturn's rings made of?", options: ["Gas and fire", "Pieces of ice and rock", "Sand and water", "Metal and glass"], correct: "B" },
    ],
    sources: [
      { name: "Forbes: Saturn reaches opposition this weekend", url: "https://www.forbes.com/sites/jamiecartereurope/2026/09/30/saturn-reaches-opposition-this-weekend---how-to-see-its-rings/" },
      { name: "Farmers' Almanac: How to see Saturn at opposition", url: "https://www.farmersalmanac.com/see-saturn-opposition-october-4-2026" },
      { name: "Space.com: Night sky, October 2026", url: "https://www.space.com/stargazing/night-sky-october-2026-what-to-look-for-this-month" },
    ],
  },
  {
    slug: "artemis-iii-rocket-stacking",
    kind: "news",
    section: "Space",
    title: "NASA Stacks the Giant Boosters for Artemis III",
    dek: "Two 170-foot rocket boosters now stand ready at Kennedy Space Center for NASA's next big Moon-program mission in 2027.",
    grades: "Grades 4–8",
    publishedOn: "2026-10-03",
    dateline: "KENNEDY SPACE CENTER, Florida",
    body: [
      p("Inside one of the largest buildings in the world, NASA's next Moon rocket is taking shape. On September 30, 2026, NASA said the twin solid rocket boosters for its Artemis III mission are fully stacked, with their nose cones in place."),
      p("The work is happening in the Vehicle Assembly Building at Kennedy Space Center in Florida. Each booster is about 170 feet (52 meters) tall and is built from five segments stacked on top of each other."),
      p("Stacking a rocket is careful work. Giant cranes lift each heavy segment high into the air and lower it exactly into place. Next, the rocket's tall orange core stage will be lifted in between the two boosters."),
      fact("Big push", "At launch, NASA's Space Launch System rocket makes about 8.8 million pounds of thrust. The two side boosters provide more than three-quarters of it."),
      h("What is Artemis III?"),
      p("Artemis is NASA's program to send astronauts back to the Moon. In April 2026, the Artemis II crew flew around the Moon. Artemis III, planned for 2027, will practice in orbit around Earth instead of landing."),
      p("The plan uses three separate launches. Astronauts in an Orion spacecraft will meet up with test versions of the landers being built by two companies, Blue Origin and SpaceX, and practice docking with them. These skills are needed before astronauts can land on the Moon again."),
      quote("The amount of risk we're going to be able to bring down in advance of Artemis 4 will be significant.", "Jared Isaacman, NASA Administrator"),
      h("A safer heat shield"),
      p("Engineers also studied Orion's heat shield after Artemis II, which protects astronauts as they plunge back through Earth's atmosphere. By changing how the capsule came home, the number of spots where the shield chipped dropped from more than 100 on Artemis I to just nine on Artemis II."),
    ],
    words: [
      { word: "booster", meaning: "an extra rocket that gives a big push at launch" },
      { word: "thrust", meaning: "the force that pushes a rocket upward" },
      { word: "docking", meaning: "joining two spacecraft together in space" },
    ],
    questions: [
      { question: "Where are the Artemis III boosters being stacked?", options: ["On the Moon", "In the Vehicle Assembly Building in Florida", "At the space station", "In a factory in Texas"], correct: "B" },
      { question: "About how tall is each booster?", options: ["17 feet", "70 feet", "170 feet", "1,700 feet"], correct: "C" },
      { question: "What will the Artemis III astronauts do?", options: ["Land on Mars", "Practice docking with lander test vehicles in orbit around Earth", "Build a Moon base", "Fly to the Sun"], correct: "B" },
      { question: "What does a heat shield do?", options: ["Keeps food warm", "Protects astronauts while coming back through the atmosphere", "Powers the rocket", "Helps the rocket steer"], correct: "B" },
      { question: "In this article, \"thrust\" means…", options: ["the force that pushes a rocket upward", "a kind of fuel", "a rocket's color", "the crew's food"], correct: "A" },
    ],
    sources: [
      { name: "Starlust: Space weekly recap, September 26 – October 2, 2026", url: "https://starlust.org/space-weekly-recap-september-26-october-2-2026-key-stories-you-may-have-missed/" },
      { name: "NASASpaceFlight: Artemis III SLS stacking advances", url: "https://www.nasaspaceflight.com/2026/09/artemis-iii-sls-stacking-artemis-ii-orion-fix/" },
      { name: "Spaceflight Now: NASA Administrator confident in Artemis 3 in 2027", url: "https://spaceflightnow.com/2026/08/14/nasa-administrator-extremely-confident-in-artemis-3-launch-in-2027/" },
    ],
  },
  {
    slug: "comedy-wildlife-2026",
    kind: "news",
    section: "Animals",
    title: "A Sneezing Moose and Other Funny Animal Photos",
    dek: "The 2026 Comedy Wildlife Awards picked their funniest photos from a record number of entries, and they're all for a good cause.",
    grades: "Grades 2–6",
    publishedOn: "2026-10-02",
    dateline: "LONDON, England",
    body: [
      p("A moose in the middle of a giant sneeze. A squirrel bravely charging at an owl. A baby bird wearing a flower petal like a hat. These are a few of the photos picked for the shortlist of the 2026 Nikon Comedy Wildlife Awards, announced on October 1."),
      p("The contest celebrates the funniest moments photographers catch when they're out watching wild animals. This year it got more than 10,000 entries from 112 countries, the most ever."),
      p("Judges include wildlife photographers, TV presenters and comedians. They look for photos that are both funny and well made. Getting a great shot takes patience: photographers may wait for hours, quietly watching, for one silly second to happen."),
      h("Some of the shortlist"),
      list("Funny finalists", ["Two beavers in Belgium, in a photo called \"This is my best side\"", "An elephant giving itself a dust bath in Kenya", "A squirrel taking on a great horned owl in California", "A sneezing moose in Alberta, Canada", "A young sunbird with a flower petal on its head, taken by a photographer under 16"]),
      fact("Why dust baths?", "Elephants throw dust and dirt over their skin to protect it from the sun and from biting insects. It's like sunscreen and bug spray in one."),
      h("Laughing for a reason"),
      p("The awards were started in 2015 by photographer Paul Joynson-Hicks. He wanted to use humor to get people interested in protecting wild animals and the places they live. The contest works with the Born Free Foundation, a charity that protects wildlife around the world."),
      p("The winners will be announced on December 8, 2026. The top prize is a safari in Kenya's Masai Mara reserve, plus cameras. The photos will also be shown at a gallery in London from December 9 to 13."),
    ],
    words: [
      { word: "shortlist", meaning: "a small group picked from many entries before the winners are chosen" },
      { word: "wildlife", meaning: "animals that live in nature, not as pets" },
      { word: "charity", meaning: "a group that raises money to help others" },
    ],
    questions: [
      { question: "What does the Comedy Wildlife Awards contest celebrate?", options: ["The fastest animals", "Funny moments with wild animals", "The biggest pets", "Animal paintings"], correct: "B" },
      { question: "About how many entries did the contest get this year?", options: ["100", "1,000", "More than 10,000", "One million"], correct: "C" },
      { question: "Why do elephants take dust baths?", options: ["To protect their skin from sun and insects", "To cool their ears", "To find food", "To change color"], correct: "A" },
      { question: "Why did Paul Joynson-Hicks start the awards?", options: ["To sell cameras", "To use humor to get people to care about protecting wildlife", "To find new species", "To train animals"], correct: "B" },
      { question: "When will the winners be announced?", options: ["October 1, 2026", "December 8, 2026", "January 1, 2027", "March 2027"], correct: "B" },
    ],
    sources: [
      { name: "Smithsonian: The 2026 Nikon Comedy Wildlife Awards shortlist", url: "https://www.smithsonianmag.com/smart-news/see-the-hilarious-animal-shenanigans-captured-in-photos-and-videos-shortlisted-for-the-2026-nikon-comedy-wildlife-awards-180989600/" },
      { name: "Britannica Kids News: about the Comedy Wildlife Awards", url: "https://news.eb.com/?p=30304" },
    ],
  },
  {
    slug: "new-stick-insects",
    kind: "news",
    section: "Animals",
    title: "Hidden in Plain Sight: New Stick Insects in Australia",
    dek: "Scientists found that two kinds of large stick insect were really five, including one that lays eggs with tiny lids.",
    grades: "Grades 3–7",
    publishedOn: "2026-10-01",
    dateline: "SYDNEY, Australia",
    body: [
      p("Stick insects are masters of disguise. They look so much like twigs that predators, and people, walk right past them. Now scientists in Australia have discovered that some stick insects were hiding in another way too: they were being mistaken for other species."),
      p("A team from the University of Sydney, led by Dr. Braxton Jones, studied large stick insects that live from northern New South Wales, along the Queensland coast and into tropical northern Australia. What scientists had thought were just two species turned out to be five."),
      h("Meet the new species"),
      list("New names", ["Anchiale robusta: a big stick insect that had been mistaken for another species for decades", "Anchiale mabiensis: found in the Mabi rainforest on Queensland's Atherton Tablelands", "A possible third new species from Cape York, which needs more study"]),
      fact("Eggs with lids", "Anchiale mabiensis lays eggs with a little structure like a lid. Nothing like it had ever been recorded in any stick insect before."),
      h("How they figured it out"),
      p("The team used several kinds of clues. They compared the insects' DNA, studied old specimens in museums, searched in the wild, raised insects in captivity, and used photos and records shared by ordinary people. Sharing observations like this is called citizen science."),
      quote("These findings demonstrate the importance of protecting threatened ecosystems and documenting Australia's extraordinary biodiversity before we lose species without us having even discovered them.", "Dr. Braxton Jones, University of Sydney"),
      p("Australia is home to some giant stick insects. The longest found there measures about 62 centimeters, almost as long as the world record of 64 centimeters."),
      p("Many stick insects eat leaves at night and stay still during the day. Some sway gently, like a twig moving in the breeze, to make their disguise even better."),
    ],
    words: [
      { word: "species", meaning: "a group of living things of the same kind" },
      { word: "citizen science", meaning: "when everyday people help scientists by sharing what they observe" },
      { word: "biodiversity", meaning: "the variety of living things in a place" },
    ],
    questions: [
      { question: "What surprising thing did the scientists discover?", options: ["Stick insects can fly to the Moon", "Stick insects are related to spiders", "All stick insects are green", "Two species of stick insect were really five"], correct: "D" },
      { question: "What is special about the eggs of Anchiale mabiensis?", options: ["They glow", "They are square", "They have a lid-like structure", "They hatch in one hour"], correct: "C" },
      { question: "Which university led the research?", options: ["The University of Sydney", "Harvard University", "The University of Tokyo", "Oxford University"], correct: "A" },
      { question: "What is citizen science?", options: ["Science done only in labs", "Everyday people sharing observations to help scientists", "A science class for adults", "A kind of microscope"], correct: "B" },
      { question: "Why do stick insects look like twigs?", options: ["To hide from predators", "To stay warm", "To attract rain", "To grow faster"], correct: "A" },
    ],
    sources: [
      { name: "University of Sydney: New stick insect species revealed", url: "https://www.sydney.edu.au/news-opinion/news/2026/09/22/new-stick-insect-species-revealed-in-australia-s-backyards-and-r.html" },
      { name: "ScienceDaily: This giant stick insect fooled scientists for decades", url: "https://www.sciencedaily.com/releases/2026/09/260930020315.htm" },
      { name: "Phys.org: Two new large stick insect species discovered in Australia", url: "https://phys.org/news/2026-09-large-insect-species-australia-backyards.html" },
    ],
  },
  {
    slug: "crew-13-record-trip",
    kind: "news",
    section: "Space",
    title: "Four Astronauts Reach the Space Station in Record Time",
    dek: "NASA's Crew-13 made the fastest trip ever by an American spacecraft to the International Space Station.",
    grades: "Grades 4–8",
    publishedOn: "2026-10-02",
    dateline: "CAPE CANAVERAL, Florida",
    body: [
      p("Four astronauts are settling into their new home in orbit after a trip that broke a speed record. On October 1, 2026, a SpaceX Falcon 9 rocket launched from Cape Canaveral, Florida, carrying a Dragon capsule named Grace toward the International Space Station."),
      p("Just 7 hours and 55 minutes later, the capsule docked with the station. NASA said it was the fastest trip to the station ever made by an American spacecraft. Earlier Dragon flights often took about a full day to catch up with the station."),
      h("Meet the crew"),
      list("Crew-13", ["Jessica Watkins, NASA, commander", "Luke Delaney, NASA, pilot", "Joshua Kutryk, Canadian Space Agency, mission specialist", "Sergey Teteryatnikov, Roscosmos (Russia's space agency), mission specialist"]),
      p("Kutryk is the first Canadian astronaut to fly on one of NASA's commercial crew missions, which use spacecraft built by private companies. When he floated aboard, he said it felt really good to have the Canadian Space Agency back on the station."),
      fact("A lab that circles Earth", "The International Space Station orbits about 400 kilometers (250 miles) above Earth. It travels so fast that it goes all the way around the planet about every 90 minutes, so the crew sees roughly 16 sunrises a day."),
      h("Six months of science"),
      p("The crew will spend about six months on the station. One big job is studying how weightlessness changes the human body, from muscles and bones to the heart and eyes. Kutryk's research could also help doctors check on patients who live far from a hospital."),
      p("Their arrival lets the four astronauts of Crew-12 head home to Earth in another Dragon capsule, named Freedom."),
      h("A big year in space"),
      p("Crew-13 is part of a busy year for human spaceflight. In April 2026, the four astronauts of NASA's Artemis II mission flew around the Moon. They traveled 406,771 kilometers (252,756 miles) from Earth, farther than any humans before them. One of them, Canadian astronaut Jeremy Hansen, became the first person from outside the United States to travel around the Moon."),
    ],
    words: [
      { word: "docked", meaning: "joined up with another spacecraft in space" },
      { word: "orbits", meaning: "travels around a planet or star in a curved path" },
      { word: "weightlessness", meaning: "the floating feeling astronauts have in orbit" },
    ],
    questions: [
      { question: "What record did Crew-13 set?", options: ["The longest stay ever in space", "The fastest trip to the space station by an American spacecraft", "The first trip to Mars", "The largest crew ever launched"], correct: "B" },
      { question: "About how long did the trip to the space station take?", options: ["Three days", "One week", "About 8 hours", "About 30 minutes"], correct: "C" },
      { question: "Which space agency does Joshua Kutryk work for?", options: ["The Canadian Space Agency", "NASA", "Roscosmos", "The European Space Agency"], correct: "A" },
      { question: "What is one thing the crew will study during their six months on the station?", options: ["How to grow trees on the Moon", "How to build rockets", "How weather forms on Mars", "How weightlessness changes the human body"], correct: "D" },
      { question: "What did the Artemis II astronauts do in April 2026?", options: ["They landed on Mars", "They flew around the Moon", "They fixed a satellite", "They walked on an asteroid"], correct: "B" },
    ],
    sources: [
      { name: "NASA: Crew-13 launches to the International Space Station", url: "https://www.nasa.gov/news-release/nasas-spacex-crew-13-launches-to-international-space-station/" },
      { name: "SpaceQ: Crew-13 docking", url: "https://spaceq.ca/crew-13-docking-kutryk-station/" },
      { name: "Spaceflight Now: Crew-13 launch coverage", url: "https://spaceflightnow.com/2026/10/01/live-coverage-nasa-spacex-to-launch-next-crewed-mission-to-the-international-space-station/" },
      { name: "Artemis II mission summary", url: "https://en.wikipedia.org/wiki/Artemis_II" },
    ],
  },
  {
    slug: "new-wild-cat-tilcayo",
    kind: "news",
    section: "Animals",
    title: "Scientists Name a New Wild Cat, the First in 100 Years",
    dek: "Meet the tilcayo, a tiny spotted cat from the cloud forests of Bolivia.",
    grades: "Grades 3–7",
    publishedOn: "2026-09-18",
    dateline: "LA PAZ, Bolivia",
    body: [
      p("It has been more than a century since scientists last described a brand-new kind of cat. That changed in September 2026, when researchers announced a new species of small wild cat from Bolivia, in South America. Its scientific name is Leopardus tilcayo. People in the region call it the tilcayo."),
      h("Smaller than a house cat"),
      p("The tilcayo is about 46 centimeters (18 inches) long and weighs around 1.4 kilograms (3 pounds), smaller than a typical pet cat. It has light brown fur covered in large, irregular spots called rosettes."),
      p("It lives in the Yungas, a band of steep, misty cloud forests on the eastern slopes of the Andes mountains."),
      fact("What is a cloud forest?", "A cloud forest is a mountain forest that is wrapped in clouds and fog much of the time. The trees are often covered in moss, ferns and orchids that soak up water straight from the misty air."),
      h("Solved with DNA"),
      p("For years, scientists grouped several small spotted cats in South America together as \"tiger cats.\" But the cats looked a little different from place to place. To find out why, a team co-led by National Geographic Explorer Paola Nogales-Ascarrunz and Jonas Lescroart of the University of Antwerp studied DNA from 38 tiger cats, including eight museum specimens."),
      p("The DNA showed that tiger cats are really five separate species, and one of them had never been named. The team published its findings in the journal Current Biology on September 18, 2026."),
      h("Only one known tilcayo in care"),
      p("Right now, scientists know of just one tilcayo living in human care. He is a 10-year-old male who lives at Senda Verde, a wildlife sanctuary in the Yungas, after once being kept in a family's home. Researchers are now setting up camera traps, cameras that snap a photo when an animal walks by, to learn how many tilcayos live in the wild and how to protect their forest home."),
    ],
    words: [
      { word: "species", meaning: "a group of living things that are alike and can have young together" },
      { word: "specimens", meaning: "samples kept by scientists for study, like bones or skins" },
      { word: "sanctuary", meaning: "a safe place where animals are cared for and protected" },
    ],
    questions: [
      { question: "Why is the tilcayo's discovery a big deal?", options: ["It is the biggest cat ever found", "It is the first new cat species described in more than 100 years", "It can fly short distances", "It lives at the North Pole"], correct: "B" },
      { question: "Where does the tilcayo live?", options: ["In the deserts of Africa", "In the cloud forests of Bolivia", "On islands in the Pacific", "In the forests of Canada"], correct: "B" },
      { question: "How did scientists prove the tilcayo was a separate species?", options: ["By studying its DNA", "By counting its whiskers", "By listening to its meow", "By measuring its tail"], correct: "A" },
      { question: "How big is the tilcayo?", options: ["Bigger than a lion", "About the size of a horse", "About the size of a large dog", "Smaller than a typical pet cat"], correct: "D" },
      { question: "Why are researchers setting up camera traps?", options: ["To film a movie", "To catch the cats and sell them", "To learn how many tilcayos live in the wild", "To watch the weather"], correct: "C" },
    ],
    sources: [
      { name: "National Geographic Society: New wild cat species discovered in Bolivia", url: "https://news.nationalgeographic.org/photos-new-wild-cat-species/" },
      { name: "KTVU: New tiny wild cat species discovered in Bolivia's cloud forests", url: "https://www.ktvu.com/news/new-wild-cat-species-leopardus-tilcayo-bolivia" },
      { name: "CP24: New cat species identified in Bolivia", url: "https://www.cp24.com/news/world/2026/09/17/new-cat-species-identified-in-bolivia-first-in-over-a-century" },
    ],
  },
  {
    slug: "new-sea-spiders",
    kind: "news",
    section: "Science",
    title: "Two New Sea Spiders Found off Canada's Coast",
    dek: "They breathe through their skin and eat with a straw-like mouth, and they had been hiding in plain sight.",
    grades: "Grades 4–8",
    publishedOn: "2026-09-25",
    dateline: "VANCOUVER, Canada",
    body: [
      p("Scientists in Canada have described two kinds of sea spider that no one had ever named before. They are the first new sea spider species found in the Salish Sea in nearly 100 years."),
      p("The Salish Sea is the network of waterways between Vancouver Island and the mainland of British Columbia and Washington State. Researchers from the University of British Columbia collected the animals between 2023 and 2024 near Quadra Island, Vancouver, Bamfield and Victoria, in water up to 18 meters (59 feet) deep."),
      h("Not really spiders"),
      p("Despite their name, sea spiders are not true spiders. They belong to their own ancient group of sea creatures. Most are tiny, with skinny bodies and long legs. Sea spiders breathe directly through their skin, and they feed using a proboscis, a long, straw-like mouth they use to suck up food."),
      fact("Two new names", "Callipallene pilosuspedes has long, curved spines on its lower legs, red eyes and a triangle-shaped mouth with three lips. Only one was found. Tanystylum kiixin has short legs for carrying eggs, which makes it hard to clean itself, so it is often covered in dirt, bits of debris and tiny hitchhikers."),
      h("How they were identified"),
      p("The team used two tools. They took detailed pictures of each animal's body, and they read its DNA. Comparing the DNA with other sea spiders showed that these two were new. The study also produced DNA records for several other sea spiders that had never been sequenced before."),
      p("The research was published on September 25, 2026, in the journal Organisms Diversity & Evolution. Lead researcher Cormac Toler-Scott said more undiscovered species probably live in the region, waiting for someone to look closely."),
      p("Sea spiders live in oceans all over the world, from shallow tide pools to the deep sea, and scientists have described more than 1,000 kinds so far. This discovery shows that even in waters close to big cities, there is still a lot left to find."),
    ],
    words: [
      { word: "proboscis", meaning: "a long, tube-shaped mouthpart used for feeding" },
      { word: "debris", meaning: "small broken bits of material" },
      { word: "sequenced", meaning: "having had its DNA code read by scientists" },
    ],
    questions: [
      { question: "Where were the new sea spiders found?", options: ["In the Salish Sea near British Columbia", "In the Gulf of Mexico", "Near Antarctica", "In a lake in Florida"], correct: "A" },
      { question: "How do sea spiders breathe?", options: ["Through gills", "With lungs", "Directly through their skin", "Through their eyes"], correct: "C" },
      { question: "What is a proboscis?", options: ["A kind of shell", "A long, straw-like mouth used for feeding", "A spiny leg", "A type of egg"], correct: "B" },
      { question: "Why is Tanystylum kiixin often covered in dirt?", options: ["It rolls in the mud on purpose", "It lives on land", "It hides from predators", "Its short egg-carrying legs make it hard to clean itself"], correct: "D" },
      { question: "Which statement is true about sea spiders?", options: ["They are a kind of true spider", "They are not true spiders", "They spin webs underwater", "They only live in rivers"], correct: "B" },
    ],
    sources: [
      { name: "ScienceDaily: Two new sea spider species discovered in the Salish Sea", url: "https://www.sciencedaily.com/releases/2026/09/260925005412.htm" },
      { name: "NPR: Scientists discover two new species of sea spiders along Canadian coastline", url: "https://www.npr.org/2026/09/27/nx-s1-5982026/new-sea-spider-species" },
    ],
  },
  {
    slug: "berlin-marathon-2026",
    kind: "news",
    section: "Sports",
    title: "Fast Feet in Berlin: A New Course Record",
    dek: "Ethiopian runners won both races, and Tigst Assefa ran one of the fastest marathons in history.",
    grades: "Grades 3–7",
    publishedOn: "2026-09-28",
    dateline: "BERLIN, Germany",
    body: [
      p("On September 27, 2026, tens of thousands of runners from more than 160 countries crowded the streets of Berlin, Germany, for one of the world's most famous races: the Berlin Marathon."),
      p("A marathon is 42.195 kilometers long, or about 26.2 miles. Berlin's course is flat with smooth roads and few sharp turns, which helps runners go fast. Many marathon world records have been set there."),
      h("The winners"),
      p("Tigst Assefa of Ethiopia won the women's race in 2 hours, 11 minutes and 4 seconds. It was a new women's course record in Berlin and the third-fastest women's marathon ever run. Even more impressive, she kept going strong despite an injury that made her limp during the last two kilometers."),
      p("Guye Adola, also from Ethiopia, won the men's race in 2 hours, 2 minutes and 50 seconds. It was his best time ever and his second Berlin Marathon title."),
      fact("How fast is that?", "To finish in 2 hours and 2 minutes, a runner has to average less than 3 minutes for every kilometer, for more than 42 kilometers in a row. That is faster than most people can sprint for a single minute."),
      h("Wheelchair racers"),
      p("The wheelchair races were won by two athletes from Switzerland. Marcel Hug finished the men's race in 1 hour, 23 minutes and 28 seconds, and Catherine Debrunner won the women's race in 1 hour, 35 minutes and 1 second."),
      list("Berlin by the numbers", ["Distance: 42.195 km (26.2 miles)", "Women's winner: Tigst Assefa, 2:11:04 (course record)", "Men's winner: Guye Adola, 2:02:50", "Wheelchair winners: Marcel Hug, 1:23:28 and Catherine Debrunner, 1:35:01"]),
      p("Most of the runners on the course were not chasing records at all. They were everyday people who trained for months to finish the distance, cheered on by crowds lining the streets."),
    ],
    words: [
      { word: "marathon", meaning: "a running race that is 42.195 kilometers (26.2 miles) long" },
      { word: "record", meaning: "the best result ever achieved" },
      { word: "average", meaning: "the usual amount, found by sharing a total out evenly" },
    ],
    questions: [
      { question: "How long is a marathon?", options: ["10 kilometers", "About 26.2 miles (42.195 km)", "100 miles", "5 kilometers"], correct: "B" },
      { question: "Why is the Berlin course good for fast times?", options: ["It is downhill the whole way", "It is very short", "It is flat with smooth roads and few sharp turns", "Runners use bikes for part of it"], correct: "C" },
      { question: "What did Tigst Assefa achieve?", options: ["She set a new women's course record", "She finished last", "She won the wheelchair race", "She ran half the race"], correct: "A" },
      { question: "Which country were both wheelchair winners from?", options: ["Ethiopia", "Germany", "Kenya", "Switzerland"], correct: "D" },
      { question: "In this article, a \"record\" is…", options: ["a song on the radio", "a list of runners", "the best result ever achieved", "a type of running shoe"], correct: "C" },
    ],
    sources: [
      { name: "2026 Berlin Marathon results", url: "https://en.wikipedia.org/wiki/2026_Berlin_Marathon" },
      { name: "The Running Channel: Berlin Marathon 2026 results", url: "https://therunningchannel.com/berlin-marathon-2026-results/" },
      { name: "World-Track: Guye Adola wins the 2026 Berlin Marathon", url: "https://world-track.org/2026/09/2026-bmw-berlin-marathon-mens-results-guye-adola-wins/" },
    ],
  },
  {
    slug: "spain-wins-world-cup",
    kind: "news",
    section: "Sports",
    title: "Spain Wins the Biggest World Cup Ever",
    dek: "A goal in extra time gave Spain its second title at the first 48-team World Cup.",
    grades: "Grades 3–7",
    publishedOn: "2026-07-20",
    dateline: "EAST RUTHERFORD, New Jersey",
    body: [
      p("After five weeks and more than 100 matches, the 2026 FIFA World Cup came down to one game. On July 19, 2026, Spain played Argentina in the final at MetLife Stadium in New Jersey, in front of 80,663 fans."),
      h("Biggest tournament yet"),
      p("This World Cup was the largest ever. For the first time, 48 national teams took part instead of 32, and three countries shared the job of hosting: Canada, Mexico and the United States."),
      p("The 48 teams were split into 12 groups of four. The best teams from each group moved on to the knockout rounds, where a single loss sends a team home. In all, 104 matches were played in 16 host cities across the three countries."),
      h("One goal decides it"),
      p("The final stayed tied 0–0 through 90 minutes, so the teams played extra time. In the 106th minute, Spain's Nico Williams headed the ball to teammate Ferran Torres, who scored. Spain held on to win 1–0."),
      p("Argentina's goalkeeper, Emiliano Martínez, made 11 saves, a record for the most saves by a goalkeeper in a World Cup final. Argentina's Lionel Messi became only the second player in history to play in three World Cup finals."),
      fact("Two trophies at once", "Spain's women's team won the Women's World Cup in 2023. With this win, Spain became the first country to hold the men's and women's World Cup titles at the same time."),
      h("Awards"),
      list("Tournament awards", ["Golden Ball (best player): Rodri, Spain", "Golden Glove (best goalkeeper): Unai Simón, Spain", "Best Young Player: Pau Cubarsí, Spain", "Player of the final: Ferran Torres, Spain"]),
      p("It was Spain's second men's World Cup title. Its first came in 2010 in South Africa. The next men's World Cup will be held in 2030."),
    ],
    words: [
      { word: "national", meaning: "belonging to a whole country" },
      { word: "extra time", meaning: "added playing time when a game is tied at the end" },
      { word: "tournament", meaning: "a contest with many teams playing a series of games" },
    ],
    questions: [
      { question: "Which two teams played in the 2026 World Cup final?", options: ["Brazil and France", "Spain and Argentina", "Mexico and Canada", "England and Germany"], correct: "B" },
      { question: "What made this World Cup the biggest ever?", options: ["It lasted a whole year", "It had 48 teams and three host countries", "Every game went to extra time", "It was played on three continents"], correct: "B" },
      { question: "Who scored the winning goal?", options: ["Lionel Messi", "Rodri", "Ferran Torres", "Emiliano Martínez"], correct: "C" },
      { question: "What record did goalkeeper Emiliano Martínez set?", options: ["Most saves in a World Cup final", "Most goals by a goalkeeper", "Fastest goal ever", "Most World Cups played"], correct: "A" },
      { question: "What does \"extra time\" mean in this article?", options: ["A break at halftime", "The time before a game starts", "Time spent celebrating", "Added playing time when a game is tied at the end"], correct: "D" },
    ],
    sources: [
      { name: "2026 FIFA World Cup final", url: "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_final" },
      { name: "ABC News via KNEB: Spain defeats Argentina 1-0 to win 2026 World Cup", url: "https://ruralradio.com/kneb-fm/abc-category/sports/page/5/" },
    ],
  },
  {
    slug: "libraries-on-the-move",
    section: "Reading",
    title: "Libraries on the Move",
    dek: "Camels, donkeys and boats are carrying books to readers who live far from a library.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("Imagine waiting all week for the library to arrive. Not a building, but a camel with boxes of books strapped to its back. For some families in northeastern Kenya, that is how the library comes to town."),
      p("Many families there are nomads. They move from place to place to find water and grass for their animals. A library building would be left behind, so Kenya's national library service sends the books instead. Since 1996, camel caravans have carried books to villages near the town of Garissa."),
      fact("Why camels?", "Camels can walk across hot, sandy land where there are few roads. They can go many days without drinking water, and a single camel can carry hundreds of books."),
      h("A donkey named Alfa"),
      p("Far away in Colombia, a teacher named Luis Soriano had a similar idea. Many children in the countryside near his home had no books at all. So he loaded two donkeys, Alfa and Beto, and set off on dusty trails to bring stories to them."),
      p("His project became known as the Biblioburro, which means \"donkey library\" in Spanish. Luis reads aloud, helps students with homework and lends books until his next visit. Over the years, people around the world have donated thousands of books to keep it going."),
      h("Floating libraries"),
      p("In Bangladesh, heavy rains flood rivers for months every year. Roads wash away, and so do trips to school. A group there built boats that work as floating classrooms and libraries. The boats stop along the river to pick up students, and solar panels on the roof power lights and computers."),
      list("Other libraries on the move", ["Bookmobiles: buses and vans full of books that visit neighborhoods", "Little Free Libraries: small boxes in front yards where anyone can take or leave a book", "Bike libraries: bicycles with book carts that roll into parks"]),
      p("All of these libraries share one big idea: everyone deserves a chance to read, no matter how far away they live. If readers cannot get to the books, the books will find a way to get to the readers."),
    ],
    words: [
      { word: "nomads", meaning: "people who move from place to place instead of living in one spot" },
      { word: "caravans", meaning: "groups of animals or vehicles traveling together" },
      { word: "donated", meaning: "gave something away to help others" },
    ],
    questions: [
      { question: "Why does the library in northeastern Kenya travel by camel?", options: ["Camels are faster than trucks on highways", "Many families move around, and camels can cross hot, sandy land with few roads", "The library building burned down", "Camels can read the books to children"], correct: "B" },
      { question: "What does the word \"Biblioburro\" mean?", options: ["Book bus", "Floating school", "Donkey library", "Reading camel"], correct: "C" },
      { question: "Why did people in Bangladesh build floating libraries?", options: ["Floods wash away roads for months every year", "Boats are cheaper than books", "People there prefer to read on the water", "There are no trees for building libraries"], correct: "A" },
      { question: "In this story, the word \"nomads\" means people who…", options: ["live in big cities", "write books", "work in libraries", "move from place to place"], correct: "D" },
      { question: "What big idea do all of the traveling libraries share?", options: ["Animals make the best librarians", "Everyone deserves a chance to read, no matter where they live", "Books should only be read outside", "Libraries should be closed on weekends"], correct: "B" },
    ],
  },
  {
    slug: "octopus-genius",
    section: "Animals",
    title: "The Octopus: Ocean Genius",
    dek: "Three hearts, blue blood and arms that can taste. Meet one of the smartest animals in the sea.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("If you ever meet an octopus, it might be studying you just as closely as you are studying it. Octopuses are some of the cleverest animals on Earth, and their bodies are full of surprises."),
      h("A body like no other"),
      p("An octopus has three hearts. Two of them pump blood through the gills, and the third pumps blood to the rest of the body. Its blood is blue, not red, because it uses copper instead of iron to carry oxygen."),
      p("An octopus has no bones at all. The only hard part of its body is its beak, which it uses to crack open crabs and clams. That means an octopus can squeeze through any gap bigger than its beak, even one the size of a coin."),
      fact("Thinking arms", "An octopus has about 500 million nerve cells, called neurons. About two-thirds of them are in its eight arms, not its head. Each arm can explore, grab and even taste things on its own."),
      h("Masters of disguise"),
      p("Octopuses can change color in less than a second. Their skin is packed with tiny sacs of color that they can stretch or shrink. Some can even change the bumps on their skin to look like rocks or seaweed. This helps them hide from sharks and sneak up on their dinner."),
      h("Clever escape artists"),
      p("Scientists have watched octopuses solve puzzles, open jars to reach snacks and remember people they have met before. One kind, the coconut octopus, carries empty coconut shells around and hides inside them, like a portable fort."),
      p("In 2016, an octopus named Inky became famous after he slipped out of his tank at an aquarium in New Zealand. Workers believe he squeezed through a small gap, slid across the floor and escaped down a drainpipe that led to the sea."),
      p("Most octopuses live only one or two years, so they have to learn fast. Scientists are still discovering how such a short-lived animal became so smart."),
    ],
    words: [
      { word: "neurons", meaning: "nerve cells that carry messages through the body and brain" },
      { word: "disguise", meaning: "a way of changing how you look so others don't recognize you" },
      { word: "portable", meaning: "easy to carry from place to place" },
    ],
    questions: [
      { question: "How many hearts does an octopus have?", options: ["One", "Two", "Three", "Eight"], correct: "C" },
      { question: "Why can an octopus squeeze through very small gaps?", options: ["It has no bones except its beak", "It can shrink its whole body to half its size", "Its arms come off and grow back", "It is made mostly of air"], correct: "A" },
      { question: "Where are most of an octopus's neurons?", options: ["In its beak", "In its hearts", "In its head only", "In its arms"], correct: "D" },
      { question: "How does the coconut octopus use coconut shells?", options: ["It eats them for food", "It carries them and hides inside them", "It throws them at sharks", "It uses them to store water"], correct: "B" },
      { question: "What is the main idea of this article?", options: ["Octopuses are dangerous to people", "Octopuses are clever animals with amazing bodies", "Aquariums should not keep octopuses", "Octopuses live longer than most sea animals"], correct: "B" },
    ],
  },
  {
    slug: "louis-braille",
    section: "History",
    title: "The Teen Who Taught Fingers to Read",
    dek: "Louis Braille lost his sight as a little boy. At 15, he invented a way for blind people to read.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("Louis Braille was born in 1809 in Coupvray, a small village in France. His father made leather saddles and harnesses for horses, and little Louis loved to watch him work."),
      p("One day, when Louis was three years old, he picked up one of his father's sharp tools. It slipped and hurt his eye. An infection spread to both eyes, and by the age of five, Louis was completely blind."),
      h("A school with very few books"),
      p("Louis was smart and curious. At age 10, he went to a special school for blind children in Paris. The school had a few books with giant raised letters that students could feel with their fingers. But the books were huge and heavy, and reading them was painfully slow. A single story could fill many volumes."),
      fact("Night writing", "A French army captain named Charles Barbier invented a code of raised dots so soldiers could send messages in the dark without lighting a lamp. He brought the idea to Louis's school. It was clever but complicated, using up to 12 dots for each sound."),
      h("Six little dots"),
      p("Louis knew the dots were a great idea. He just needed to make them simpler. He worked on the problem for years, often late at night. In 1824, when he was only 15, he finished a new system. Each letter fit inside a small cell of just six dots, arranged in two columns of three. A fingertip could feel a whole letter at once."),
      p("Louis kept improving his code. He added numbers, punctuation and even a way to write music, because he loved to play the organ and the cello."),
      quote("Access to communication in the widest sense is access to knowledge.", "Louis Braille"),
      h("A gift to the world"),
      p("For a long time, many teachers refused to use Louis's system. It was not officially adopted in France until 1854, two years after he died. Today, braille is used in almost every language. You can find it on elevator buttons, signs, medicine boxes and, of course, in books."),
      p("Every year on January 4, his birthday, people celebrate World Braille Day. It honors a teenager who turned a hard situation into a gift that has helped millions of people read."),
    ],
    words: [
      { word: "infection", meaning: "an illness caused by germs getting into the body" },
      { word: "volumes", meaning: "separate books that are part of a larger set" },
      { word: "adopted", meaning: "officially chosen and put into use" },
    ],
    questions: [
      { question: "How did Louis Braille lose his sight?", options: ["He was born blind", "An accident with a sharp tool led to an infection in both eyes", "He stared at the sun too long", "He fell from a horse"], correct: "B" },
      { question: "Why were the books at Louis's school hard to use?", options: ["They were written in another language", "They had no pictures", "They were huge, heavy and slow to read", "They were kept locked away"], correct: "C" },
      { question: "Who invented the \"night writing\" code that inspired Louis?", options: ["Charles Barbier, an army captain", "Louis's father", "A teacher in Coupvray", "The king of France"], correct: "A" },
      { question: "How many dots are in each braille cell?", options: ["Twelve", "Four", "Ten", "Six"], correct: "D" },
      { question: "Which word best describes Louis Braille, based on the article?", options: ["Lazy", "Determined", "Careless", "Unkind"], correct: "B" },
    ],
  },
  {
    slug: "a-day-on-venus",
    section: "Space",
    title: "A Day on Venus Lasts Longer Than a Year",
    dek: "Our closest planet neighbor spins backward, slowly, under clouds of acid. Here's why it's so strange.",
    grades: "Grades 4–7",
    publishedOn: "2026-10-05",
    body: [
      p("Venus is the second planet from the Sun and the closest planet to Earth. It is almost the same size as our planet, so it is sometimes called Earth's twin. But step outside on Venus and you would quickly find out it is the strangest twin you could imagine."),
      h("A very long day"),
      p("A day is how long a planet takes to spin around once. Earth spins once every 24 hours. Venus spins so slowly that one turn takes about 243 Earth days."),
      p("A year is how long a planet takes to travel all the way around the Sun. Venus does that in about 225 Earth days. So a single day on Venus is longer than its whole year!"),
      fact("Spinning backward", "Most planets, including Earth, spin in the same direction. Venus spins the opposite way. If you could see the Sun through the clouds on Venus, it would rise in the west and set in the east."),
      h("The hottest planet"),
      p("Mercury is closer to the Sun, but Venus is hotter. Its surface is about 465 degrees Celsius, or 870 degrees Fahrenheit. That is hot enough to melt lead."),
      p("The reason is its thick atmosphere, which is made mostly of carbon dioxide. It works like a heavy blanket that traps the Sun's heat. Scientists call this the greenhouse effect. On Venus, it is so strong that the heat can never escape."),
      h("Clouds you would not want to touch"),
      p("Venus is covered in thick yellowish clouds made partly of sulfuric acid. They reflect so much sunlight that Venus shines brightly in our sky. After the Moon, it is the brightest natural object in the night sky, which is why people sometimes call it the morning star or the evening star."),
      list("Venus by the numbers", ["Distance from the Sun: about 108 million kilometers (67 million miles)", "Moons: none", "Air pressure at the surface: about 90 times Earth's"]),
      p("Several spacecraft have visited Venus, and a few have even landed. The heat and pressure crushed them within hours. Scientists keep studying Venus because it may help us understand how a planet so much like Earth turned out so different."),
    ],
    words: [
      { word: "atmosphere", meaning: "the layer of gases that surrounds a planet" },
      { word: "reflect", meaning: "to bounce light back" },
      { word: "pressure", meaning: "how hard something pushes on something else" },
    ],
    questions: [
      { question: "Why is Venus sometimes called Earth's twin?", options: ["It has the same number of moons", "It is almost the same size as Earth", "It has oceans like Earth", "It takes 365 days to orbit the Sun"], correct: "B" },
      { question: "Which takes longer on Venus?", options: ["A year", "A month", "A day", "They are exactly the same"], correct: "C" },
      { question: "Why is Venus hotter than Mercury, even though Mercury is closer to the Sun?", options: ["Venus has more volcanoes", "Venus spins backward", "Venus has no clouds", "Its thick atmosphere traps heat like a blanket"], correct: "D" },
      { question: "On Venus, where would the Sun rise?", options: ["In the west", "In the east", "In the north", "It never rises"], correct: "A" },
      { question: "In this article, the word \"reflect\" means…", options: ["to keep light inside", "to bounce light back", "to make light hotter", "to turn light into clouds"], correct: "B" },
    ],
  },
  {
    slug: "why-leaves-change-color",
    section: "Nature",
    title: "The Secret Colors Hiding in Leaves",
    dek: "Fall doesn't paint the leaves. It reveals colors that were there all along.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("Every fall, trees in many parts of the world put on a show. Green leaves turn yellow, orange and red, then drift to the ground. But where do those bright colors come from? The answer is a little surprising."),
      h("Green all summer"),
      p("Leaves are like tiny food factories. They use sunlight, water and air to make sugar for the tree. This is called photosynthesis. To do it, leaves need a green chemical called chlorophyll. All summer, leaves are so full of chlorophyll that green is the only color we see."),
      h("The hidden colors"),
      p("Leaves also contain yellow and orange chemicals called carotenoids. These are the same colors that make carrots orange and bananas yellow. They are in the leaves all summer long, but the green chlorophyll covers them up."),
      p("In the fall, days get shorter and nights get cooler. Trees get ready to rest for the winter, so they stop making chlorophyll. As the green fades away, the yellow and orange colors that were hiding finally show through."),
      fact("Where does red come from?", "Red and purple are different. Some trees, like many maples, make brand-new red chemicals called anthocyanins in the fall. Sunny days and cool nights help them make more, which is why some autumns are extra red."),
      h("Why do leaves fall?"),
      p("Thin, flat leaves would freeze and break in winter, and the tree would lose water through them. So the tree grows a layer of special cells where each leaf stem meets the branch. This layer slowly cuts the leaf off, and the wind does the rest. Next spring, new leaves will grow in their place."),
      list("Try it yourself", ["Collect leaves of different colors and sort them from green to red", "Press a leaf between two heavy books for a week to keep its colors", "Do a leaf rubbing: put paper over a leaf and rub it gently with the side of a crayon"]),
      p("Not every tree changes color. Pine trees and other evergreens keep their needles all year. But for trees that do, fall is the one time we get to see the colors that were hiding all along."),
    ],
    words: [
      { word: "photosynthesis", meaning: "the way plants use sunlight, water and air to make their own food" },
      { word: "chlorophyll", meaning: "the green chemical in leaves that captures sunlight" },
      { word: "evergreens", meaning: "trees and plants that stay green all year" },
    ],
    questions: [
      { question: "What makes leaves look green in the summer?", options: ["Chlorophyll", "Carotenoids", "Rainwater", "Anthocyanins"], correct: "A" },
      { question: "Why do yellow and orange colors appear in the fall?", options: ["The leaves soak them up from the soil", "Rain washes the green away", "The green fades and reveals colors that were already there", "Insects paint the leaves"], correct: "C" },
      { question: "Where does the red color in some leaves come from?", options: ["It was hidden there all summer", "Some trees make new red chemicals in the fall", "It comes from the sunset", "It is caused by frost"], correct: "B" },
      { question: "Why do trees drop their leaves before winter?", options: ["The leaves get too heavy", "Squirrels pull them off", "The tree wants to grow taller", "Thin leaves would freeze and the tree would lose water through them"], correct: "D" },
      { question: "What is photosynthesis?", options: ["How plants make food using sunlight, water and air", "How leaves change color", "How trees drink water", "How seeds grow into flowers"], correct: "A" },
    ],
  },
  {
    slug: "sleep-superpower",
    section: "Health",
    title: "Sleep: Your Brain's Nightly Superpower",
    dek: "While you snooze, your brain is busy sorting memories and getting you ready for tomorrow.",
    grades: "Grades 3–7",
    publishedOn: "2026-10-05",
    body: [
      p("You might think nothing happens when you sleep. You close your eyes, and the next thing you know, it is morning. But while your body rests, your brain is hard at work."),
      h("Sorting the day"),
      p("All day long, your brain collects information: a new spelling word, a soccer move, the name of a new friend. At night, it sorts through it all. It keeps what is important and strengthens it, a bit like saving a file on a computer. That is one reason students who sleep well often remember more of what they learned."),
      p("Sleep also helps your body grow and repair itself. Your body releases growth hormone during deep sleep, and your muscles recover from all the running and jumping you did that day."),
      fact("How much sleep do you need?", "Sleep experts say children ages 6 to 12 need about 9 to 12 hours of sleep each night. Teenagers need about 8 to 10 hours. Many people get less than that."),
      h("The stages of sleep"),
      p("Sleep happens in cycles that repeat several times each night. In light sleep, you can wake up easily. In deep sleep, your breathing slows and your body does most of its repair work. Then comes REM sleep, short for rapid eye movement. Your eyes dart around under your eyelids, and this is when most dreaming happens."),
      h("When you don't get enough"),
      p("Missing sleep can make it harder to pay attention, solve problems and stay in a good mood. Tired people are more likely to feel grumpy or upset over small things. Sleep even helps your body fight off germs."),
      list("Tips for a great night's sleep", ["Go to bed and wake up at about the same time every day, even on weekends", "Turn off screens about an hour before bed, because their light can trick your brain into thinking it is still daytime", "Keep your room cool, dark and quiet", "Read a book to help your mind slow down"]),
      p("So the next time someone tells you it is time for bed, remember: sleep is not wasted time. It is when your brain powers up for tomorrow."),
    ],
    words: [
      { word: "hormone", meaning: "a chemical messenger that tells parts of the body what to do" },
      { word: "cycles", meaning: "patterns that repeat over and over" },
      { word: "recover", meaning: "to get back to normal after being tired or hurt" },
    ],
    questions: [
      { question: "What does the brain do with information while you sleep?", options: ["Deletes all of it", "Sorts it and strengthens the important parts", "Sends it to your muscles", "Nothing at all"], correct: "B" },
      { question: "How much sleep do children ages 6 to 12 need each night?", options: ["About 5 to 6 hours", "About 7 hours", "About 9 to 12 hours", "About 14 to 16 hours"], correct: "C" },
      { question: "During which stage of sleep does most dreaming happen?", options: ["REM sleep", "Light sleep", "Deep sleep", "Waking up"], correct: "A" },
      { question: "Why should you turn off screens before bed?", options: ["Screens use too much electricity", "Their light can trick your brain into thinking it is daytime", "They make your room too cold", "Screens are too heavy to hold in bed"], correct: "B" },
      { question: "What is the author's main point?", options: ["Dreams can predict the future", "Everyone should stay up as late as they want", "Naps are better than night sleep", "Sleep is important work for your brain and body"], correct: "D" },
    ],
  },
  {
    slug: "math-of-a-soccer-ball",
    section: "Sports",
    title: "The Math Hiding in a Soccer Ball",
    dek: "The classic black-and-white ball is made of shapes that fit together like a puzzle.",
    grades: "Grades 4–7",
    publishedOn: "2026-10-05",
    body: [
      p("Think of a soccer ball. You probably picture the classic one, covered in black and white patches. That ball is not just sports equipment. It is also a clever math puzzle."),
      h("Pentagons and hexagons"),
      p("The classic soccer ball is made of 32 flat panels sewn together. Twelve of them are black pentagons, shapes with five sides. The other 20 are white hexagons, shapes with six sides."),
      p("Why those shapes? Flat shapes cannot make a perfect sphere on their own, but they can get close. Every black pentagon is surrounded by five white hexagons. When the panels are stitched together and the ball is filled with air, it puffs up into a round shape."),
      fact("A shape with a long name", "Mathematicians call the shape of the classic ball a truncated icosahedron. An icosahedron has 20 triangle faces. \"Truncated\" means each pointy corner is sliced off, and every slice leaves a flat pentagon behind."),
      h("Made for TV"),
      p("Early soccer balls were made of brown leather strips, a bit like a volleyball. The black-and-white design became famous at the 1970 World Cup in Mexico. It was one of the first World Cups shown on TV, and most people still had black-and-white televisions. The contrasting patches made the ball easier to see on screen."),
      h("Fewer panels today"),
      p("Modern balls look very different. Designers now use fewer panels with curvy edges, glued together instead of stitched. The ball used at the 2014 World Cup in Brazil had only six panels. Fewer seams can change how the ball moves through the air, so designers test new balls in wind tunnels and with robot legs that kick them again and again."),
      list("Count it yourself", ["Find a classic soccer ball and count the pentagons. You should get 12", "Pick one pentagon and count the hexagons touching it", "Look at a modern ball. How many panels can you find?"]),
      p("So the next time you kick a ball across the field, remember: you are kicking geometry. Math and sports have been teammates all along."),
    ],
    words: [
      { word: "pentagons", meaning: "flat shapes with five straight sides" },
      { word: "hexagons", meaning: "flat shapes with six straight sides" },
      { word: "contrasting", meaning: "very different from each other, like black and white" },
    ],
    questions: [
      { question: "How many panels does a classic soccer ball have?", options: ["12", "20", "32", "6"], correct: "C" },
      { question: "What shape are the black panels on a classic soccer ball?", options: ["Hexagons", "Pentagons", "Triangles", "Squares"], correct: "B" },
      { question: "Why did the black-and-white design become popular at the 1970 World Cup?", options: ["It was cheaper to make", "Players liked the colors", "It was the only ball available", "It was easier to see on black-and-white TVs"], correct: "D" },
      { question: "How many panels did the 2014 World Cup ball have?", options: ["Six", "Twelve", "Thirty-two", "Fifty"], correct: "A" },
      { question: "What does the word \"truncated\" mean in this article?", options: ["Painted black", "Made bigger", "Having the corners sliced off", "Filled with air"], correct: "C" },
    ],
  },
  {
    slug: "matisse-painting-with-scissors",
    section: "Arts",
    title: "The Artist Who Painted with Scissors",
    dek: "When illness kept Henri Matisse from his easel, he found a bold new way to make art.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("Henri Matisse was one of the most famous painters of the 1900s. He was known for wild, bright colors that did not always match real life. A face might be green. A sky might be pink. To Matisse, color was a way to show feelings."),
      h("A new problem"),
      p("In 1941, when Matisse was in his seventies, he became very sick and needed a big operation. Afterward, he often had to use a wheelchair or stay in bed. Standing at an easel to paint for hours was very hard."),
      p("Many people would have stopped making art. Matisse found another way."),
      h("Drawing with scissors"),
      p("Matisse had his assistants paint large sheets of paper with bright gouache, a kind of thick watercolor paint. Then he picked up a big pair of scissors and cut shapes straight out of the colored paper, without sketching them first. He called it \"drawing with scissors.\""),
      p("His assistants pinned the shapes to the walls of his studio, moving them around until Matisse was happy. Leaves, stars, birds, swimmers and swirling seaweed shapes covered the room like a giant garden."),
      fact("The Snail", "One of his most famous cut-outs, The Snail, was finished in 1953. It is made of colorful rectangles arranged in a spiral, like a snail's shell. It is almost three meters (about ten feet) tall."),
      quote("An artist must never be a prisoner of himself.", "Henri Matisse"),
      h("Big, bold and happy"),
      p("Matisse made some of his biggest works with scissors. He planned huge murals and colorful stained-glass windows the same way, pinning paper shapes to the wall until the design looked right. Many people say these late works are the happiest he ever made."),
      list("Make your own cut-out", ["Paint or color a few sheets of paper in bright colors and let them dry", "Cut out shapes without drawing them first. Try leaves, stars or waves", "Arrange them on a big sheet of paper, move them around, then glue them down"]),
      p("Matisse showed that a challenge does not have to be the end of something. Sometimes it is the start of something new."),
    ],
    words: [
      { word: "easel", meaning: "a stand that holds a painting while an artist works on it" },
      { word: "gouache", meaning: "a thick kind of watercolor paint with strong colors" },
      { word: "studio", meaning: "a room where an artist works" },
    ],
    questions: [
      { question: "What was Matisse known for in his paintings?", options: ["Tiny, careful details", "Only black and white", "Wild, bright colors that showed feelings", "Paintings of machines"], correct: "C" },
      { question: "Why did Matisse start making cut-outs?", options: ["Illness made it hard to stand at an easel and paint", "He ran out of paint", "His teacher told him to", "Scissors were cheaper than brushes"], correct: "A" },
      { question: "What did Matisse call his new way of making art?", options: ["Painting with glue", "Drawing with scissors", "Cutting the colors", "Paper sculpture"], correct: "B" },
      { question: "What is The Snail made of?", options: ["Stained glass", "Clay", "Painted wood", "Colorful paper shapes arranged in a spiral"], correct: "D" },
      { question: "What lesson does this story teach?", options: ["Art should always be small", "A challenge can lead to something new", "Only healthy people can make art", "Painting is better than cutting paper"], correct: "B" },
    ],
  },
  {
    slug: "monarch-migration",
    section: "Animals",
    title: "The Monarchs' Amazing Journey",
    dek: "Every fall, millions of butterflies fly thousands of miles to a forest they have never seen.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("Each autumn, something incredible happens across North America. Millions of orange-and-black monarch butterflies leave Canada and the United States and fly south. Their destination: mountain forests in central Mexico, up to about 4,800 kilometers (3,000 miles) away."),
      h("A trip without a map"),
      p("Here is the most amazing part. None of the butterflies making the trip has ever been there before. The monarchs that flew north in the spring were their great-grandparents. Somehow, the new butterflies find their way to the very same forests."),
      p("Scientists think monarchs use the Sun like a compass, along with a sense of Earth's magnetic field. They are still working to understand exactly how it works."),
      fact("The super generation", "Most monarchs live only two to six weeks. But the butterflies born in late summer are different. This \"super generation\" can live up to eight or nine months, long enough to fly to Mexico, spend the winter and start the trip back north."),
      h("Winter in the trees"),
      p("In Mexico, the monarchs gather on fir trees high in the mountains. So many butterflies crowd together that branches bend under their weight, and whole tree trunks look orange. The cool mountain air helps them rest and save energy until spring."),
      h("Milkweed matters"),
      p("When spring comes, the monarchs fly north and lay their eggs on one special plant: milkweed. It is the only plant monarch caterpillars can eat. Milkweed also makes the caterpillars taste bad to birds, which helps protect them."),
      p("Monarch numbers have dropped over the years, partly because there is less milkweed growing along their routes. Many people, schools and towns now plant milkweed and other flowers to help."),
      list("How you can help monarchs", ["Plant milkweed that grows naturally in your area", "Grow flowers that bloom in late summer and fall to feed butterflies on their trip", "Avoid using bug spray on plants where butterflies feed"]),
      p("A monarch weighs less than a paper clip. Yet together, these tiny travelers make one of the greatest migrations in the animal world."),
    ],
    words: [
      { word: "migration", meaning: "a long journey animals make at the same time every year" },
      { word: "destination", meaning: "the place someone or something is traveling to" },
      { word: "generation", meaning: "all the animals or people born around the same time" },
    ],
    questions: [
      { question: "Where do monarch butterflies fly in the fall?", options: ["To mountain forests in central Mexico", "To the Arctic", "To islands in the Pacific Ocean", "To deserts in Africa"], correct: "A" },
      { question: "What is surprising about the butterflies that make the trip south?", options: ["They fly only at night", "They have never been to those forests before", "They travel in pairs", "They swim part of the way"], correct: "B" },
      { question: "What makes the \"super generation\" special?", options: ["They are twice as big", "They are a different color", "They can live up to eight or nine months", "They never eat"], correct: "C" },
      { question: "Why is milkweed so important to monarchs?", options: ["It keeps them warm in winter", "It helps them see the Sun", "It is where they sleep at night", "It is the only plant monarch caterpillars can eat"], correct: "D" },
      { question: "In this article, \"migration\" means…", options: ["a long journey animals make every year", "a type of butterfly wing", "a kind of flower", "a winter storm"], correct: "A" },
    ],
  },
  {
    slug: "bees-tiny-workers",
    section: "Science",
    title: "Bees: Tiny Workers, Giant Job",
    dek: "A honeybee hive is a busy city where every bee has a job, and they talk by dancing.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("Take a bite of an apple, a strawberry or an almond, and you can thank a bee. Bees and other pollinators help many of the plants we eat make fruit and seeds. Scientists estimate that about one out of every three bites of food we eat depends on pollinators."),
      h("A city in a hive"),
      p("A honeybee hive can hold tens of thousands of bees in the summer. Each hive has one queen. Her job is to lay eggs, up to about 2,000 in a single day. Male bees, called drones, have one job: to mate with a queen from another hive."),
      p("Almost all the other bees are workers, and every worker is female. As they grow up, they take on different jobs. Young workers clean the hive and feed the babies. Older workers build wax honeycomb, guard the entrance and finally fly out to gather food."),
      fact("Sweet math", "To make one pound of honey, bees must visit about two million flowers. A single worker bee makes only about one-twelfth of a teaspoon of honey in her whole life."),
      h("The waggle dance"),
      p("When a worker bee finds a great patch of flowers, she flies back to the hive to tell the others. She does it by dancing! In the waggle dance, she runs in a straight line while wiggling her body, then circles around and does it again."),
      p("The direction of her run shows which way to fly compared to the Sun. The longer she waggles, the farther away the flowers are. Other bees follow the directions and find the flowers on their own."),
      h("How pollination works"),
      p("As a bee drinks sweet nectar from a flower, a fine yellow powder called pollen sticks to her fuzzy body. When she visits the next flower of the same kind, some of that pollen rubs off. Plants need this pollen to make fruit and seeds."),
      list("How to help bees", ["Plant flowers that bloom at different times of the year", "Leave some dandelions and clover in the grass for bees to visit", "Put out a shallow dish of water with pebbles so bees can drink safely"]),
      p("Bees are small, but their work feeds the world. Next time one buzzes by, give it some space. It is busy doing an important job."),
    ],
    words: [
      { word: "pollinators", meaning: "animals like bees that carry pollen from flower to flower" },
      { word: "nectar", meaning: "a sweet liquid inside flowers" },
      { word: "pollen", meaning: "a fine powder flowers make that helps plants create seeds" },
    ],
    questions: [
      { question: "What is the queen bee's main job?", options: ["Guarding the hive", "Laying eggs", "Making honey", "Dancing"], correct: "B" },
      { question: "Which statement about worker bees is true?", options: ["They are all male", "They never leave the hive", "They are all female and do different jobs as they grow up", "They only work at night"], correct: "C" },
      { question: "What does the waggle dance tell other bees?", options: ["Where to find flowers", "That it is time to sleep", "That the queen is hungry", "That it is going to rain"], correct: "A" },
      { question: "How does pollen get from one flower to another?", options: ["The wind carries all of it", "Flowers throw it", "Rain washes it over", "It sticks to a bee's fuzzy body and rubs off on the next flower"], correct: "D" },
      { question: "Why does the author say bees have a \"giant job\"?", options: ["Bees are very large insects", "Bees build giant hives", "Their pollination helps grow much of the food we eat", "Bees work for giants"], correct: "C" },
    ],
  },
  {
    slug: "why-the-moon-changes-shape",
    section: "Space",
    title: "Why the Moon Seems to Change Shape",
    dek: "The Moon doesn't really shrink and grow. It's all about sunlight and where you're standing.",
    grades: "Grades 3–5",
    publishedOn: "2026-10-05",
    body: [
      p("Some nights the Moon is a big glowing circle. Other nights it is a thin silver smile, and some nights you cannot see it at all. Is the Moon really changing shape? Not at all. It is always a round ball of rock. What changes is how much of its sunny side we can see."),
      h("The Moon doesn't make light"),
      p("The Moon does not glow on its own. It shines because sunlight bounces off it. At any moment, the Sun lights up half of the Moon, just like it lights up half of Earth during the day."),
      p("The Moon travels all the way around Earth about once a month. As it moves, we see different amounts of its lit-up half. These changing shapes are called phases."),
      list("The phases of the Moon", ["New moon: the sunny side faces away from us, so the Moon looks dark", "Crescent: a thin sliver of light appears", "First quarter: we see half of the Moon lit up", "Gibbous: more than half is lit", "Full moon: the whole sunny side faces us", "Then the Moon shrinks back through gibbous, last quarter and crescent"]),
      fact("Waxing and waning", "When the lit part is growing bigger each night, we say the Moon is waxing. When it is getting smaller, it is waning. One full cycle, from new moon to new moon, takes about 29 and a half days."),
      h("Always the same face"),
      p("Here is something curious: we always see the same side of the Moon. The Moon spins around exactly once each time it travels around Earth, so the same face is always pointed toward us. The side we never see from Earth is often called the far side."),
      h("A long, long history"),
      p("People have watched the Moon's phases for thousands of years. Many calendars around the world, like the traditional Chinese calendar, are based on the Moon. The word \"month\" even comes from the word \"moon.\""),
      list("Try it yourself", ["In a dark room, shine a flashlight on a ball held at arm's length", "Turn slowly in a circle while holding the ball, and watch the lit part change", "Keep a Moon journal: draw the Moon each night for a month"]),
      p("So tonight, look up. Whatever shape you see, you are watching sunlight, a spinning Earth and a traveling Moon all working together."),
    ],
    words: [
      { word: "phases", meaning: "the different shapes the Moon appears to have" },
      { word: "crescent", meaning: "a curved shape like a thin slice of a circle" },
      { word: "waxing", meaning: "growing bigger, used to describe the Moon" },
    ],
    questions: [
      { question: "Why does the Moon shine?", options: ["It is made of glowing rock", "Sunlight bounces off it", "It has lights on it", "It reflects city lights from Earth"], correct: "B" },
      { question: "What are the Moon's changing shapes called?", options: ["Eclipses", "Seasons", "Phases", "Orbits"], correct: "C" },
      { question: "About how long does it take to go from one new moon to the next?", options: ["29 and a half days", "7 days", "One year", "24 hours"], correct: "A" },
      { question: "When the lit part of the Moon gets smaller each night, the Moon is…", options: ["waxing", "glowing", "spinning", "waning"], correct: "D" },
      { question: "Why do we always see the same side of the Moon?", options: ["The far side is always dark", "The Moon doesn't move", "The Moon spins once each time it goes around Earth", "Clouds always cover the other side"], correct: "C" },
    ],
  },
];

/** Recent news, newest first. */
export const WORLD_NEWS = NEWS_ARTICLES.filter((a) => a.kind === "news").sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
/** Timeless feature stories, in issue order. */
export const FEATURES = NEWS_ARTICLES.filter((a) => a.kind !== "news");

export const newsBySlug = (slug: string) => NEWS_ARTICLES.find((a) => a.slug === slug) ?? null;
export const newsByTitle = (title: string | null | undefined) => (title ? NEWS_ARTICLES.find((a) => a.title === title) ?? null : null);

/** Plain words in a story (for read-time and level checks). */
export function newsWordCount(a: NewsArticle) {
  const text = a.body.map((b) => b.kind === "list" ? [b.title, ...b.items].join(" ") : b.kind === "fact" ? `${b.title} ${b.text}` : b.text).join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}
/** Minutes to read at a relaxed pace for young readers. */
export const newsReadMinutes = (a: NewsArticle) => Math.max(2, Math.round(newsWordCount(a) / 130));
