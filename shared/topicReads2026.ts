// Source-based, age-appropriate feature articles for October 2026.
import type { NewsArticle, NewsSection, NewsQuestion } from "./ariseNews";
type Draft={slug:string;section:NewsSection;title:string;dek:string;src:string[];body:string;words:string[][];qa:string[][]};
const drafts:Draft[]=[
  {
    "slug": "how-ocean-tides-work",
    "section": "Science",
    "title": "Why the Ocean Rises and Falls Twice a Day",
    "dek": "The Moon's gravity helps move enormous amounts of seawater, but every coast has its own tide pattern.",
    "src": [
      "https://oceanservice.noaa.gov/education/tutorial_tides/welcome.html"
    ],
    "body": "Stand on a beach at breakfast, and the water may reach the bottom of the steps. Return after lunch, and more sand may be showing. Did the ocean lose water? No. Along many coastlines, the water rises and falls in a regular pattern called the tides. The movement is enormous, yet it usually happens so gradually that people do not notice it minute by minute. Understanding tides helps boat captains, fishers, beach visitors, and scientists make sense of a changing shoreline.\n\n## A pull from far away\n\nEarth's Moon has gravity, a force that pulls on objects. Because the Moon is closer to one side of Earth than the other, its gravitational pull is not equally strong everywhere. The difference helps produce tidal bulges in the oceans. As Earth rotates, many places pass through the regions of higher and lower water. The Sun also affects tides because it has gravity of its own. The relationship between Earth, the Moon, and the Sun makes tide patterns more interesting than simply saying that the Moon pulls water toward itself.\n\n## High tide and low tide\n\nHigh tide is the time when the sea reaches a higher level along the shore. Low tide is when the water level falls. Many coastal places experience two high tides and two low tides each day, though this is not true everywhere. Local geography matters. Narrow bays, underwater ridges, and the shape of a coastline can make tidal timing and height very different from one location to another. A harbor may have large tides while a nearby area experiences smaller changes.\n\n## Special times in the month\n\nWhen the Sun, Earth, and Moon line up around a new moon or full moon, their tidal effects reinforce one another. The difference between high and low tide is often larger. These are called spring tides, even though they can happen in any season. Near the first and third quarter moons, the Sun and Moon pull at roughly right angles from Earth's point of view. The difference between high and low tide is often smaller, producing neap tides. The names describe a pattern of water movement, not the weather.\n\n## Why people check tide tables\n\nA tide table predicts when high and low water will occur at a specific place. People who sail or fish use this information because shallow areas may become too shallow for boats at low tide. Scientists also use measurements to study flooding and coastal change. If a storm arrives during an especially high tide, water may reach farther inland than usual. That is why tide predictions are connected to safety planning, not only to visiting a beach.\n\n## A coast is always changing\n\nImagine visiting a rocky tide pool with an adult during safe conditions. At low tide, little pools may expose sea stars, snails, and tiny crabs. As the water returns, those same creatures may be covered by the ocean again. Tides make one small place look like two different habitats during the same day. The next time you see a photo of a beach, ask whether it was taken at high tide or low tide. That question may explain much more than the photographer's choice of camera angle.",
    "words": [
      [
        "gravity",
        "the force that attracts objects toward one another"
      ],
      [
        "neap tide",
        "a tide pattern with a smaller difference between high and low water"
      ],
      [
        "coastline",
        "the boundary where land meets the sea"
      ]
    ],
    "qa": [
      [
        "What helps produce ocean tides?",
        "Gravity from the Moon and Sun",
        "Only wind",
        "Earthquakes every day",
        "Cloud shadows"
      ],
      [
        "What happens at low tide?",
        "The water level falls along a shore",
        "The ocean disappears",
        "The Moon stops moving",
        "Fish leave all oceans"
      ],
      [
        "When are spring tides common?",
        "Near new and full moons",
        "Only in springtime",
        "Only in the afternoon",
        "After every rainstorm"
      ],
      [
        "What do tide tables predict?",
        "Times and levels of tides at places",
        "How many shells are on sand",
        "Every fish's location",
        "Exact cloud colors"
      ],
      [
        "Why should boat captains check tides?",
        "Water depth can change",
        "Boats only move at high tide",
        "All harbors are identical",
        "Tides control engines"
      ]
    ]
  },
  {
    "slug": "basketball-shot-arc-physics",
    "section": "Sports",
    "title": "The Math Behind a Basketball Shot",
    "dek": "A ball's arc, launch angle, spin, and distance explain why a smooth shot can be so satisfying.",
    "src": [
      "https://www.nba.com/news",
      "https://www.nasa.gov/stem-content/"
    ],
    "body": "A basketball leaves a player's hands, rises in a smooth curve, and drops through the hoop. Fans may call that shot beautiful. A scientist might call it a problem in motion. Every shot involves forces, speed, angles, and distance. The ball does not travel in a straight line from the player's hands to the rim. Gravity pulls it downward while its forward motion carries it toward the basket. Together, those movements create a curved path through the air.\n\n## The arc matters\n\nImagine throwing a ball almost straight toward a hoop. It might travel quickly, but its path offers a narrow opening for the ball to pass through. A higher arc lets the ball approach the basket from above, where the circular rim appears to give it more room. But higher is not always better. A shot sent almost straight up may fall short or be difficult to control. Players practice to find a useful balance between the speed of the ball and the angle at which it leaves their hands.\n\n## The role of distance\n\nA free throw is taken from a fixed location, so players can repeat their routine. A long three-point shot starts farther from the basket. To cover that extra distance, the player generally needs a different combination of force and release angle. Different players use different techniques depending on their height, strength, and habits. That is why simply copying another athlete's exact motion will not guarantee the same result.\n\n## Spin and the backboard\n\nMany players put backspin on the ball, making it rotate backward as it travels. Backspin can affect how the ball behaves after it touches the rim or backboard. A softer bounce may help the ball stay near the basket rather than bouncing far away. The square on the backboard can also be a useful visual guide for close shots called bank shots. Players learn to use angles to direct the ball off the board and toward the hoop.\n\n## Practice becomes data\n\nA coach may ask a player to take twenty shots from one spot and record how many go in. That number gives a simple measure of accuracy. If twelve out of twenty shots are successful, the success rate is sixty percent. Practicing again after making a small adjustment can show whether the change helped. One session is not enough to prove a technique always works, however. Fatigue, attention, and differences in each attempt can affect the result.\n\n## Try the investigation\n\nWith a safe space and an adult's permission, use a soft foam ball and a target. Make five gentle throws with a low arc, then five with a medium arc. Keep the starting place the same. Record the number of successes and compare them. Do not assume the second group will always win; collect evidence. Basketball is a sport played by people, not robots, so the same motion is never repeated perfectly. Still, understanding the science can help players explain what their bodies are learning through practice.",
    "words": [
      [
        "arc",
        "the curved path an object follows through the air"
      ],
      [
        "backspin",
        "rotation of a ball backward as it moves forward"
      ],
      [
        "accuracy",
        "how often an attempt reaches its intended target"
      ]
    ],
    "qa": [
      [
        "Why does a basketball follow a curved path?",
        "Gravity pulls it down as it moves forward",
        "It becomes lighter in the air",
        "The hoop attracts it magnetically",
        "The crowd pushes it"
      ],
      [
        "What can a higher shooting arc provide?",
        "A better downward approach to the rim",
        "An automatic three points",
        "No need to aim",
        "More time on the clock"
      ],
      [
        "What is backspin?",
        "Backward rotation of a moving ball",
        "A backward pass",
        "A bounce off the floor",
        "A player turning in a circle"
      ],
      [
        "What is twelve of twenty as a percentage?",
        "60 percent",
        "20 percent",
        "80 percent",
        "12 percent"
      ],
      [
        "Why repeat a shooting experiment?",
        "To see whether a pattern continues",
        "To prove every person shoots alike",
        "To avoid recording results",
        "To keep the ball still"
      ]
    ]
  },
  {
    "slug": "soccer-world-cup-how-qualifying-works",
    "section": "Soccer",
    "title": "How a Team Earns a Place at the World Cup",
    "dek": "Before soccer's biggest tournament begins, national teams play years of qualifying matches.",
    "src": [
      "https://www.fifa.com/tournaments/mens/worldcup",
      "https://www.fifa.com/"
    ],
    "body": "When fans see national soccer teams walking into a World Cup stadium, it may feel as if the tournament began that day. In reality, the journey started years earlier. Most national teams must earn their places through qualifying matches. A player could score an important goal on a rainy evening in one country and help decide whether the team travels to the tournament much later. The World Cup is not simply a collection of invited famous players. It is the final stage of a much larger competition.\n\n## One planet, different regions\n\nSoccer's world governing body, FIFA, organizes World Cup qualification through regional groups called confederations. Teams in Europe, South America, Africa, Asia, North and Central America and the Caribbean, and Oceania follow qualifying paths based on their regions. These systems are not identical. Some use groups where teams play one another several times. Others include knockout rounds or playoff matches. The exact number of available tournament places can change with the size of the World Cup.\n\n## Points in the group stage\n\nIn many qualifying groups, a team earns three points for a victory and one point for a draw. A loss gives no points. Imagine a team that wins two games, draws one, and loses one. It earns seven points: three plus three plus one. Teams compare their totals after a set of matches. When teams have equal points, additional rules such as goal difference may help determine the order. Goal difference is the number of goals scored minus the number conceded.\n\n## Playing home and away\n\nQualification can be challenging because teams often play both at home and in another country. The home side may have familiar weather, a familiar field, and cheering fans. A visiting team might deal with long flights, unusual altitude, or a different style of play. Coaches prepare carefully so players can adapt. A strong team cannot assume it will win just because it has well-known stars. Organization, fitness, and teamwork matter during every match.\n\n## Why the format matters\n\nThe rules affect how a team approaches a game. If a draw is enough to advance, a coach might choose a careful strategy near the end. If a team must win, it may move more players forward and accept greater risk. Fans can better understand these choices by looking at the group standings and the remaining schedule. Sometimes a match with only one goal contains an enormous amount of tension because so much depends on the final score.\n\n## Follow a team like a reporter\n\nPick a national team and locate its qualifying group on an official competition website. Write down its wins, draws, losses, and points. Then calculate a possible result for the next match. Do not confuse your prediction with something that has already happened. The fun of qualification is that the story changes as games are played. The World Cup may last only several weeks, but the path to that stage is a long lesson in preparation and persistence.",
    "words": [
      [
        "qualifying",
        "matches used to decide who can enter a tournament"
      ],
      [
        "confederation",
        "an organization representing teams in a world region"
      ],
      [
        "goal difference",
        "goals scored minus goals allowed"
      ]
    ],
    "qa": [
      [
        "What is the main purpose of World Cup qualifying?",
        "To decide which teams reach the tournament",
        "To choose the referee's shoes",
        "To pick stadium music",
        "To eliminate all home games"
      ],
      [
        "How many points does a group-stage win usually earn?",
        "Three",
        "One",
        "Five",
        "Zero"
      ],
      [
        "How many points come from two wins and one draw?",
        "Seven",
        "Six",
        "Four",
        "Nine"
      ],
      [
        "What is goal difference?",
        "Goals scored minus goals conceded",
        "The height of a goal",
        "The number of referees",
        "The length of halftime"
      ],
      [
        "Why might a coach change strategy late in a match?",
        "The required result may affect advancement",
        "Soccer rules disappear late",
        "Players stop getting tired",
        "Every draw is a loss"
      ]
    ]
  },
  {
    "slug": "dia-de-los-muertos-memories",
    "section": "World",
    "title": "Día de los Muertos: Remembering Loved Ones with Color",
    "dek": "Families in Mexico and beyond mark a time for memory with photographs, marigolds, food, and shared stories.",
    "src": [
      "https://americanindian.si.edu/",
      "https://www.britannica.com/topic/Day-of-the-Dead"
    ],
    "body": "Bright orange marigolds, colorful paper banners, photographs, and familiar foods can all appear during Día de los Muertos, or the Day of the Dead. This tradition is especially associated with Mexico, though celebrations take different forms across communities and families. The holiday honors loved ones who have died. Its colors may surprise people who expect every remembrance to feel quiet or sad. For many families, remembering someone also means recalling laughter, favorite meals, music, and the stories they shared.\n\n## A time to remember\n\nDía de los Muertos is observed around November 1 and 2. Families may prepare a special place called an ofrenda, or offering display. It can include pictures of loved ones, candles used safely, flowers, and objects connected to the people being remembered. The display is not just decoration. Every item may carry a memory. A favorite food might remind someone of an aunt who loved cooking, while a photograph may bring back a trip taken many years earlier.\n\n## Why marigolds appear\n\nMarigolds are flowers with rich yellow and orange colors. They are often associated with Día de los Muertos in Mexico. Their petals may be arranged around an ofrenda or along a pathway. The flowers are meaningful within family traditions, but their exact use can vary. Families may also create papel picado, delicate decorations made from cut paper. The colorful sheets move gently when air passes through them and add texture to celebrations.\n\n## Foods and symbols\n\nPan de muerto, a bread made for the holiday, is one traditional food in many places. Families may also prepare dishes their relatives enjoyed. Sugar skulls and other decorations can appear in markets and homes. Although skulls are sometimes connected with frightening stories in other settings, they have a different place here. They can be colorful symbols of remembering life's cycle and making space for family memories. It would be inaccurate to treat every sugar skull as a Halloween decoration.\n\n## Traditions are not identical\n\nMexico is a large country with many regions and communities. Celebrations may be public, private, lively, or reflective. Some families visit cemeteries to clean or decorate graves and spend time remembering relatives. Others hold gatherings at home. Traditions have changed over time and have been shaped by Indigenous and European histories. Respectful visitors should learn about the customs of a particular family or community rather than assuming one picture represents every celebration.\n\n## Make room for memories\n\nA class can learn from the holiday without copying sacred or private family practices. Students might ask a trusted adult about a relative's favorite song, look at a family photograph, or write a short story about someone important to them. Anyone who does not want to share a personal memory should be able to keep it private. The central idea is simple but powerful: stories help people remember one another. In Día de los Muertos, bright colors and shared traditions become ways to keep those stories present.",
    "words": [
      [
        "ofrenda",
        "a display honoring people who have died"
      ],
      [
        "marigold",
        "an orange or yellow flower used in some celebrations"
      ],
      [
        "tradition",
        "a custom shared and passed down over time"
      ]
    ],
    "qa": [
      [
        "What does Día de los Muertos honor?",
        "Loved ones who have died",
        "The start of summer",
        "A sports victory",
        "The arrival of snow"
      ],
      [
        "What is an ofrenda?",
        "A display for remembrance",
        "A soccer goal",
        "A type of volcano",
        "A musical note"
      ],
      [
        "What flower is often associated with the holiday?",
        "Marigold",
        "Tulip",
        "Cactus flower only",
        "Daisy only"
      ],
      [
        "What is papel picado?",
        "Decorative cut paper",
        "A kind of bread",
        "A river bend",
        "A tennis move"
      ],
      [
        "What is respectful when learning about traditions?",
        "Recognize differences among families",
        "Assume every family is identical",
        "Take items without asking",
        "Mock unfamiliar customs"
      ]
    ]
  },
  {
    "slug": "rainbow-light-refraction",
    "section": "Science",
    "title": "How Rainbows Turn Sunlight into Color",
    "dek": "Raindrops act like tiny prisms that bend and reflect light into an arc of colors.",
    "src": [
      "https://www.weather.gov/jetstream/rainbows",
      "https://scijinks.gov/rainbow/"
    ],
    "body": "The rain stops, sunlight breaks through the clouds, and a bright arc appears in the sky. A rainbow can seem almost magical, but it follows the rules of light. Sunlight looks white to our eyes, yet it contains many colors. When light enters a water droplet, its path changes. Some light reflects inside the droplet and bends again when it leaves. This process helps separate colors that were mixed together in the sunlight.\n\n## Light changes direction\n\nScientists use the word refraction for the bending of light as it moves from one material to another. A raindrop can bend light because light travels differently through air and water. Colors are refracted by slightly different amounts. Red light and violet light therefore leave the droplet at somewhat different angles. Millions of droplets can send light toward an observer, producing the familiar bands of color in the sky.\n\n## Where to look\n\nA common rainbow appears when the Sun is behind you and rain or mist is in front of you. The bright arc is centered on a point opposite the Sun, so the rainbow's position depends on where you stand. If you and a friend are standing several feet apart, you are not receiving exactly the same light from exactly the same droplets. That is why a rainbow is not an object fixed in the sky like a bridge.\n\n## Why red is outside\n\nIn a primary rainbow, red usually appears along the outside of the arc and violet toward the inside. This arrangement comes from the way different wavelengths of light bend and reflect through water drops. The colors blend gradually, even though pictures and posters often draw seven neat stripes. There are not solid walls separating one color from another. Our eyes and brains group the continuous range of colors into familiar names.\n\n## Double rainbows\n\nSometimes people see a second, fainter rainbow outside the first. A secondary rainbow forms when light reflects twice inside water droplets instead of once. Its colors appear in reverse order. Between the two arcs, the sky can look darker than the surrounding area. A double rainbow gives scientists an even richer example of how geometry, reflection, and refraction work together.\n\n## Try a safe color experiment\n\nYou can explore light with a clear glass of water and white paper near a sunny window, with adult help. Move the glass slowly and watch whether colored light appears on the paper. Never look directly at the Sun. The experiment may not produce a perfect rainbow, but it can show that light changes direction when moving through water. The next time you see colors in the sky, look for the conditions around you: sunshine behind, water ahead, and millions of tiny droplets acting like little lenses.",
    "words": [
      [
        "refraction",
        "bending of light as it enters a different material"
      ],
      [
        "wavelength",
        "a property of light connected to its color"
      ],
      [
        "secondary",
        "second in position or order"
      ]
    ],
    "qa": [
      [
        "What separates sunlight into rainbow colors?",
        "Bending and reflecting light inside water drops",
        "Clouds painting the sky",
        "The Moon turning blue",
        "Only city lights"
      ],
      [
        "Where is the Sun usually when you see a rainbow?",
        "Behind the observer",
        "Directly under the rainbow",
        "Inside the ground",
        "Always overhead"
      ],
      [
        "Which color appears on the outer edge of a primary rainbow?",
        "Red",
        "Violet",
        "Green",
        "Blue"
      ],
      [
        "Why is a secondary rainbow different?",
        "Light reflects twice inside droplets",
        "It uses dry sand",
        "It has no sunlight",
        "It only appears at night"
      ],
      [
        "What safety rule matters in sunlight experiments?",
        "Never look directly at the Sun",
        "Touch every hot object",
        "Use broken glass",
        "Stand in traffic"
      ]
    ]
  }
];
const letters=["A","B","C","D"] as const;
const makeQuiz=(qs:string[][]):NewsQuestion[]=>qs.map(([question,answer,...wrong],i)=>{const k=[1,3,0,2,1][i];const options=[...wrong];options.splice(k,0,answer);return{question,options:options as NewsQuestion["options"],correct:letters[k]};});
export const TOPIC_READS:NewsArticle[]=drafts.map(a=>({slug:a.slug,kind:"feature",section:a.section,title:a.title,dek:a.dek,grades:"Grades 4–8",publishedOn:"2026-10-22",sources:a.src.map(url=>({name:new URL(url).hostname,url})),body:a.body.split(/\n\n/).map(t=>t.startsWith("## ")?{kind:"h" as const,text:t.slice(3)}:{kind:"p" as const,text:t}),words:a.words.map(([word,meaning])=>({word,meaning})),questions:makeQuiz(a.qa)}));