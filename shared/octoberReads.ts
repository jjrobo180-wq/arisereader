// Editorially drafted new 5-Minute Reads (October 2026). Source links and real Commons photographs are attached.
import type { NewsArticle, NewsSection, NewsQuestion } from "./ariseNews";
type Draft = { slug:string; section:NewsSection; title:string; dek:string; grades:string; photo?:{file:string;alt:string;focus?:string;credit?:string;license?:string}; sources:{name:string;url:string}[]; body:string; words:[string,string][]; questions:[string,string,string,string,string][] };
const drafts: Draft[] = [
  {
    "slug": "coco-gauff-first-title",
    "section": "Biography",
    "title": "Coco Gauff: The Teen Who Won the US Open",
    "dek": "A Florida tennis player turned a tough first set into a Grand Slam victory at just 19.",
    "grades": "Grades 4–8",
    "photo": {
      "file": "Coco Gauff.jpg",
      "alt": "Coco Gauff on a tennis court in 2022",
      "focus": "50% 22%",
      "credit": "All-Pro Reels",
      "license": "CC BY-SA 2.0"
    },
    "sources": [
      {
        "name": "Official US Open: Gauff wins her first Grand Slam",
        "url": "https://www.usopen.org/en_US/news/articles/2023-09-09/coco_gauff_wins_first_grand_slam_title_2023_us_open_day_13_in_review.html"
      },
      {
        "name": "Women's Tennis Association: Coco Gauff",
        "url": "https://www.wtatennis.com/players/328560/coco-gauff/"
      }
    ],
    "body": "When Coco Gauff walked onto the court for the 2023 US Open final, thousands of people were watching in New York. Her opponent, Aryna Sabalenka, had powerful shots and plenty of experience. Coco was only 19. She was playing for her first Grand Slam singles title, and the match began badly for her. Sabalenka won the opening set 6–2. A set is one part of a tennis match, so Coco had to win the next two sets to take the championship.\n\n## Staying in the match\n\nSome athletes might begin rushing after losing a set. Coco did something different: she kept moving, returned difficult balls, and forced Sabalenka to play more shots. Tennis is not only about hitting the ball hard. Players must judge where it will land, decide when to attack, and stay calm after making mistakes. Coco won the second set 6–3. Suddenly, the biggest match of her young career was even.\n\nThe third set became Coco's chance to show how much her game had grown. She covered the court quickly, changed the direction of her shots, and fought for points even when she was stretched wide. She won that final set 6–2. Fans roared as she dropped to the court in disbelief. She had become the first American teenager to win the US Open women's singles title since Serena Williams in 1999.\n\n## A long road to one trophy\n\nCoco grew up in Florida and started playing tennis when she was young. Her parents helped her practice and travel to competitions. As a teenager, she made a splash at Wimbledon in 2019 by beating Venus Williams. That victory brought sudden attention, but one exciting match was not the same as winning a major championship. There were losses and difficult days as Coco learned to compete against the world's best players.\n\nThat is one reason the US Open win mattered. It was not proof that she had never failed. It showed what happened when she continued working after disappointing results. After winning in New York, she also thanked Billie Jean King, a former champion who worked for equal prize money in women's tennis. Coco understood that her opportunity came partly from people who improved the sport before she was born.\n\nThe scores reveal another lesson about progress. Coco lost the first set, but tennis does not award a championship to the player who wins the opening set. She had to pay attention to the next point instead of treating the earlier result as the whole story. In a classroom, a student may miss the first problem on a worksheet or struggle during a presentation. That moment does not decide how the entire task will go. A useful next move is to notice one thing that can change: reading the directions again, checking an answer, or asking for feedback. Coco's victory cannot promise everyone will win, but it offers a real example of persistence joined with smart adjustments.\n\n## What happened next?\n\nHer progress did not stop with one trophy. In 2024, Coco won the season-ending WTA Finals, a competition for top players. In 2025, she won the French Open women's singles title, her second Grand Slam title. The French Open is played mostly on clay, a slower surface than the hard courts of the US Open. Winning on both demanded different movement and patience.\n\nImagine being down one set during the most important match of your life. Would you rush to hit harder, or take time to think about what is working? Coco's final reminds readers that a comeback can start with one careful point. A championship is decided by scores, but the effort between those scores is a story of its own.",
    "words": [
      [
        "Grand Slam",
        "one of tennis's four most important yearly tournaments"
      ],
      [
        "set",
        "a group of games that makes up part of a tennis match"
      ],
      [
        "clay",
        "a soft court surface used in some tennis tournaments"
      ]
    ],
    "questions": [
      [
        "How old was Coco when she won the 2023 US Open?",
        "19",
        "15",
        "22",
        "27"
      ],
      [
        "Who did Coco defeat in the 2023 final?",
        "Aryna Sabalenka",
        "Venus Williams",
        "Serena Williams",
        "Billie Jean King"
      ],
      [
        "What was Coco's result after losing the first set?",
        "She won the next two sets",
        "She quit the match",
        "She lost the match",
        "She asked to restart"
      ],
      [
        "Which major did Coco win in 2025?",
        "The French Open",
        "Wimbledon",
        "The Australian Open",
        "The Davis Cup"
      ],
      [
        "What did Coco thank Billie Jean King for helping achieve?",
        "Equal prize money",
        "New tennis balls",
        "Longer matches",
        "Indoor tennis courts"
      ]
    ]
  },
  {
    "slug": "billie-eilish-bedroom-to-grammys",
    "section": "Biography",
    "title": "Billie Eilish: Songs Made at Home, Heard Around the World",
    "dek": "How one singer and her brother turned home recordings into award-winning music.",
    "grades": "Grades 4–8",
    "photo": {
      "file": "BillieEilishO2140725-66 - 54666402736 (cropped).jpg",
      "alt": "Billie Eilish performing in London in 2025",
      "focus": "50% 20%",
      "credit": "Raph_PH",
      "license": "CC BY 4.0"
    },
    "sources": [
      {
        "name": "Recording Academy: Billie Eilish artist profile",
        "url": "https://www.grammy.com/artists/billie-eilish/251741/"
      }
    ],
    "body": "Imagine recording a song at home and discovering that people all over the world want to hear it. That is part of Billie Eilish's story. Billie was born in Los Angeles in 2001 and grew up in a family that loved music and creativity. She sang, played with melodies, and learned to write songs. Her older brother, Finneas O'Connell, also made music. Instead of waiting for someone to invite them into a giant recording studio, they worked together at home.\n\n## A song takes off\n\nIn 2015, Billie recorded a song called Ocean Eyes, written by Finneas, and shared it online. Listeners were drawn to the gentle melody and Billie's unusual, quiet singing style. The song spread beyond the people who knew her. That did not happen because every musician suddenly began singing the same way. Billie's voice stood out because it sounded different from many pop songs people were used to hearing.\n\nMaking music at home still takes work. Singers often record the same line more than once. A producer, the person helping shape a recording, may try different sounds and rhythms. Billie and Finneas tested ideas, listened closely, and made decisions together. Their recordings showed that a small room and a computer could be enough to begin making professional music.\n\n## The biggest awards night\n\nBillie's first album, When We All Fall Asleep, Where Do We Go?, came out in 2019. The following year, she won four major Grammy categories on the same night: Album of the Year, Record of the Year, Song of the Year, and Best New Artist. She was only 18. The Grammys recognize recordings and people who make music, from singers to producers and songwriters.\n\nA record and a song are not quite the same award. Record of the Year recognizes a particular recording and its production, while Song of the Year honors the people who wrote a song. The difference matters because a memorable recording involves both a composition and the choices made while performing and recording it.\n\n## Writing for stories on screen\n\nBillie also helped create songs for movies. She and Finneas wrote What Was I Made For? for the 2023 film Barbie. The song explores questions about identity and purpose. It won major awards, including an Oscar for Best Original Song. Her 2024 album Hit Me Hard and Soft continued to show different sides of her singing and songwriting.\n\nBehind each public performance are many private choices: finding the right word, replacing a note, deciding when the music should become quiet, and sometimes starting over. Listeners may hear only a few minutes of finished music, but the people creating it may spend weeks making it feel right.\n\nThere is another reason songwriting can feel like solving a puzzle. A songwriter chooses words, a melody, and a rhythm, but those parts have to fit together. A word that sounds perfect on paper might be too long to sing naturally. A soft recording might communicate emotion better than a loud one. During a collaboration, two people may hear different possibilities. They need to explain their choices and decide what serves the song. This is similar to revising a school essay: the first version gives you something to work with, and each change can make the message clearer. Success is not only about having an idea. It also depends on returning to the idea and improving it.\n\n## Your own creative voice\n\nYou do not need a famous family or expensive stage to try something creative. Write four lines about a place you remember. Read them out loud. Move a word, change a rhythm, or ask someone to listen. The idea is not to copy Billie's sound. Her story shows what can happen when artists practice, collaborate, and let their own voices be heard.",
    "words": [
      [
        "producer",
        "someone who helps shape and record music"
      ],
      [
        "composition",
        "music or lyrics created by a writer"
      ],
      [
        "collaborate",
        "to work together on a shared goal"
      ]
    ],
    "questions": [
      [
        "Who is Billie's main songwriting partner?",
        "Her brother Finneas",
        "Her basketball coach",
        "A tennis player",
        "A movie director"
      ],
      [
        "Where did Billie and Finneas make many early recordings?",
        "At home",
        "At a stadium",
        "In a library",
        "On a cruise ship"
      ],
      [
        "Which song was shared online in 2015?",
        "Ocean Eyes",
        "Bad Romance",
        "Shake It Off",
        "Firework"
      ],
      [
        "How old was Billie at her big 2020 Grammy night?",
        "18",
        "12",
        "25",
        "30"
      ],
      [
        "What movie featured What Was I Made For?",
        "Barbie",
        "Frozen",
        "Moana",
        "Inside Out"
      ]
    ]
  },
  {
    "slug": "zendaya-from-disney-to-leading-roles",
    "section": "Biography",
    "title": "Zendaya: Learning New Skills for Every Role",
    "dek": "From dancing and television comedy to movies, Zendaya built a career by learning and adapting.",
    "grades": "Grades 4–8",
    "photo": {
      "file": "Zendaya 2024.jpg",
      "alt": "Zendaya at a film premiere in 2024",
      "focus": "50% 22%",
      "credit": "ManoSolo13241324",
      "license": "CC0 1.0"
    },
    "sources": [
      {
        "name": "Television Academy: Zendaya",
        "url": "https://www.televisionacademy.com/features/news/awards-news/zendaya-emmys-history"
      },
      {
        "name": "Encyclopaedia Britannica: Zendaya",
        "url": "https://www.britannica.com/biography/Zendaya"
      }
    ],
    "body": "A television comedy, a superhero movie, and a science-fiction adventure may seem like completely different worlds. Actress Zendaya has worked in all three. She was born in Oakland, California, in 1996. As a child, she became interested in performing and learned about what happens both onstage and behind the scenes. Those early experiences taught her that a performance involves more than memorizing words. A person must listen, respond, move, and work with a team.\n\n## Starting with dance and comedy\n\nZendaya became widely known on the Disney Channel series Shake It Up, which began in 2010. She and fellow performers played teenagers who loved dancing. Comedy can look easy on screen, but its timing is precise. An actor must know when to speak, pause, or react so the audience understands the joke. Dance adds another challenge: remembering steps while staying in rhythm with music and other dancers.\n\nShe later starred in K.C. Undercover, a Disney Channel show about a student who discovers her family works as spies. This role mixed action with comedy and gave her new chances to build a character. She also became involved in producing, which means helping make creative decisions about a program, not only acting in it.\n\n## Different characters need different skills\n\nZendaya played MJ in the Spider-Man films, appearing alongside other actors in a much larger production. A movie might shoot scenes out of order, so actors must remember how their characters would feel even when the next scene filmed is not the next scene in the story. Cameras, lights, costumes, and special effects are all part of the work.\n\nShe also played Chani in the Dune films, stories set on a distant desert planet. Science fiction asks performers to help audiences believe in an imaginary place. Actors may be surrounded by equipment rather than the landscapes viewers eventually see. Their reactions must still feel real to the people watching.\n\n## Taking serious work seriously\n\nIn the television drama Euphoria, Zendaya played a troubled teenager named Rue. That show is made for mature audiences and is not a children's program, but her work earned two Emmy Awards for lead acting in a drama series. An Emmy is an award for excellence in television. The recognition showed how far her career had moved from children's comedy.\n\nZendaya also starred in the 2024 film Challengers, which follows people involved in competitive tennis. Preparing for a sports role can include practicing movements and learning the habits of athletes. The goal is not necessarily to become a champion at that sport. It is to make a character's actions believable.\n\nPicture a film set for a moment. The director explains what the scene should communicate. A camera operator chooses an angle, costume designers prepare clothes, and the sound team listens for unwanted noise. An actor must do their part while staying aware of everyone else. The same short scene may be performed again and again so the crew can capture different views. That is teamwork under pressure, not simply pretending while someone records. School projects sometimes work the same way. A group presentation succeeds when students learn their parts, listen carefully, and adapt when something unexpected happens. Understanding what other people contribute can make each person's own work stronger.\n\n## The skill behind success\n\nOne lesson in this story is that people can grow by trying unfamiliar tasks. Dancing, comedy, drama, and film acting ask for different kinds of practice. Imagine joining a play when you usually prefer sports or making a presentation when you are usually quiet. You might not become an expert on your first attempt, but every new skill gives you another way to express yourself.",
    "words": [
      [
        "producing",
        "helping make decisions about a show or movie"
      ],
      [
        "special effects",
        "techniques that create unusual images or action on screen"
      ],
      [
        "Emmy",
        "an award recognizing excellence in television"
      ]
    ],
    "questions": [
      [
        "Which Disney Channel show first made Zendaya widely known?",
        "Shake It Up",
        "Good Luck Charlie",
        "Jessie",
        "Austin & Ally"
      ],
      [
        "What does a producer help do?",
        "Make creative decisions about a program",
        "Sell movie tickets only",
        "Perform every stunt",
        "Clean tennis courts"
      ],
      [
        "Which superhero film series featured Zendaya as MJ?",
        "Spider-Man",
        "Batman",
        "The Incredibles",
        "Superman"
      ],
      [
        "What kind of award is an Emmy?",
        "A television award",
        "A tennis trophy",
        "A science prize",
        "A music instrument"
      ],
      [
        "Which 2024 film had Zendaya playing a character connected to tennis?",
        "Challengers",
        "Dune",
        "Frozen",
        "Moana"
      ]
    ]
  },
  {
    "slug": "naomi-osaka-four-grand-slams",
    "section": "Biography",
    "title": "Naomi Osaka: A Powerful Serve and a Voice of Her Own",
    "dek": "A tennis champion learned to compete under pressure and speak about what matters to her.",
    "grades": "Grades 4–8",
    "photo": {
      "file": "Naomi Osaka Pan Pacific Open 2022 (cropped).jpg",
      "alt": "Naomi Osaka on a tennis court in Japan in 2022",
      "focus": "50% 22%",
      "credit": "江戸村のとくぞう",
      "license": "CC BY-SA 4.0"
    },
    "sources": [
      {
        "name": "US Open: Naomi Osaka as an athlete and activist",
        "url": "https://www.usopen.org/en_US/news/articles/2020-09-12/as_an_athlete_and_activist_naomi_osaka_is_a_champion.html"
      },
      {
        "name": "US Open: Osaka rises to the moment",
        "url": "https://www.usopen.org/en_US/news/articles/2020-08-28/naomi_osaka_the_champion_and_the_activist_rises_to_the_moment.html"
      }
    ],
    "body": "In tennis, a serve is the shot that begins a point. Naomi Osaka became known for a serve that could travel incredibly fast. But her path to becoming a champion involved more than powerful shots. Naomi was born in Japan in 1997 to a Japanese mother and a Haitian father. Her family later lived in the United States, where she trained for years. Her story connects countries, cultures, and the pressure of competing in front of huge crowds.\n\n## A breakthrough in New York\n\nIn 2018, Naomi reached the women's singles final of the US Open. She faced Serena Williams, one of the most successful tennis players in history. Naomi won the match and became the first Japanese singles player to win a Grand Slam tennis title. She was only 20 years old. A Grand Slam tournament is one of four major yearly tennis events, and winning one can change a player's life overnight.\n\nAfter the final, Naomi suddenly became one of the most talked-about athletes in the world. That kind of attention can be difficult. Every interview, match, and mistake may be discussed by strangers. Naomi was often quiet when speaking in public, but her tennis game was bold. Those two sides of her personality did not cancel each other out.\n\n## Winning on another continent\n\nHer success did not end in New York. Naomi won the 2019 Australian Open and rose to the world No. 1 ranking. The number one ranking is based on results across tournaments, not on the opinion of a single coach or fan. She later won the US Open again in 2020 and the Australian Open again in 2021. That gave her four Grand Slam singles championships.\n\nEach major tournament presents a different challenge. Players travel, adapt to changing conditions, and face opponents with different styles. A strong serve may help Naomi win a point quickly, but returning serves, moving across the court, and choosing where to hit are also important. Great tennis depends on a collection of skills working together.\n\n## Speaking up and stepping back\n\nNaomi used her visibility to draw attention to questions of fairness and equality. During the 2020 US Open, she wore masks naming Black people whose deaths had brought national attention to racism and violence. She later spoke publicly about mental health and stepped away from some competitions. Talking about personal struggles in public can be hard, especially when many people expect an athlete to compete all the time.\n\nHer choices reminded fans that athletes are people beyond the scoreboards. Being strong does not mean never needing rest or support. Some challenges happen where no camera can see them. Naomi also became a parent and later returned to playing professional tennis, another stage in a career that has never been just one straight line.\n\nTennis scores also tell only part of the story. Winning four major titles required Naomi to win matches against different opponents on different days, often under bright lights and high expectations. But the public rarely sees the ordinary practice sessions between tournaments: repeating serves, improving footwork, and planning how to return difficult shots. People sometimes compare their own beginning with someone else's most famous moment. That can be discouraging because it leaves out years of learning. A better question is what kind of practice helps a skill improve. For a reader, that might mean rereading a confusing paragraph, learning new vocabulary, or discussing an idea with a classmate before trying again.\n\n## More than one kind of courage\n\nImagine being expected to perform perfectly while people you have never met discuss your every decision. Would you want time alone, or people cheering nearby? Different individuals need different kinds of help. Naomi's story asks readers to think about two forms of courage: stepping onto the court to compete and explaining when something off the court matters, too.",
    "words": [
      [
        "serve",
        "the shot that starts a tennis point"
      ],
      [
        "ranking",
        "a place in an ordered list based on results"
      ],
      [
        "visibility",
        "being widely seen or noticed by the public"
      ]
    ],
    "questions": [
      [
        "Where was Naomi Osaka born?",
        "Japan",
        "France",
        "Brazil",
        "Canada"
      ],
      [
        "Who did Naomi defeat in the 2018 US Open final?",
        "Serena Williams",
        "Coco Gauff",
        "Billie Jean King",
        "Venus Williams"
      ],
      [
        "How many Grand Slam singles titles had Naomi won by 2021?",
        "Four",
        "One",
        "Two",
        "Seven"
      ],
      [
        "Which major did she win in 2019?",
        "Australian Open",
        "French Open",
        "Wimbledon",
        "Davis Cup"
      ],
      [
        "Besides tennis, what did Naomi speak publicly about?",
        "Mental health and fairness",
        "Car racing",
        "Mountain climbing",
        "Video game records"
      ]
    ]
  }
];
const LETTERS = ["A","B","C","D"] as const;
function questionsOf(d: Draft): NewsQuestion[] { return d.questions.map(([question,correct,...wrong],index) => { const slot=[0,2,1,3,0][index]; const options=[...wrong]; options.splice(slot,0,correct); return {question,options:options as NewsQuestion["options"],correct:LETTERS[slot]}; }); }
export const OCTOBER_READS: NewsArticle[] = drafts.map(d=>({slug:d.slug,kind:"feature",section:d.section,title:d.title,dek:d.dek,grades:d.grades,publishedOn:"2026-10-22",photo:d.photo,sources:d.sources,body:d.body.split(/\n\n/).map(t=>t.startsWith("## ") ? {kind:"h" as const,text:t.slice(3)} : {kind:"p" as const,text:t}),words:d.words.map(([word,meaning])=>({word,meaning})),questions:questionsOf(d)}));
