// 5-Minute Reads: short, kid-friendly pieces (sports, soccer, biographies,
// famous speeches and fun facts) that join the Arise News stories. Each one
// becomes a 5-point library quiz automatically (server/ariseNewsSync.ts), and
// gets a cover from shared/newsArt.ts (run `npx tsx script/buildNewsCovers.ts`).
//
// Same house rules as Arise News: facts only, neutral wording, short
// paragraphs, three words to know, five questions answerable from the text.
// Keep each piece under about 450 words so it really is a 5-minute read.
// Speeches: quote only public-domain words at length (U.S. government
// speeches such as Kennedy's or NASA's); otherwise keep quotes very short.
import type { NewsArticle, NewsBlock, NewsQuestion } from "./ariseNews";

const p = (text: string): NewsBlock => ({ kind: "p", text });
const h = (text: string): NewsBlock => ({ kind: "h", text });
const fact = (title: string, text: string): NewsBlock => ({ kind: "fact", title, text });
const quote = (text: string, by?: string): NewsBlock => ({ kind: "quote", text, by });
const list = (title: string, items: string[]): NewsBlock => ({ kind: "list", title, items });

const ON = "2026-10-20";

const WRITTEN: NewsArticle[] = [
  // ───────────── Sports ─────────────
  {
    slug: "basketball-peach-baskets",
    section: "Sports",
    title: "Basketball Started with Two Peach Baskets",
    dek: "A teacher needed an indoor game for a bored, rowdy class. He nailed two fruit baskets to a balcony, and a new sport was born.",
    grades: "Grades 3–6",
    publishedOn: ON,
    body: [
      p("In December 1891, a teacher named James Naismith had a problem. He worked at a training school in Springfield, Massachusetts. It was winter, too cold to play outside, and his class of young men was restless and bored."),
      p("His boss gave him two weeks to invent an indoor game that was fun, fair and not too rough. It also had to work in a small gym, with lots of players at once. Naismith thought about games from his own childhood and started writing rules."),
      h("Baskets, not hoops"),
      p("Naismith asked the school janitor for two boxes to use as goals. The janitor didn't have boxes, but he did have two peach baskets. Naismith nailed them to the balcony railing at each end of the gym, about 10 feet off the floor. Basketball hoops are still 10 feet high today."),
      p("There was one problem: the baskets still had bottoms. Every time someone scored, a person had to climb up and get the ball out. Years later, open nets took their place."),
      list("Some of the first rules", ["You could not run while holding the ball", "No shoving, holding or tripping", "The ball was a soccer ball", "Each team had nine players"]),
      fact("A very low score", "In the first game ever played, only one basket was made. The final score was 1 to 0."),
      h("A game for the world"),
      p("Students loved the new game and took it home with them. Within a few years it was played across the country. Dribbling was added, and backboards were put up partly to stop fans in the balcony from swatting the ball away."),
      p("Basketball became an Olympic sport in 1936, and Naismith was there to watch. Today hundreds of millions of people play it, all because one teacher needed a game for a cold winter day."),
    ],
    words: [
      { word: "restless", meaning: "not able to stay still or calm" },
      { word: "balcony", meaning: "a raised floor or platform that sticks out above a room" },
      { word: "dribbling", meaning: "bouncing the ball while moving with it" },
    ],
    questions: [
      { question: "Why did James Naismith invent basketball?", options: ["To win a contest", "His class needed a fun indoor game in winter", "He wanted to sell peaches", "The soccer field was closed for repairs"], correct: "B" },
      { question: "What did Naismith use as the first goals?", options: ["Two peach baskets", "Two wooden boxes", "Metal hoops", "Buckets of water"], correct: "A" },
      { question: "What was annoying about the first baskets?", options: ["They were too low", "They broke every game", "They still had bottoms, so someone had to get the ball out", "They were too small for the ball"], correct: "C" },
      { question: "What was the score of the very first basketball game?", options: ["50 to 48", "10 to 10", "21 to 19", "1 to 0"], correct: "D" },
      { question: "Which detail from the first game is still true today?", options: ["Each team has nine players", "Hoops are 10 feet high", "Games use a soccer ball", "Dribbling is not allowed"], correct: "B" },
    ],
  },
  {
    slug: "skateboarding-olympic-teens",
    section: "Sports",
    title: "The Teens Who Took Skateboarding to the Olympics",
    dek: "Skateboarding started as \"sidewalk surfing.\" When it finally reached the Olympics, some of the winners were only 13 years old.",
    grades: "Grades 3–7",
    publishedOn: ON,
    body: [
      p("In the 1950s, surfers in California had a problem: some days there were no waves. So they tried \"surfing\" on land. They attached wheels to wooden boards and rolled down sidewalks. People called it sidewalk surfing."),
      p("Those first boards were wobbly, and the metal or clay wheels were bumpy and slippery. In the 1970s, smooth plastic wheels made from urethane came along. Suddenly skaters could grip the ground, go faster and try daring tricks."),
      h("Empty pools and big air"),
      p("During a long dry spell in California in the 1970s, some backyard swimming pools sat empty. Skaters rode up and down their curved walls. That style grew into what is now called park skating, with bowls and ramps. Skaters learned to carve along the curves and fly above the edge."),
      p("Another style, street skating, uses things you find in a city, like stairs, rails and benches. Street skaters slide, flip and grind their way along them."),
      list("Two Olympic events", ["Street: skaters do tricks on rails, stairs and ledges", "Park: skaters ride a big bowl and launch into the air"]),
      h("Young champions"),
      p("Skateboarding was part of the Olympics for the first time at the Tokyo Games, which were held in 2021. The women's street event made history. Momiji Nishiya of Japan won gold, Rayssa Leal of Brazil won silver, and both girls were just 13."),
      p("In the women's park event, 13-year-old Sky Brown won bronze for Great Britain. She became her country's youngest Olympic medalist ever."),
      fact("Learning to fall", "Skaters say the first skill to learn is how to fall safely: bend your knees, stay low and roll. Helmets and pads help too."),
      p("What began as a way to pass time without waves is now an Olympic sport, and young skaters are some of its biggest stars."),
    ],
    words: [
      { word: "urethane", meaning: "a tough, smooth kind of plastic" },
      { word: "daring", meaning: "brave and willing to take risks" },
      { word: "medalist", meaning: "a person who wins a medal in a competition" },
    ],
    questions: [
      { question: "Why did surfers start skateboarding?", options: ["They wanted to go to school faster", "Some days there were no waves to surf", "Surfing was banned", "Their surfboards broke"], correct: "B" },
      { question: "What change in the 1970s helped skaters go faster and try tricks?", options: ["Metal wheels", "Wooden ramps", "Smooth urethane wheels", "Longer boards"], correct: "C" },
      { question: "Where did park skating get its start?", options: ["In empty swimming pools", "On frozen lakes", "In school gyms", "On city buses"], correct: "A" },
      { question: "How old were Momiji Nishiya and Rayssa Leal when they won Olympic medals?", options: ["10", "18", "16", "13"], correct: "D" },
      { question: "According to skaters, what is the first skill to learn?", options: ["How to jump high", "How to fall safely", "How to spin the board", "How to skate backward"], correct: "B" },
    ],
  },
  {
    slug: "why-curveballs-curve",
    section: "Sports",
    title: "How Does a Curveball Curve?",
    dek: "A spinning baseball can swerve on its way to the plate. The secret is air, spin and a scientist named Magnus.",
    grades: "Grades 4–7",
    publishedOn: ON,
    body: [
      p("A pitcher throws the ball. It looks like it's heading right down the middle. Then, at the last moment, it dips and swerves, and the batter swings at empty air. How can a ball change direction in the air?"),
      h("It's all about spin"),
      p("When a pitcher throws a curveball, they snap their wrist so the ball spins very fast, sometimes more than 2,000 times a minute. A spinning ball drags a thin layer of air around with it."),
      p("On one side of the ball, that spinning air moves along with the air rushing past. On the other side, it moves against it. This makes the air pressure uneven. Air pushes harder on one side than the other, so the ball gets nudged toward the side with less push."),
      fact("The Magnus effect", "This sideways push is called the Magnus effect, named after Heinrich Gustav Magnus, a German scientist who studied it in the 1850s."),
      p("The stitches on a baseball help too. The raised seams grab the air like tiny paddles, making the effect stronger."),
      h("Not just baseball"),
      list("Other places you can see the Magnus effect", ["A soccer free kick that bends around a wall of players", "A tennis ball hit with topspin that dives down fast", "A ping-pong serve that jumps sideways off the table", "A golf ball with backspin that seems to float"]),
      h("Try it yourself"),
      p("Tape two paper cups together at their bottoms. Wrap a rubber band around the middle, stretch it and let the cups roll off the band as you launch them. Watch them curve upward through the air. That's the Magnus effect at work."),
      p("Next time you see a pitch bend or a soccer ball swerve, you'll know the secret: spin plus air equals a curve."),
    ],
    words: [
      { word: "swerve", meaning: "to change direction suddenly" },
      { word: "air pressure", meaning: "how hard the air pushes on something" },
      { word: "seams", meaning: "the lines where pieces are stitched together" },
    ],
    questions: [
      { question: "What does a pitcher do to make a curveball spin?", options: ["Throws it very slowly", "Snaps their wrist", "Wets the ball", "Throws it underhand"], correct: "B" },
      { question: "Why does a spinning ball curve?", options: ["The air pushes harder on one side than the other", "The ball gets heavier", "Wind always blows it", "The batter's bat pulls it"], correct: "A" },
      { question: "Who is the Magnus effect named after?", options: ["A famous pitcher", "A soccer coach", "A German scientist", "A baseball company"], correct: "C" },
      { question: "How do the stitches on a baseball help the curve?", options: ["They make the ball lighter", "They help the pitcher hold it", "They slow the ball down", "They grab the air and make the effect stronger"], correct: "D" },
      { question: "Which is another example of the Magnus effect?", options: ["A rock sinking in water", "A soccer free kick bending around a wall", "A balloon floating up", "A ball rolling downhill"], correct: "B" },
    ],
  },

  // ───────────── Soccer ─────────────
  {
    slug: "pele-king-of-soccer",
    section: "Soccer",
    title: "Pelé: The Boy Who Practiced with a Sock",
    dek: "He was too poor to buy a soccer ball, so he made his own. He grew up to win three World Cups.",
    grades: "Grades 3–7",
    publishedOn: ON,
    body: [
      p("Edson Arantes do Nascimento was born in Brazil in 1940. The world would come to know him by a nickname: Pelé."),
      p("His family didn't have much money. Pelé helped out by shining shoes, and he couldn't afford a real soccer ball. So he stuffed a sock with newspaper, tied it with string and kicked it around the streets. Sometimes he used a grapefruit. He played barefoot with his friends for hours, learning to control the ball on bumpy dirt roads."),
      h("A teen star"),
      p("Pelé joined a pro team called Santos when he was just 15. A year later, he was playing for Brazil's national team."),
      p("At 17, he went to the 1958 World Cup in Sweden. He scored six goals, including two in the final, and Brazil won. He cried with joy on the field. He was the youngest player ever to score in a World Cup final, a record that still stands."),
      list("Pelé's World Cup wins", ["1958 in Sweden", "1962 in Chile", "1970 in Mexico"]),
      fact("Three-time champion", "Pelé is the only player in history to win the World Cup three times."),
      h("More than goals"),
      p("Pelé scored more than 1,000 goals in his career. He could shoot with both feet, head the ball hard and dribble past defenders as if they weren't there. Fans called him \"O Rei,\" which means \"The King\" in Portuguese."),
      p("In 1975 he moved to the United States to play for the New York Cosmos. Huge crowds came to watch him, and many Americans fell in love with soccer for the first time."),
      p("Pelé died in 2022 at age 82. He is remembered not just for his goals but for his smile and his joy in the game. It all started with a sock full of newspaper and a kid who wouldn't stop practicing."),
    ],
    words: [
      { word: "national team", meaning: "the team that plays for a whole country" },
      { word: "defenders", meaning: "players whose job is to stop the other team from scoring" },
      { word: "Portuguese", meaning: "the main language spoken in Brazil" },
    ],
    questions: [
      { question: "What did young Pelé use when he couldn't afford a soccer ball?", options: ["A basketball", "A sock stuffed with newspaper", "A rock", "A balloon"], correct: "B" },
      { question: "How old was Pelé when he played in his first World Cup?", options: ["17", "15", "21", "25"], correct: "A" },
      { question: "What record does Pelé hold?", options: ["Tallest soccer player ever", "Most red cards", "The only player to win the World Cup three times", "Longest kick in history"], correct: "C" },
      { question: "What does \"O Rei\" mean?", options: ["The Rocket", "The Kid", "The Kicker", "The King"], correct: "D" },
      { question: "What happened when Pelé played for the New York Cosmos?", options: ["Nobody came to the games", "Many Americans got excited about soccer", "He stopped scoring goals", "He switched to basketball"], correct: "B" },
    ],
  },
  {
    slug: "offside-rule-explained",
    section: "Soccer",
    title: "Offside, Explained in Two Minutes",
    dek: "It's the rule that confuses everyone. Here's what offside really means, and why soccer needs it.",
    grades: "Grades 3–7",
    publishedOn: ON,
    body: [
      p("A striker races toward the goal, scores, and the crowd goes wild. Then the referee's assistant raises a flag. No goal. Offside! What just happened?"),
      h("Why the rule exists"),
      p("Imagine if a player could just stand next to the other team's goal all game, waiting for a long pass. That player is sometimes called a \"goal hanger.\" The game would turn into teams booting the ball as far as they could. The offside rule stops that and keeps players moving together."),
      h("The rule, step by step"),
      p("A player is in an offside position if, at the moment a teammate passes the ball to them, they are closer to the other team's goal line than both the ball and the second-to-last defender. Usually the goalkeeper is the last defender, so this often means the last field player."),
      list("You are NOT offside if…", ["You are in your own half of the field", "You are level with the second-to-last defender", "You are behind the ball when it is passed", "You receive the ball straight from a throw-in, goal kick or corner kick"]),
      fact("Timing is everything", "What matters is where you are when the ball is passed, not when you catch it. A player can sprint past defenders after the pass and still be onside."),
      h("Being offside isn't always a foul"),
      p("Just standing in an offside position is fine. It only becomes a foul if you get involved in the play, like receiving the ball or blocking the goalkeeper's view. Then the other team gets a free kick."),
      p("Today, top leagues use video replays and computer lines to check close calls. Next time you watch a match, keep an eye on the attacking players and the last defenders. You'll be calling offside like a pro."),
    ],
    words: [
      { word: "striker", meaning: "a player whose main job is scoring goals" },
      { word: "referee's assistant", meaning: "an official on the sideline who helps the referee, often with a flag" },
      { word: "free kick", meaning: "a kick given to a team after the other team breaks a rule" },
    ],
    questions: [
      { question: "Why does soccer have an offside rule?", options: ["To stop players from waiting by the other team's goal", "To make games shorter", "To give goalkeepers a rest", "To stop players from running"], correct: "A" },
      { question: "When is a player's position checked for offside?", options: ["When they catch the ball", "At halftime", "When the ball is passed to them", "When they shoot"], correct: "C" },
      { question: "Which player is NOT offside?", options: ["A player behind the last two defenders when the pass is made", "A player who is level with the second-to-last defender", "A goal hanger", "A player far past all defenders when the pass is made"], correct: "B" },
      { question: "Can a player be offside straight from a corner kick?", options: ["Yes, always", "Only in the second half", "Only if they are tall", "No"], correct: "D" },
      { question: "What happens when a player commits an offside foul?", options: ["They get a red card", "The other team gets a free kick", "The game ends", "Their team gets a penalty kick"], correct: "B" },
    ],
  },
  {
    slug: "first-world-cup-1930",
    section: "Soccer",
    title: "The First World Cup: 13 Teams and a Long Boat Ride",
    dek: "Long before 48 teams and giant stadiums, the very first World Cup was a small tournament in Uruguay.",
    grades: "Grades 3–7",
    publishedOn: ON,
    body: [
      p("Today the World Cup is the most-watched sports event on Earth. But the first one, in 1930, was tiny by comparison."),
      h("Why Uruguay?"),
      p("Uruguay, a small country in South America, was chosen to host. Its team had won the Olympic soccer gold medal in 1924 and 1928, and 1930 was the 100th birthday of its first constitution. Uruguay even promised to build a brand-new stadium and pay for visiting teams' travel."),
      h("A long trip"),
      p("There were no passenger jets back then. Teams from Europe had to cross the Atlantic Ocean by ship, a trip that took about two weeks. Many European teams decided not to go. In the end, only four made the journey: France, Belgium, Romania and Yugoslavia."),
      p("Players trained on the ship's deck as it sailed. Imagine running drills while the floor rocks under your feet! The trip also carried the referees and the trophy itself."),
      fact("Just 13 teams", "Only 13 teams played in the first World Cup. The 2026 World Cup had 48."),
      h("Firsts"),
      list("World Cup firsts", ["First goal: Lucien Laurent of France, in a 4–1 win over Mexico", "First champion: Uruguay", "First trophy: a gold cup later named after Jules Rimet, the leader who dreamed up the tournament"]),
      p("The new stadium in Montevideo, Uruguay's capital, was called the Estadio Centenario, or Centenary Stadium. It wasn't quite finished when the tournament began, so the first games were played elsewhere."),
      h("The final"),
      p("The final was Uruguay against its neighbor Argentina. Argentina led 2–1 at halftime, but Uruguay came back to win 4–2. The next day was declared a national holiday in Uruguay, and fans celebrated in the streets of Montevideo."),
      p("From 13 teams and a boat ride, the World Cup grew into a party the whole planet joins every four years."),
    ],
    words: [
      { word: "host", meaning: "to hold an event and welcome visitors" },
      { word: "constitution", meaning: "the set of basic laws for a country" },
      { word: "centenary", meaning: "a 100th anniversary" },
    ],
    questions: [
      { question: "Where was the first World Cup held?", options: ["Brazil", "France", "Uruguay", "Argentina"], correct: "C" },
      { question: "How did European teams travel to the tournament?", options: ["By airplane", "By ship", "By train", "By car"], correct: "B" },
      { question: "How many teams played in the first World Cup?", options: ["13", "48", "32", "4"], correct: "A" },
      { question: "Who scored the first World Cup goal ever?", options: ["A player from Uruguay", "Jules Rimet", "A player from Argentina", "Lucien Laurent of France"], correct: "D" },
      { question: "What was the score of the first World Cup final?", options: ["Argentina 2, Uruguay 1", "Uruguay 4, Argentina 2", "Uruguay 1, Argentina 0", "France 4, Mexico 1"], correct: "B" },
    ],
  },

  // ───────────── Biographies ─────────────
  {
    slug: "jackie-robinson-42",
    section: "Biography",
    title: "Jackie Robinson and the Number 42",
    dek: "In 1947 he became the first Black player in modern Major League Baseball. Today every player wears his number one day a year.",
    grades: "Grades 3–7",
    publishedOn: ON,
    body: [
      p("For decades, Major League Baseball had an unfair, unwritten rule: Black players were not allowed. Many great Black athletes played in separate leagues called the Negro Leagues instead. Robinson himself played one season there, for the Kansas City Monarchs."),
      p("On April 15, 1947, that changed. Jackie Robinson ran onto the field for the Brooklyn Dodgers, wearing number 42."),
      h("A star from the start"),
      p("Jackie Robinson was born in Georgia in 1919 and grew up in Pasadena, California. At college in Los Angeles, he starred in four sports: baseball, basketball, football and track."),
      p("Branch Rickey, who ran the Dodgers, chose Robinson because of his talent and his strength of character. Rickey knew Robinson would face cruel treatment from some fans and players, and he asked Robinson to stay calm and let his playing do the talking."),
      h("Courage on the field"),
      p("Robinson faced insults and threats. Some players tried to hurt him with their spikes. He stayed focused, kept his promise to stay calm, and played brilliantly. He was fast and fearless on the bases and even stole home plate 19 times in his career."),
      list("Jackie Robinson's honors", ["1947: first Rookie of the Year award", "1949: Most Valuable Player of the National League", "1955: World Series champion with the Dodgers", "1962: elected to the Baseball Hall of Fame"]),
      fact("Everyone is 42", "In 1997, baseball retired number 42 for every team, so no new player can wear it. But on April 15 each year, Jackie Robinson Day, every player in the major leagues wears 42."),
      p("Robinson opened the door for many players who came after him. He also spoke up for fairness and equal rights all his life. He once said that a life is not important except for the effect it has on other lives."),
    ],
    words: [
      { word: "unwritten rule", meaning: "a rule people follow even though it isn't written down" },
      { word: "character", meaning: "the kind of person someone is inside, like honest or brave" },
      { word: "retired", meaning: "for a jersey number, no longer given to new players" },
    ],
    questions: [
      { question: "What did Jackie Robinson do on April 15, 1947?", options: ["Became the first Black player in modern Major League Baseball", "Won the World Series", "Started a new league", "Retired from baseball"], correct: "A" },
      { question: "How many sports did Robinson star in at college?", options: ["One", "Two", "Four", "Six"], correct: "C" },
      { question: "What did Branch Rickey ask Robinson to do?", options: ["Fight back against cruel players", "Stay calm and let his playing do the talking", "Play only at home games", "Change his number"], correct: "B" },
      { question: "What happens every year on Jackie Robinson Day?", options: ["No games are played", "Fans get free tickets", "Every team picks a new number", "Every major league player wears number 42"], correct: "D" },
      { question: "Which word best describes Jackie Robinson in this article?", options: ["Lazy", "Courageous", "Careless", "Shy"], correct: "B" },
    ],
  },
  {
    slug: "katherine-johnson-numbers",
    section: "Biography",
    title: "Katherine Johnson: The Math Behind the Moon",
    dek: "Before astronauts trusted computers, they trusted her. Katherine Johnson's math helped send Americans into space.",
    grades: "Grades 4–8",
    publishedOn: ON,
    body: [
      p("Katherine Johnson loved to count. As a little girl in West Virginia in the 1920s, she counted everything: steps, dishes, even the stars."),
      p("She was so quick at math that she was ready for high school at age 10. But her town's schools did not allow Black students past eighth grade, so her family moved more than 100 miles so she could keep learning. She finished college at 18 with degrees in math and French."),
      h("A human computer"),
      p("In 1953, Johnson went to work for the agency that later became NASA. Back then, the word \"computer\" often meant a person who did hard math by hand. Johnson was one of a group of Black women mathematicians who did this work."),
      p("She was curious and kept asking questions, so she was invited into meetings where the big decisions were made."),
      h("Paths through space"),
      p("Johnson calculated trajectories, the exact paths spacecraft would take. In 1961, her math helped plan Alan Shepard's flight, the first American trip to space."),
      fact("\"Check the numbers\"", "In 1962, John Glenn was about to become the first American to orbit Earth. NASA had started using electronic computers, but Glenn wanted to be sure. He asked for Katherine Johnson to check the computer's math by hand. She did, the numbers matched, and he flew."),
      p("Later, her work helped the Apollo 11 mission land on the Moon in 1969."),
      h("Honored at last"),
      p("For many years, few people knew her name. That changed. In 2015, she received the Presidential Medal of Freedom, one of the highest honors in the United States. The 2016 book and movie Hidden Figures told her story. She died in 2020 at age 101."),
      p("Her advice for young people? Like what you do, and do your best, and keep asking questions."),
    ],
    words: [
      { word: "calculated", meaning: "worked out using math" },
      { word: "trajectories", meaning: "the paths things follow as they move through the air or space" },
      { word: "orbit", meaning: "to travel in a curved path around a planet or star" },
    ],
    questions: [
      { question: "Why did Katherine Johnson's family move when she was young?", options: ["So she could keep going to school", "To be near NASA", "Because her father got a new job in space", "To live on a farm"], correct: "A" },
      { question: "What did the word \"computer\" often mean when Johnson started at NASA?", options: ["A small calculator", "A person who did hard math by hand", "A typewriter", "A kind of rocket"], correct: "B" },
      { question: "What is a trajectory?", options: ["A space suit", "A rocket engine", "The path something follows through space", "A type of computer"], correct: "C" },
      { question: "What did John Glenn ask for before his flight?", options: ["A bigger rocket", "A different astronaut", "More food", "For Johnson to check the computer's math"], correct: "D" },
      { question: "What movie told Katherine Johnson's story?", options: ["Apollo 13", "Hidden Figures", "The Right Stuff", "First Man"], correct: "B" },
    ],
  },
  {
    slug: "wright-brothers-first-flight",
    section: "Biography",
    title: "The Wright Brothers: 12 Seconds That Changed the World",
    dek: "Two brothers who fixed bicycles taught themselves to build the first airplane that really flew.",
    grades: "Grades 3–6",
    publishedOn: ON,
    body: [
      p("When Wilbur and Orville Wright were boys, their father brought home a toy helicopter. It was made of cork, bamboo and paper, with a rubber band to spin its blades. The brothers played with it until it broke, then built their own. They never forgot how it felt to watch something fly."),
      h("From bikes to wings"),
      p("As young men, the brothers ran a bicycle shop in Dayton, Ohio. Working with bikes taught them about balance, lightweight parts and fixing things that broke."),
      p("They watched birds closely and noticed that birds twist the tips of their wings to turn and stay steady. The brothers copied the idea with a system they called wing warping."),
      p("They also built their own wind tunnel, a box with a fan that blew air over tiny test wings. They tested about 200 wing shapes to find the best ones."),
      h("Kitty Hawk"),
      p("The Wrights needed steady wind, soft sand and privacy. They found all three near Kitty Hawk, North Carolina."),
      p("On December 17, 1903, Orville lay on the lower wing of their machine, the Wright Flyer. The engine roared, and the plane lifted off. It flew for 12 seconds and traveled 120 feet. That is shorter than the wingspan of some jets today, but it was the first time a powered airplane carried a person in a controlled flight."),
      list("That day's four flights", ["Flight 1: Orville, 12 seconds", "Flights 2 and 3: the brothers took turns and went a little farther", "Flight 4: Wilbur, 59 seconds and 852 feet"]),
      fact("A coin toss", "The brothers flipped a coin to decide who would try first. Wilbur won, but his try a few days earlier ended in a stall. So Orville got the first real flight."),
      p("Just 66 years later, people walked on the Moon."),
    ],
    words: [
      { word: "wind tunnel", meaning: "a tube or box where air is blown over objects to test them" },
      { word: "wingspan", meaning: "the distance from the tip of one wing to the other" },
      { word: "stall", meaning: "when an aircraft loses the lift it needs to keep flying" },
    ],
    questions: [
      { question: "What toy got the Wright brothers interested in flying?", options: ["A kite", "A paper airplane", "A toy helicopter", "A balloon"], correct: "C" },
      { question: "What business did the brothers run?", options: ["A bicycle shop", "A toy store", "A farm", "A newspaper"], correct: "A" },
      { question: "Where did they get the idea for wing warping?", options: ["From a book", "From watching birds", "From their teacher", "From a dream"], correct: "B" },
      { question: "How long was the very first flight?", options: ["59 seconds", "One hour", "5 minutes", "12 seconds"], correct: "D" },
      { question: "Why did they choose Kitty Hawk?", options: ["It had steady wind, soft sand and privacy", "Their family lived there", "It had the tallest hill in America", "It never rained there"], correct: "A" },
    ],
  },

  // ───────────── Famous Speeches ─────────────
  {
    slug: "we-choose-the-moon",
    section: "Speeches",
    title: "\"We Choose to Go to the Moon\"",
    dek: "In 1962, President John F. Kennedy gave a speech that dared a whole country to do something hard.",
    grades: "Grades 4–8",
    publishedOn: ON,
    body: [
      p("On September 12, 1962, about 40,000 people sat in a hot football stadium at Rice University in Houston, Texas. President John F. Kennedy stepped up to speak about space."),
      p("At that time, no American had ever orbited the Moon, let alone landed on it. Rockets often blew up on the launch pad. Kennedy wanted to convince people that a Moon landing was worth the work."),
      h("The famous words"),
      quote("We choose to go to the Moon in this decade and do the other things, not because they are easy, but because they are hard.", "President John F. Kennedy, 1962"),
      p("These lines are the most famous part of the speech. Kennedy was saying that hard goals are worth choosing because they push people to do their very best."),
      h("Making it real"),
      p("Kennedy also helped the crowd picture how hard the trip would be. He described a giant rocket, taller than a football field is long, made of new metals that hadn't been invented yet. It would have to survive heat about half as hot as the Sun's surface and come home safely."),
      p("He even made a joke. Rice University's football team played the University of Texas, a much stronger team. Kennedy asked why Rice would play Texas, as if to say: we do hard things on purpose."),
      fact("Did it work?", "Yes. On July 20, 1969, less than seven years later, astronauts Neil Armstrong and Buzz Aldrin walked on the Moon. Kennedy did not live to see it, but his goal came true within the decade, just as he had said."),
      h("Why it's still famous"),
      p("Coaches, teachers and scientists still repeat Kennedy's words. When something feels too hard, the speech reminds people that the hard part can be the reason to try."),
      p("What hard thing would you choose?"),
    ],
    words: [
      { word: "decade", meaning: "a period of ten years" },
      { word: "convince", meaning: "to get someone to believe or agree with you" },
      { word: "launch pad", meaning: "the place where a rocket takes off" },
    ],
    questions: [
      { question: "Where did Kennedy give this speech?", options: ["At NASA in Florida", "At the White House", "At Rice University in Houston", "On the Moon"], correct: "C" },
      { question: "According to Kennedy, why should we choose to go to the Moon?", options: ["Because it is easy", "Because it is hard", "Because it is cheap", "Because other countries asked us to"], correct: "B" },
      { question: "Why did Kennedy mention Rice playing Texas in football?", options: ["To show that people choose hard challenges on purpose", "To sell tickets", "Because he was a coach", "To change the subject"], correct: "A" },
      { question: "When did astronauts first walk on the Moon?", options: ["1962", "1975", "1959", "1969"], correct: "D" },
      { question: "What is the main idea of this speech?", options: ["Football is better than space", "Rockets are dangerous", "Hard goals are worth choosing", "The Moon is too far away"], correct: "C" },
    ],
  },
  {
    slug: "lou-gehrig-luckiest-man",
    section: "Speeches",
    title: "Lou Gehrig: \"The Luckiest Man\"",
    dek: "He had just learned he was very sick. Then he stood in front of 62,000 fans and told them he felt lucky.",
    grades: "Grades 4–8",
    publishedOn: ON,
    body: [
      p("Lou Gehrig played first base for the New York Yankees. He was so strong and dependable that people called him \"The Iron Horse.\" From 1925 to 1939, he played in 2,130 games in a row without missing one."),
      h("Something was wrong"),
      p("In 1938 and 1939, Gehrig started feeling weak. He fumbled easy plays and struggled at bat. In May 1939, he took himself out of the lineup, ending his famous streak."),
      p("Doctors found that he had a rare disease called amyotrophic lateral sclerosis, or ALS. It slowly weakens the muscles, and there was no cure. He got the news on his 36th birthday."),
      h("A day at Yankee Stadium"),
      p("On July 4, 1939, the Yankees held a special day to honor him. More than 60,000 fans filled the stadium. Teammates, old and new, stood on the field. Gehrig did not want to speak at first, but the crowd chanted for him."),
      quote("Today I consider myself the luckiest man on the face of the earth.", "Lou Gehrig, 1939"),
      p("In a short speech of only a few minutes, Gehrig didn't complain. Instead, he thanked people: his teammates, his coaches, the fans, and his parents and wife. He talked about how lucky he was to have known and played with them. He ended by saying he had a lot to live for."),
      fact("A short speech, a long memory", "No one recorded the full speech on film, and only pieces survive. But people still call it baseball's Gettysburg Address."),
      h("His legacy"),
      p("Gehrig died in 1941, at age 37. ALS is still sometimes called Lou Gehrig's disease. His record of 2,130 straight games lasted until Cal Ripken Jr. broke it in 1995."),
      p("His speech is remembered because of what it teaches: even on the hardest day, you can choose to be grateful."),
    ],
    words: [
      { word: "dependable", meaning: "someone you can count on" },
      { word: "streak", meaning: "a run of wins or events in a row without a break" },
      { word: "grateful", meaning: "feeling thankful" },
    ],
    questions: [
      { question: "Why was Lou Gehrig called \"The Iron Horse\"?", options: ["He rode horses", "He was strong and never missed games", "He wore iron armor", "He was very slow"], correct: "B" },
      { question: "What disease did Gehrig have?", options: ["ALS", "The flu", "Chicken pox", "Asthma"], correct: "A" },
      { question: "How did Gehrig describe himself in his speech?", options: ["The unluckiest man", "The strongest player ever", "The luckiest man on the face of the earth", "A forgotten hero"], correct: "C" },
      { question: "What did Gehrig mostly do in his speech?", options: ["Complain about being sick", "Talk about his records", "Ask for money", "Thank the people in his life"], correct: "D" },
      { question: "What lesson does the article say the speech teaches?", options: ["Never play baseball", "You can choose to be grateful even on hard days", "Records are the most important thing", "Speeches should be long"], correct: "B" },
    ],
  },
  {
    slug: "one-small-step",
    section: "Speeches",
    title: "\"One Small Step\": The Most Famous Words from Space",
    dek: "Neil Armstrong's first words on the Moon were only 11 words long. Here's the story behind them, including a tiny missing word.",
    grades: "Grades 3–7",
    publishedOn: ON,
    body: [
      p("On July 20, 1969, the lunar module Eagle landed on the Moon with astronauts Neil Armstrong and Buzz Aldrin inside. Hours later, Armstrong opened the hatch and climbed slowly down a ladder. He wore a bulky white spacesuit and a backpack that kept him alive, with air to breathe and cool water flowing around his body."),
      p("Back on Earth, an estimated 600 million people were watching on fuzzy black-and-white TVs. As Armstrong's boot touched the dusty ground, he spoke."),
      quote("That's one small step for man, one giant leap for mankind.", "Neil Armstrong, July 20, 1969"),
      h("What it means"),
      p("Armstrong's idea was simple: stepping off a ladder is a tiny movement for one person. But this step was a huge moment for all of humanity, the first time anyone had ever walked on another world."),
      h("The missing \"a\""),
      p("Here's a puzzle. Read the sentence again. \"Man\" and \"mankind\" mean almost the same thing, so the sentence sounds a little odd. Armstrong later said he meant to say \"one small step for a man.\" Did he say \"a\" and the radio static swallowed it? Or did he skip it in the excitement?"),
      p("People have studied the recording for years. Some say they can hear a tiny gap where the \"a\" might be. Armstrong himself said he hoped history would give him the \"a.\" Nobody knows for sure."),
      fact("Who wrote it?", "Armstrong said he thought of the words himself, after landing and before stepping outside."),
      h("Short and strong"),
      p("Great speeches don't have to be long. Armstrong used just 11 words, but people around the world still know them by heart. Footprints left on the Moon that day are probably still there, because there's no wind or rain to wipe them away. Aldrin followed Armstrong outside about 20 minutes later."),
    ],
    words: [
      { word: "lunar module", meaning: "the small spacecraft that landed on the Moon" },
      { word: "humanity", meaning: "all people everywhere" },
      { word: "static", meaning: "crackling noise that can cover up sounds on a radio" },
    ],
    questions: [
      { question: "When did Neil Armstrong first step onto the Moon?", options: ["July 20, 1969", "September 12, 1962", "December 17, 1903", "July 4, 1939"], correct: "A" },
      { question: "About how many people watched on TV?", options: ["6 thousand", "600 million", "60 people", "6 billion"], correct: "B" },
      { question: "What did Armstrong mean by \"one giant leap for mankind\"?", options: ["He jumped very high", "Astronauts can leap far on the Moon", "It was a huge moment for all people", "He was the tallest astronaut"], correct: "C" },
      { question: "What is the puzzle about Armstrong's words?", options: ["Whether he spoke at all", "Who wrote them", "Whether he said them in English", "Whether he said the word \"a\""], correct: "D" },
      { question: "Why are the footprints probably still on the Moon?", options: ["Astronauts guard them", "There is no wind or rain to wipe them away", "They were made of metal", "They are covered with glass"], correct: "B" },
    ],
  },
  {
    slug: "malala-one-pen",
    section: "Speeches",
    title: "Malala's Birthday Speech to the World",
    dek: "On her 16th birthday, a girl from Pakistan spoke at the United Nations about one big idea: every child deserves to go to school.",
    grades: "Grades 4–8",
    publishedOn: ON,
    body: [
      p("Malala Yousafzai grew up in the Swat Valley in Pakistan. Her father ran a school, and Malala loved learning. When she was about 11, a group that had taken control of her area began closing girls' schools."),
      p("Malala refused to stay quiet. She wrote a diary online about what it was like, and she spoke to reporters about girls' right to learn. She used a made-up name to stay safe, but over time people learned who she was."),
      p("In 2012, when she was 15, she was attacked on her school bus because she spoke up. She was badly hurt, but doctors in Pakistan and England saved her life."),
      h("A speech on her birthday"),
      p("On July 12, 2013, Malala turned 16. That day, she spoke at the United Nations in New York to young people from around the world. The UN called it Malala Day."),
      p("She told the audience that she was not speaking only for herself, but for every child who could not go to school. She said that the attack had not changed her goals. If anything, it made her braver."),
      quote("One child, one teacher, one book and one pen can change the world.", "Malala Yousafzai, 2013"),
      h("The power of education"),
      p("Malala said that books and pens are powerful tools. She asked world leaders to make sure every child could get a free education, and she asked young people to speak up too."),
      fact("Youngest winner", "In 2014, at 17, Malala became the youngest person ever to win the Nobel Peace Prize."),
      p("Today, Malala runs a group that helps girls around the world go to school. She also finished her own studies at the University of Oxford in England. Her birthday speech is a reminder that a young person's voice can be heard all over the world."),
    ],
    words: [
      { word: "United Nations", meaning: "a group where almost every country in the world meets to work together" },
      { word: "education", meaning: "learning, especially at school" },
      { word: "audience", meaning: "the people listening to a speech or watching a show" },
    ],
    questions: [
      { question: "What did Malala speak up for?", options: ["Longer summer break", "Girls' right to go to school", "More sports teams", "New playgrounds"], correct: "B" },
      { question: "Where did Malala give her 2013 speech?", options: ["At the United Nations in New York", "At her school", "On TV in Pakistan", "At a soccer stadium"], correct: "A" },
      { question: "What made the date of the speech special?", options: ["It was New Year's Day", "It was a school holiday", "It was her 16th birthday", "It was the day she graduated"], correct: "C" },
      { question: "According to Malala, what four things can change the world?", options: ["Money, power, cars and phones", "Food, water, homes and doctors", "Games, music, art and dance", "A child, a teacher, a book and a pen"], correct: "D" },
      { question: "What record does Malala hold?", options: ["Youngest person to win the Nobel Peace Prize", "Fastest runner in Pakistan", "Most books read in a year", "Youngest teacher ever"], correct: "A" },
    ],
  },

  // ───────────── Fun Facts ─────────────
  {
    slug: "how-roller-coasters-work",
    section: "Fun Facts",
    title: "Roller Coasters Have No Engine (Really!)",
    dek: "After that first big hill, a roller coaster runs on gravity alone. Here's the science of screaming.",
    grades: "Grades 3–7",
    publishedOn: ON,
    body: [
      p("Click, click, click. The coaster creeps up the first hill. Your stomach flutters. At the top you pause for a heartbeat, and then WHOOSH!"),
      p("Here's the surprising part: most roller coaster trains have no engine at all. Once they leave that first hill, gravity does all the work."),
      h("Storing energy"),
      p("That clicking sound is a chain or cable pulling the train up the lift hill. As the train goes higher, it stores up energy, like a stretched rubber band. Scientists call this stored energy potential energy."),
      p("When the train tips over the top, gravity pulls it down. The stored energy turns into energy of motion, called kinetic energy. The train goes faster and faster."),
      p("At the bottom, that speed carries the train up the next hill, turning motion back into stored energy. Back and forth, the energy swaps all through the ride."),
      fact("Why each hill is smaller", "Every time the wheels rub the track and the train pushes through the air, a little energy is lost as heat and sound. So each hill must be a bit lower than the one before, or the train won't make it over."),
      h("Loops aren't circles"),
      p("Look closely at a loop and you'll see it's not a perfect circle. It's shaped more like an upside-down teardrop, tighter at the top. A perfect circle would squash riders with too much force at the bottom. The teardrop shape makes the ride smoother."),
      h("Why you don't fall out"),
      list("What keeps you safe", ["Wheels grip the track from above, below and the side", "Speed presses you into your seat, even upside down", "Lap bars and harnesses hold you snugly", "Brakes near the end slow the train down"]),
      p("So next time you scream down a drop, remember: you're riding on gravity and some very clever science."),
    ],
    words: [
      { word: "gravity", meaning: "the force that pulls things toward the ground" },
      { word: "potential energy", meaning: "stored energy, such as from being high up" },
      { word: "kinetic energy", meaning: "the energy something has because it is moving" },
    ],
    questions: [
      { question: "What moves most roller coaster trains after the first hill?", options: ["A big engine", "Gravity", "Wind", "Electric magnets"], correct: "B" },
      { question: "What makes the clicking sound on the first hill?", options: ["Loose bolts", "Riders clapping", "A chain or cable pulling the train up", "Brakes"], correct: "C" },
      { question: "What is kinetic energy?", options: ["The energy something has because it is moving", "Energy from the Sun", "Stored energy from being high up", "Energy in food"], correct: "A" },
      { question: "Why is each hill a little lower than the one before?", options: ["To save money", "So riders aren't scared", "Because the train gets heavier", "Some energy is lost as heat and sound"], correct: "D" },
      { question: "What shape are most roller coaster loops?", options: ["Perfect circles", "Upside-down teardrops", "Squares", "Triangles"], correct: "B" },
    ],
  },
  {
    slug: "why-cats-purr",
    section: "Fun Facts",
    title: "The Mystery of the Purr",
    dek: "Cats purr when they're happy. But they also purr when they're scared or hurt. Scientists are still figuring out why.",
    grades: "Grades 3–6",
    publishedOn: ON,
    body: [
      p("Pet a happy cat, and you might hear a soft, rumbling motor: purrrrr. It's one of the coziest sounds in the world. But how do cats make it, and what does it mean? Surprisingly, scientists still argue about some of the answers."),
      h("How a purr is made"),
      p("A purr starts in a cat's voice box, called the larynx. Tiny muscles there twitch open and closed very quickly, around 25 to 150 times every second. Each twitch makes the air buzz as the cat breathes in and out."),
      p("That's why a cat can purr nonstop, even while breathing. Most other sounds, like meows, only happen when a cat breathes out."),
      h("Not just for happy times"),
      p("Cats purr when they're relaxed and being petted. Mother cats purr to their kittens, and kittens purr back while drinking milk. Kittens can purr when they are only a few days old. Purring helps tiny, blind newborn kittens find their mom."),
      p("But cats also purr when they're nervous, at the vet, or even hurt. So a purr may sometimes mean \"I need comfort,\" not just \"I'm happy.\" To know what a purr means, look at the whole cat: its ears, eyes and tail."),
      fact("A healing hum?", "Some scientists wonder if purring helps cats heal. Low, steady vibrations can help bones and muscles stay strong. This idea hasn't been proven yet, but it's a fun question researchers are still exploring."),
      h("Big cats, too?"),
      list("Who can purr?", ["House cats: yes", "Cheetahs, bobcats and cougars: yes", "Lions and tigers: they can roar, but they can't purr the way house cats do", "Some other animals, like raccoons and guinea pigs, make purr-like sounds"]),
      p("So the next time a cat curls up in your lap and starts to rumble, you're hearing one of nature's little mysteries in action."),
    ],
    words: [
      { word: "larynx", meaning: "the voice box in the throat" },
      { word: "vibrations", meaning: "fast, tiny back-and-forth movements" },
      { word: "researchers", meaning: "people who study something carefully to learn new facts" },
    ],
    questions: [
      { question: "Where does a cat's purr start?", options: ["In its stomach", "In its tail", "In its larynx, or voice box", "In its nose"], correct: "C" },
      { question: "How is purring different from meowing?", options: ["A cat can purr while breathing in and out", "Purring is louder", "Only kittens purr", "Meows are made in the stomach"], correct: "A" },
      { question: "How does purring help newborn kittens?", options: ["It keeps them warm", "It helps them find their mom", "It teaches them to hunt", "It helps them see"], correct: "B" },
      { question: "Which statement is true?", options: ["Cats only purr when happy", "Lions purr louder than house cats", "Purring has been proven to heal bones", "Cats sometimes purr when they are scared or hurt"], correct: "D" },
      { question: "Why does the article call purring a mystery?", options: ["Nobody has ever heard a purr", "Scientists still aren't sure of all its reasons", "Cats purr only at night", "Purring is a magic trick"], correct: "B" },
    ],
  },
  {
    slug: "hiccup-science",
    section: "Fun Facts",
    title: "Hic! What Are Hiccups, Anyway?",
    dek: "One man had hiccups for 68 years. Here's what's happening inside you when they start, and why nobody's sure they're useful.",
    grades: "Grades 3–6",
    publishedOn: ON,
    body: [
      p("You're eating lunch, laughing with friends, and suddenly: HIC! Then again. And again. Everybody gets hiccups, from babies to grown-ups, and even some animals like cats and dogs. But what are they?"),
      h("The muscle under your lungs"),
      p("Below your lungs is a dome-shaped muscle called the diaphragm. Each time you breathe in, it tightens and pulls down, so air rushes into your lungs. Usually it moves smoothly."),
      p("Sometimes, though, the diaphragm twitches suddenly, like a little jump. You gulp air in fast. A split second later, the flap at the top of your windpipe snaps shut. Air smacks into it and makes the \"hic\" sound."),
      list("Things that can start hiccups", ["Eating or drinking too fast", "Fizzy drinks", "Laughing hard", "Being excited or nervous", "A sudden change in temperature, like hot food then cold water"]),
      h("Why do we have them?"),
      p("Nobody knows for sure. Babies hiccup a lot, even before they are born. Parents-to-be can sometimes feel tiny, regular bumps in the belly. Some scientists think hiccups might help babies practice breathing or push air bubbles out of their tummies. It's still a mystery."),
      fact("The hiccup record", "A man named Charles Osborne started hiccupping in 1922 and didn't stop until 1990. That's 68 years! He still lived a mostly normal life."),
      h("Do hiccup cures work?"),
      p("People have lots of tricks: holding your breath, sipping water slowly, swallowing a spoonful of sugar, or having someone surprise you. Scientists haven't proven that any one trick works every time. Most hiccups go away on their own within a few minutes. If hiccups ever last for days, that is a good reason to see a doctor."),
      p("So next time you start hiccupping, take a slow breath and remember: it's just your diaphragm doing a little hop."),
    ],
    words: [
      { word: "diaphragm", meaning: "a dome-shaped muscle under the lungs that helps you breathe" },
      { word: "windpipe", meaning: "the tube that carries air from your throat to your lungs" },
      { word: "twitch", meaning: "a quick movement a muscle makes on its own" },
    ],
    questions: [
      { question: "Which muscle causes hiccups when it twitches?", options: ["The heart", "The diaphragm", "The biceps", "The tongue"], correct: "B" },
      { question: "What makes the \"hic\" sound?", options: ["Air hitting a flap that snaps shut at the top of the windpipe", "Your stomach growling", "Your teeth clicking", "Your heart beating"], correct: "A" },
      { question: "Which of these can start hiccups?", options: ["Sleeping", "Reading a book", "Eating or drinking too fast", "Walking slowly"], correct: "C" },
      { question: "How long did Charles Osborne have hiccups?", options: ["68 minutes", "68 days", "6 months", "68 years"], correct: "D" },
      { question: "What does the article say about hiccup cures?", options: ["Holding your breath always works", "No single trick has been proven to work every time", "Only doctors can stop hiccups", "Fizzy drinks cure hiccups"], correct: "B" },
    ],
  },
];

// Questions are written with the right answer anywhere; this mixes the options in a
// fixed (seeded) way so answer letters don't fall into a pattern kids can guess.
const LETTERS = ["A", "B", "C", "D"] as const;
function seeded(text: string) {
  let s = 2166136261;
  for (const ch of text) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return s / 4294967296; };
}
function mix(slug: string, q: NewsQuestion, i: number): NewsQuestion {
  const r = seeded(`${slug}#${i}`);
  const order = [0, 1, 2, 3];
  for (let k = 3; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  const right = LETTERS.indexOf(q.correct);
  return { question: q.question, options: order.map((o) => q.options[o]) as NewsQuestion["options"], correct: LETTERS[order.indexOf(right)] };
}

function mixAll(a: NewsArticle): NewsQuestion[] {
  // reseed until a quiz uses at least three different answer letters
  for (let salt = 0; ; salt++) {
    const qs = a.questions.map((q, i) => mix(salt ? `${a.slug}~${salt}` : a.slug, q, i));
    if (new Set(qs.map((q) => q.correct)).size >= 3) return qs;
  }
}

export const QUICK_READS: NewsArticle[] = WRITTEN.map((a) => ({ ...a, questions: mixAll(a) }));
