// Source-checked science, nature and culture 5-Minute Reads for the October 2026 collection.
import type { NewsArticle, NewsSection, NewsQuestion } from "./ariseNews";
type Draft = { slug:string; section:NewsSection; title:string; dek:string; grades:string; photo?:{file:string;alt:string;focus?:string;credit?:string;license?:string}; sources:{name:string;url:string}[]; body:string; words:[string,string][]; questions:[string,string,string,string,string][] };
const drafts: Draft[] = [
  {
    "slug": "coral-reefs-underwater-cities",
    "section": "Nature",
    "title": "Coral Reefs: Tiny Builders, Giant Underwater Cities",
    "dek": "Corals are animals, and their partnerships help create homes for ocean life.",
    "grades": "Grades 4–8",
    "photo": {
      "file": "Underwater photo of coral reef.jpg",
      "alt": "Fish swimming around a colorful coral reef",
      "focus": "50% 45%",
      "credit": "Jerry Reid, U.S. Fish and Wildlife Service",
      "license": "Public domain"
    },
    "sources": [
      {
        "name": "NOAA: Coral reef ecosystems",
        "url": "https://www.noaa.gov/education/resource-collections/marine-life/coral-reef-ecosystems"
      },
      {
        "name": "NOAA: What is coral bleaching?",
        "url": "https://oceanservice.noaa.gov/facts/coral_bleach.html?os=0"
      }
    ],
    "body": "A coral reef can look like a crowded city beneath the waves. Fish glide through narrow spaces, crabs hide in cracks, and tiny animals search for food. Yet the colorful branches and bumpy towers are not rocks or plants. Coral is made by animals. Each coral animal, called a polyp, has a soft body and tiny tentacles. Many polyps live together in a colony, and some build hard skeletons that become part of the reef.\n\n## How little animals build something enormous\n\nThink about a single brick in a building. It is small, but many bricks together make a wall. Reef-building corals work in a similar way. A polyp makes a hard structure using minerals from seawater. As generations of polyps grow, their skeletons can form large structures. The living animals are mostly on the outside, while the older layers remain beneath them. This is why a reef can grow over many years.\n\nCorals need food and suitable water, but many also have a surprising helper. Microscopic algae live inside their tissues. The algae use sunlight to make sugars, and the coral benefits from those nutrients. The coral provides the algae with a protected place to live. When both organisms benefit from the relationship, scientists call it mutualism. The algae also help give many corals their bright colors.\n\n## A home for many neighbors\n\nReefs provide hiding spaces, feeding areas, and nurseries where young fish can grow. Some reef fish nibble algae, while others hunt smaller animals. Larger animals may visit to find food. Every creature has a role. If one part of this community changes, other parts can be affected as well. A healthy reef is not just pretty scenery; it is a working ecosystem full of connections.\n\nCoral reefs also matter to people. They support fishing and tourism in coastal communities, and some reefs help weaken waves that would otherwise strike shorelines. People study coral reefs to understand ocean life and environmental change. Many families depend on healthy reefs for food, jobs, or protection during storms.\n\n## Why a reef can turn white\n\nWarm water and other stressful conditions can cause a coral to lose the algae living inside it. Without the algae's colors, the pale skeleton underneath becomes easier to see. This process is called coral bleaching. A bleached coral is not automatically dead, but it has lost an important food partner. If conditions improve soon enough, it may recover. If stressful conditions continue, the coral can weaken or die.\n\nScientists monitor reef temperatures and other conditions to understand when bleaching may occur. Communities can also reduce local damage by keeping pollution and trash out of waterways, protecting habitats, and using boats and snorkeling equipment carefully around reefs. No single action solves every problem, but small choices help protect fragile places.\n\nA reef may seem too large to be affected by one small change, but ecosystems are built from connected relationships. Imagine that warm water weakens a section of living coral. Some fish may lose places to hide, and animals that feed on those fish may have to search elsewhere. That does not mean every reef reacts in exactly the same way. Scientists look for patterns, compare different places, and measure changes over time. When researchers say a reef is recovering, they do not mean all its problems have disappeared. They are watching for signs that corals and other living things are growing again. Careful observations help people decide which protections are working.\n\n## Imagine being a reef explorer\n\nSuppose you are making a map of an underwater neighborhood. You spot one fish hiding, another eating algae, and a crab under a ledge. Instead of just counting the animals, ask how each one uses the reef. Who needs shelter? Who finds food here? By asking those questions, you begin to see the reef as more than a collection of bright colors. You see a city built by tiny animals and shared by many neighbors.",
    "words": [
      [
        "polyp",
        "a small coral animal with a soft body and tentacles"
      ],
      [
        "mutualism",
        "a relationship that helps both living things"
      ],
      [
        "bleaching",
        "the loss of coral's algae, making it look pale or white"
      ]
    ],
    "questions": [
      [
        "What kind of living thing is a coral polyp?",
        "An animal",
        "A tree",
        "A type of sand",
        "A mineral"
      ],
      [
        "What do many reef corals build?",
        "Hard skeletons",
        "Bird nests",
        "Ice caves",
        "Clouds"
      ],
      [
        "What do algae provide for many corals?",
        "Nutrients made using sunlight",
        "Pebbles",
        "Ocean waves",
        "Salt crystals"
      ],
      [
        "What can cause coral bleaching?",
        "Stress such as unusually warm water",
        "Too many stars",
        "An eclipse",
        "Fast wind on land"
      ],
      [
        "Does bleaching always mean coral is already dead?",
        "No, some coral can recover",
        "Yes, every coral dies immediately",
        "Only fish can recover",
        "Only shallow reefs can bleach"
      ]
    ]
  },
  {
    "slug": "volcanoes-magma-to-lava",
    "section": "Science",
    "title": "Inside a Volcano: When Rock Starts to Flow",
    "dek": "Why some volcanoes erupt gently, others explode, and scientists keep careful watch.",
    "grades": "Grades 4–8",
    "photo": {
      "file": "1959 eruption of Kilauea Volcano.jpg",
      "alt": "A 1959 lava fountain at Kilauea volcano",
      "focus": "50% 45%",
      "credit": "Hawaiian Volcano Observatory, USGS",
      "license": "Public domain"
    },
    "sources": [
      {
        "name": "U.S. Geological Survey: About Volcanoes",
        "url": "https://www.usgs.gov/programs/VHP/about-volcanoes"
      },
      {
        "name": "USGS: Principal types of volcanoes",
        "url": "https://pubs.usgs.gov/gip/volc/types.html"
      }
    ],
    "body": "Imagine standing far from a mountain and seeing an orange glow against the night sky. Deep inside Earth, melted rock has found a way upward. It might pour out across the ground, burst into a fountain, or send ash high into the air. All of these can be signs of volcanic activity. Volcanoes are openings in Earth's crust where hot material and gases can reach the surface. The details of an eruption depend on what is happening underground.\n\n## Magma below, lava above\n\nMolten rock beneath Earth's surface is called magma. Once it reaches the surface, it is called lava. The two words describe the same kind of material in different places. Magma can contain crystals and gases as well as melted rock. Gas pressure and the fact that magma can be less dense than surrounding rock help move it toward cracks and openings called vents.\n\nSome lava is runny enough to spread across land in long flows. Other magma is much thicker. Thick magma can trap gas, allowing pressure to build before an explosive eruption. Imagine gently opening a bottle of fizzy water and then shaking another bottle before opening it. The comparison is not exact, but it helps explain why trapped gas makes a difference to an eruption.\n\n## Not every volcano looks the same\n\nShield volcanoes are broad with gentle slopes. Many of Hawaii's volcanoes have this shape because repeated flows of relatively runny lava spread outward. Composite volcanoes, also called stratovolcanoes, tend to be steeper. They are built from layers of lava, ash, and other erupted material. A cinder cone can form when pieces of lava cool in the air and fall around a vent.\n\nThe landscape around a volcano also changes over time. Fresh lava cools to become solid rock. Wind and rain slowly wear it down. Plants may begin growing in places that once looked empty. Volcanic rocks can eventually become part of soils. Earth is constantly being reshaped, sometimes in dramatic hours and sometimes over thousands of years.\n\n## Why scientists watch closely\n\nVolcano scientists use several kinds of clues. Small earthquakes may show that magma is moving underground. Changes in the shape of a mountain can reveal swelling. Gas measurements and temperature readings provide more information. No one can predict every eruption exactly, so scientists compare many clues and explain uncertainty when communicating with nearby communities.\n\nAn eruption can create dangers beyond flowing lava. Tiny pieces of volcanic rock called ash can irritate lungs, damage machines, and make travel difficult. Fast-moving hot mixtures of rock and gas can be extremely dangerous. That is why people should follow official warnings rather than approaching an eruption for a better photograph.\n\nThe temperature of lava is only one part of what makes an eruption dangerous. Scientists also consider the direction a flow may travel, the slope of the land, and the location of nearby communities. A slow lava flow can destroy roads or buildings even if people have time to move away. Fine ash can travel with the wind and reach places far from the volcano. That is why hazards maps show different kinds of danger in different areas. If you lived near a volcano, a good question would not be whether volcanoes are exciting to watch. It would be where to find trustworthy local warnings and how to follow a safe plan.\n\n## A volcano is not only a disaster\n\nVolcanoes help scientists understand how Earth works. They create new rock, shape islands and mountains, and reveal what lies beneath the surface. If you saw two volcanoes in photographs, you could compare their slopes, nearby land, and signs of eruptions. Those observations might help you ask a bigger question: what could their shapes tell you about the material that came out of them?",
    "words": [
      [
        "magma",
        "melted rock beneath Earth's surface"
      ],
      [
        "vent",
        "an opening where volcanic material reaches the surface"
      ],
      [
        "ash",
        "tiny broken pieces of volcanic rock thrown into the air"
      ]
    ],
    "questions": [
      [
        "What do we call melted rock below Earth's surface?",
        "Magma",
        "Ash",
        "Sand",
        "Soil"
      ],
      [
        "What is magma called after it reaches the surface?",
        "Lava",
        "Ice",
        "Granite only",
        "Steam"
      ],
      [
        "Which volcano type usually has broad, gentle slopes?",
        "Shield volcano",
        "Cinder cone only",
        "Sand dune",
        "Glacier"
      ],
      [
        "What can scientists monitor for clues to magma movement?",
        "Small earthquakes and ground changes",
        "Only bird songs",
        "Moon phases alone",
        "Cloud shapes only"
      ],
      [
        "Why can volcanic ash be dangerous?",
        "It can harm breathing and machinery",
        "It turns instantly into snow",
        "It is always cold water",
        "It blocks gravity"
      ]
    ]
  },
  {
    "slug": "why-rivers-make-curves",
    "section": "Science",
    "title": "Why Rivers Wiggle: The Science of a Meander",
    "dek": "Flowing water bends, moves sand, and redraws maps over time.",
    "grades": "Grades 4–7",
    "photo": {
      "file": "Meandering river aerial photography.jpg",
      "alt": "An aerial photograph of a winding river in Alaska",
      "focus": "50% 45%",
      "credit": "Steve Hillebrand, U.S. Fish and Wildlife Service",
      "license": "Public domain"
    },
    "sources": [
      {
        "name": "U.S. Geological Survey: Find a Feature — Meander",
        "url": "https://www.usgs.gov/educational-resources/find-feature-meander"
      }
    ],
    "body": "Look at a river on a map. Some rivers seem to run almost straight, while others curl back and forth like a ribbon. Why would water take the long way around? A bend in a river is called a meander. Meanders are common where rivers cross flatter land. The water is moving downhill, but it also changes the ground beneath it. Over time, the river can help create the curves that direct its own flow.\n\n## Faster water, slower water\n\nPicture a stream turning around a bend. The fastest water often pushes toward the outside bank. That movement can wear away soil and rock. Scientists call this process erosion. On the inside of the bend, the water is often slower. It may drop sand and other tiny pieces of material called sediment. Dropping material is called deposition. Erosion and deposition can happen at the same time on opposite sides of the river.\n\nThose two processes help make a bend larger. As material is removed from the outside bank, the river may shift in that direction. Meanwhile, sandbars can grow on the inside. Repeat the process during many seasons of changing water levels, and the river's position can gradually change. This does not mean every bend grows in exactly the same way. Rocks, vegetation, floods, and the shape of the valley matter too.\n\n## Curves that almost meet\n\nSometimes two neighboring river bends move closer together until only a narrow neck of land separates them. During a flood, water may cut across that neck and make a shorter path. The older loop can become separated from the main channel. When it holds water, the curved leftover body is called an oxbow lake because its shape resembles a bent wooden yoke once used with farm animals.\n\nFrom above, an oxbow lake may look like a giant letter C resting beside a newer, straighter river channel. The shape is a clue to the river's past. Even if you cannot watch a river change over a hundred years, its banks and nearby lakes can tell part of the story.\n\n## Rivers move important things\n\nA river does not carry only water. It transports soil, sand, and nutrients. Deposited sediment can help create floodplains, the broad low areas beside rivers. These areas may support plants and wildlife, but they can also flood when water rises. That is why scientists study where rivers have moved in the past before people decide where to build roads, homes, and bridges.\n\nEngineers sometimes straighten channels to make water move differently, but changing one section can affect conditions elsewhere. A bend may slow water, provide habitat, or spread energy across a longer path. Understanding a river means looking at the whole system rather than only at one troublesome curve.\n\nA river's course can also reveal why old maps and new maps sometimes disagree. A channel that once touched a field may later run farther away. A sandy area may appear where water used to flow, while another bank loses ground. Scientists do not assume they can tell the future from one photograph. They compare images from different years, measure changes, and study floods to understand the pattern. You can try this kind of thinking with two maps from different dates. Circle places that look unchanged, then mark one bend that has moved. Asking why the differences happened is often more useful than memorizing a single river fact.\n\n## Be a river detective\n\nYou can investigate meanders without stepping into dangerous water. Find a public map or satellite image of a river. Trace the outside and inside of several bends. Look for sandbars, low banks, and curved lakes. Then predict which parts of the river might change during future floods. You may not know the answer for sure, but you will be thinking like a geologist: using visible evidence to understand a changing landscape.",
    "words": [
      [
        "meander",
        "a bend or curve in a river"
      ],
      [
        "erosion",
        "the wearing away and movement of earth materials"
      ],
      [
        "sediment",
        "pieces of sand, soil, and rock carried by water"
      ]
    ],
    "questions": [
      [
        "What is a meander?",
        "A bend in a river",
        "A type of fish",
        "A mountain peak",
        "A cloud"
      ],
      [
        "Where does erosion often happen on a river bend?",
        "On the outside bank",
        "Only at the source",
        "Only in the middle of the lake",
        "High above the water"
      ],
      [
        "What happens during deposition?",
        "Water drops carried material",
        "A river stops moving forever",
        "Clouds sink into the ground",
        "Fish build a bridge"
      ],
      [
        "What can form when an old river loop gets cut off?",
        "An oxbow lake",
        "A volcano",
        "A glacier",
        "A desert"
      ],
      [
        "Why do scientists study old river paths?",
        "To understand flooding and how rivers change",
        "To count every raindrop",
        "To stop all plant growth",
        "To prevent tides in the ocean"
      ]
    ]
  },
  {
    "slug": "lunar-new-year-more-than-one-tradition",
    "section": "World",
    "title": "Lunar New Year: Many Celebrations, One Fresh Start",
    "dek": "Families across Asia welcome the new year with food, greetings, lanterns, and different traditions.",
    "grades": "Grades 4–8",
    "photo": {
      "file": "20190202 Nagasaki Chinese New Year lantern-3.jpg",
      "alt": "Colorful lanterns for a Lunar New Year festival in Nagasaki, Japan",
      "focus": "50% 45%",
      "credit": "Balon Greyjoy",
      "license": "CC0 1.0"
    },
    "sources": [
      {
        "name": "Smithsonian National Museum of Asian Art: Lunar New Year",
        "url": "https://asia.si.edu/whats-on/events/celebrations/lunar-new-year-celebration/"
      },
      {
        "name": "Smithsonian Asian Pacific American Center: Lunar New Year",
        "url": "https://apa.si.edu/now/lunar-new-year/"
      }
    ],
    "body": "For some families, New Year's Day is January 1. For others, one of the biggest celebrations of the year begins on a different date, often in January or February. Lunar New Year is celebrated in many communities across Asia and around the world. The celebrations are not identical everywhere. The name is often used broadly for festivals that follow lunisolar calendars, which pay attention to both the Moon and the seasons.\n\n## Why the date changes\n\nA solar calendar follows Earth's yearly trip around the Sun. A lunar month follows the Moon's changing phases. A lunisolar calendar uses both kinds of information to keep months connected to the seasons. Because this calendar does not line up exactly with the calendar used for most school schedules, Lunar New Year moves to a different date on that school calendar from one year to the next.\n\nIn China, the festival is commonly called the Spring Festival. In Vietnam, many families celebrate Tết. In Korea, Seollal includes family gatherings and customs such as honoring elders. These celebrations share some ideas about renewal and family, but each has its own history, foods, and practices. It is important not to assume that every family celebrates in the same way.\n\n## A home ready for visitors\n\nBefore the new year, some households clean and decorate their homes. Cleaning can symbolize making room for a fresh beginning. In many Chinese homes, red decorations and paper cuttings bring bright color to doorways and windows. Red is often associated with good fortune. Some families exchange red envelopes containing money as a gift or good wish for younger relatives.\n\nA family meal can be the center of the celebration. In some Chinese households, fish may be served because its name sounds like a word connected to abundance. Korean families may eat tteokguk, a rice cake soup. Vietnamese families have their own traditional foods, including rice cakes made for the holiday. The foods are not interchangeable decorations; they carry memories, local ingredients, and family traditions.\n\n## The joy of being together\n\nSome communities organize lion dances, drumming, festivals, and lantern displays. Children may wear new clothes or visit relatives. Elders may offer greetings or wishes for health and success. In many places, the festivities continue beyond a single day. The exact schedule depends on the community, and some people celebrate at home rather than at big public events.\n\nIf you visit a festival or learn about a friend's celebration, good questions matter. Ask what the holiday means to that person or family instead of telling them what it must mean. A family might follow traditions handed down for generations, mix old customs with new ones, or not celebrate at all.\n\nA holiday tradition can also tell a story about migration. Families sometimes move to a different city or country, bringing familiar foods, greetings, and decorations with them. Over time, celebrations may change to fit a new home. A family might use ingredients available at a local store or invite friends who did not grow up with the holiday. Those changes do not automatically make the celebration less meaningful. They can show how people preserve memories while creating new ones. If your classroom includes families with different calendars or traditions, listening to one another's experiences can help everyone understand that a shared date does not have to carry exactly the same meaning for all.\n\n## A fresh beginning in many languages\n\nImagine creating a new-year card for someone you care about. You could draw a lantern or a flower, write a kind wish, or include an important family memory. The point is not to make everyone's celebration the same. It is to recognize that people can welcome a new beginning in many meaningful ways. Learning the differences is part of respecting the traditions that make a community rich.",
    "words": [
      [
        "lunisolar",
        "using both the Moon and the Sun to organize a calendar"
      ],
      [
        "tradition",
        "a custom passed from one generation to another"
      ],
      [
        "abundance",
        "having plenty of something"
      ]
    ],
    "questions": [
      [
        "When does Lunar New Year often occur on the school calendar?",
        "January or February",
        "Only July",
        "Only October",
        "Always January 1"
      ],
      [
        "What does a lunisolar calendar use?",
        "Both the Moon and the Sun",
        "Only clocks",
        "Only the weather",
        "Only stars"
      ],
      [
        "What is Lunar New Year commonly called in Vietnam?",
        "Tết",
        "Seollal",
        "Hanukkah",
        "Mardi Gras"
      ],
      [
        "What can cleaning a home symbolize before the new year?",
        "Making room for a fresh beginning",
        "Ending the school year",
        "Stopping winter forever",
        "Preparing for a storm"
      ],
      [
        "Why does the article describe different foods and customs?",
        "Communities celebrate in different ways",
        "All families celebrate exactly alike",
        "Only one country celebrates",
        "Food never has meaning"
      ]
    ]
  }
];
const LETTERS = ["A","B","C","D"] as const;
function questionsOf(d: Draft): NewsQuestion[] { return d.questions.map(([question,correct,...wrong],index) => { const slot=[0,2,1,3,0][index]; const options=[...wrong]; options.splice(slot,0,correct); return {question,options:options as NewsQuestion["options"],correct:LETTERS[slot]}; }); }
export const OCTOBER_FEATURES: NewsArticle[] = drafts.map(d=>({slug:d.slug,kind:"feature",section:d.section,title:d.title,dek:d.dek,grades:d.grades,publishedOn:"2026-10-22",photo:d.photo,sources:d.sources,body:d.body.split(/\n\n/).map(t=>t.startsWith("## ") ? {kind:"h" as const,text:t.slice(3)} : {kind:"p" as const,text:t}),words:d.words.map(([word,meaning])=>({word,meaning})),questions:questionsOf(d)}));
