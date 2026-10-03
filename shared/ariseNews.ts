// Arise News: kid-friendly feature stories. Each story becomes a 5-point quiz
// in the library (see server/ariseNews.ts), so readers earn points the same way
// they do for books: read, then pass the quiz (70% or better).
//
// Stories are evergreen (science, nature, history, the arts, the world) so they
// stay true long after they're published. Keep paragraphs short, define harder
// words in `words`, and write five questions that can be answered from the text.

export type NewsSection = "Science" | "Animals" | "Space" | "World" | "History" | "Nature" | "Health" | "Sports" | "Arts" | "Reading";

export type NewsBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "fact"; title: string; text: string }
  | { kind: "quote"; text: string; by?: string }
  | { kind: "list"; title: string; items: string[] };

export type NewsQuestion = { question: string; options: [string, string, string, string]; correct: "A" | "B" | "C" | "D" };

export type NewsArticle = {
  slug: string;
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
export const NEWS_ISSUE = { number: 1, name: "Fall 2026", publishedOn: "2026-10-05" };

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
    slug: "libraries-on-the-move",
    section: "Reading",
    title: "Libraries on the Move",
    dek: "Camels, donkeys and boats are carrying books to kids who live far from a library.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("Imagine waiting all week for the library to arrive. Not a building, but a camel with boxes of books strapped to its back. For some kids in northeastern Kenya, that is how the library comes to town."),
      p("Many families there are nomads. They move from place to place to find water and grass for their animals. A library building would be left behind, so Kenya's national library service sends the books instead. Since 1996, camel caravans have carried books to villages near the town of Garissa."),
      fact("Why camels?", "Camels can walk across hot, sandy land where there are few roads. They can go many days without drinking water, and a single camel can carry hundreds of books."),
      h("A donkey named Alfa"),
      p("Far away in Colombia, a teacher named Luis Soriano had a similar idea. Many children in the countryside near his home had no books at all. So he loaded two donkeys, Alfa and Beto, and set off on dusty trails to bring stories to them."),
      p("His project became known as the Biblioburro, which means \"donkey library\" in Spanish. Luis reads aloud, helps kids with homework and lends books until his next visit. Over the years, people around the world have donated thousands of books to keep it going."),
      h("Floating libraries"),
      p("In Bangladesh, heavy rains flood rivers for months every year. Roads wash away, and so do trips to school. A group there built boats that work as floating classrooms and libraries. The boats stop along the river to pick up students, and solar panels on the roof power lights and computers."),
      list("Other libraries on the move", ["Bookmobiles: buses and vans full of books that visit neighborhoods", "Little Free Libraries: small boxes in front yards where anyone can take or leave a book", "Bike libraries: bicycles with book carts that roll into parks"]),
      p("All of these libraries share one big idea: every kid deserves a chance to read, no matter how far away they live. If the kids cannot get to the books, the books will find a way to get to the kids."),
    ],
    words: [
      { word: "nomads", meaning: "people who move from place to place instead of living in one spot" },
      { word: "caravans", meaning: "groups of animals or vehicles traveling together" },
      { word: "donated", meaning: "gave something away to help others" },
    ],
    questions: [
      { question: "Why does the library in northeastern Kenya travel by camel?", options: ["Camels are faster than trucks on highways", "Many families move around, and camels can cross hot, sandy land with few roads", "The library building burned down", "Camels can read the books to children"], correct: "B" },
      { question: "What does the word \"Biblioburro\" mean?", options: ["Book bus", "Floating school", "Donkey library", "Reading camel"], correct: "C" },
      { question: "Why did people in Bangladesh build floating libraries?", options: ["Floods wash away roads for months every year", "Boats are cheaper than books", "Kids there prefer to read on the water", "There are no trees for building libraries"], correct: "A" },
      { question: "In this story, the word \"nomads\" means people who…", options: ["live in big cities", "write books", "work in libraries", "move from place to place"], correct: "D" },
      { question: "What big idea do all of the traveling libraries share?", options: ["Animals make the best librarians", "Every kid deserves a chance to read, no matter where they live", "Books should only be read outside", "Libraries should be closed on weekends"], correct: "B" },
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
    slug: "festivals-of-light",
    section: "World",
    title: "Festivals of Light Around the World",
    dek: "From glowing lamps to floating lanterns, people everywhere celebrate by lighting up the dark.",
    grades: "Grades 3–6",
    publishedOn: "2026-10-05",
    body: [
      p("When the days grow short and the nights grow long, people all over the world find ways to fill the darkness with light. Here are four festivals that shine."),
      h("Diwali"),
      p("Diwali is celebrated by Hindus, Sikhs and Jains in India and around the world. It usually falls in October or November and lasts about five days. Families clean their homes, light rows of small clay lamps called diyas and make colorful patterns on the floor called rangoli. Diwali celebrates light winning over darkness and good winning over evil."),
      h("Hanukkah"),
      p("Hanukkah is a Jewish holiday that lasts eight nights, usually in December. It remembers a time long ago when, as the story goes, a small amount of oil kept a temple lamp burning for eight days. Each night, families light one more candle on a menorah. A special menorah for Hanukkah holds nine candles: one for each night, plus a helper candle used to light the others."),
      fact("Treats that shine too", "During Hanukkah, many families eat foods fried in oil, like potato pancakes called latkes and jelly doughnuts. During Diwali, families share sweets with neighbors and friends."),
      h("Loy Krathong"),
      p("In Thailand, people celebrate Loy Krathong on the night of a full moon, usually in November. They make small floating baskets called krathongs, often from banana leaves, and decorate them with flowers and a candle. Then they set them afloat on rivers and lakes. Thousands of tiny lights drift across the water at once."),
      h("The Lantern Festival"),
      p("In China, the Lantern Festival marks the end of the Lunar New Year celebrations. It takes place on the fifteenth day of the new year, when the moon is full. Streets glow with red lanterns, some shaped like animals. Many lanterns have riddles written on them, and people try to guess the answers."),
      list("Light up your own celebration", ["Make a paper lantern from colored paper and a string of battery lights", "Draw a rangoli pattern with sidewalk chalk", "Ask a family member about a holiday your family celebrates with light"]),
      p("These festivals come from different places and beliefs, but they share a hopeful message: even on the darkest night, a little light can make a big difference."),
    ],
    words: [
      { word: "diyas", meaning: "small clay lamps filled with oil, lit during Diwali" },
      { word: "menorah", meaning: "a candleholder with branches, used in Jewish celebrations" },
      { word: "riddles", meaning: "puzzling questions that need clever thinking to answer" },
    ],
    questions: [
      { question: "What are the small clay lamps lit during Diwali called?", options: ["Krathongs", "Diyas", "Latkes", "Lanterns"], correct: "B" },
      { question: "How many candles does a special Hanukkah menorah hold?", options: ["Nine", "Five", "Seven", "Twelve"], correct: "A" },
      { question: "What do people do during Loy Krathong?", options: ["Fly kites shaped like dragons", "Light candles on a cake", "Float small decorated baskets with candles on the water", "Hang stockings by the fire"], correct: "C" },
      { question: "What is often written on lanterns during the Lantern Festival?", options: ["Shopping lists", "Riddles", "Birthday wishes", "Phone numbers"], correct: "B" },
      { question: "What message do all of these festivals share?", options: ["Winter is the best season", "Only one holiday matters", "Celebrations should be quiet", "Even a little light can make a big difference in the dark"], correct: "D" },
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
      fact("How much sleep do kids need?", "Sleep experts say children ages 6 to 12 need about 9 to 12 hours of sleep each night. Teenagers need about 8 to 10 hours. Many kids get less than that."),
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
      { question: "What is the author's main point?", options: ["Dreams can predict the future", "Kids should stay up as late as they want", "Naps are better than night sleep", "Sleep is important work for your brain and body"], correct: "D" },
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
      p("Matisse made some of his biggest works with scissors. He even designed the colorful stained-glass windows of a small chapel in Vence, France, using cut paper shapes as his plans. Many people say these late works are the happiest he ever made."),
      list("Make your own cut-out", ["Paint or color a few sheets of paper in bright colors and let them dry", "Cut out shapes without drawing them first. Try leaves, stars or waves", "Arrange them on a big sheet of paper, move them around, then glue them down"]),
      p("Matisse showed that a challenge does not have to be the end of something. Sometimes it is the start of something new."),
    ],
    words: [
      { word: "easel", meaning: "a stand that holds a painting while an artist works on it" },
      { word: "gouache", meaning: "a thick kind of watercolor paint with strong colors" },
      { word: "chapel", meaning: "a small church or room for prayer" },
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
      p("People have watched the Moon's phases for thousands of years. Many calendars, including the Islamic and Chinese calendars, are based on the Moon. The word \"month\" even comes from the word \"moon.\""),
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

export const newsBySlug = (slug: string) => NEWS_ARTICLES.find((a) => a.slug === slug) ?? null;
export const newsByTitle = (title: string | null | undefined) => (title ? NEWS_ARTICLES.find((a) => a.title === title) ?? null : null);

/** Plain words in a story (for read-time and level checks). */
export function newsWordCount(a: NewsArticle) {
  const text = a.body.map((b) => b.kind === "list" ? [b.title, ...b.items].join(" ") : b.kind === "fact" ? `${b.title} ${b.text}` : b.text).join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}
/** Minutes to read at a relaxed pace for young readers. */
export const newsReadMinutes = (a: NewsArticle) => Math.max(2, Math.round(newsWordCount(a) / 130));
