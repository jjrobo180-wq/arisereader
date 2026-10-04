// Poetry on Read on Arise: classic poems readers can read right on the site.
//
// House rules for this shelf:
// - Every poem here was first published before 1929, so it is in the public
//   domain in the United States. `year` is the year it first appeared in print
//   (a magazine or a book, whichever is best known).
// - Emily Dickinson's poems use the wording of the first printed editions
//   (1890s), not the later scholarly editions, which are still under copyright.
// - The words of a poem are never changed. Where early printings differ, we
//   use the wording most school anthologies print (and say so in the notes).
//   Notes, word meanings and questions are ours, written for young readers.
// - Keep notes short and neutral, and choose poems a class could read together.

export type PoemBand = "K-2" | "3-5" | "6-8";
export type Poem = {
  slug: string;
  title: string;
  poet: string;
  year: number;
  band: PoemBand;
  /** A few words on what the poem is about, shown on its card. */
  hook: string;
  /** Stanzas, each a list of lines. Leading spaces are kept (some poems are indented on purpose). */
  stanzas: string[][];
  /** Who wrote it and what to know before reading. */
  about: string;
  /** Something to listen or look for in how the poem is made. */
  notice: string;
  words: { word: string; meaning: string }[];
  think: string[];
};

/** Turns a block of text into stanzas (blank lines split stanzas). */
function lines(text: string): string[][] {
  return text.replace(/^\n+|\s+$/g, "").split(/\n[ \t]*\n/).map((stanza) => stanza.split("\n").map((l) => l.replace(/\s+$/, "")));
}

export const POEMS: Poem[] = [
  // ─── K-2 ───────────────────────────────────────────────────────────────────
  {
    slug: "rain", title: "Rain", poet: "Robert Louis Stevenson", year: 1885, band: "K-2", hook: "Four lines about rain falling everywhere.",
    stanzas: lines(`
The rain is raining all around,
It falls on field and tree,
It rains on the umbrellas here,
And on the ships at sea.`),
    about: "Robert Louis Stevenson was often sick as a child and spent many days in bed, watching the world from his window. He turned those days into a whole book of poems for children.",
    notice: "The poem starts close to you and ends far away. Each line takes the rain somewhere bigger.",
    words: [{ word: "field", meaning: "a wide, open piece of land" }],
    think: ["Where does the rain fall in the poem? Name all four places.", "Where is the rain falling when it rains where you live?"],
  },
  {
    slug: "the-swing", title: "The Swing", poet: "Robert Louis Stevenson", year: 1885, band: "K-2", hook: "Up in the air and down again.",
    stanzas: lines(`
How do you like to go up in a swing,
Up in the air so blue?
Oh, I do think it the pleasantest thing
Ever a child can do!

Up in the air and over the wall,
Till I can see so wide,
Rivers and trees and cattle and all
Over the countryside—

Till I look down on the garden green,
Down on the roof so brown—
Up in the air I go flying again,
Up in the air and down!`),
    about: "This poem comes from A Child's Garden of Verses, Stevenson's book about being a child. He wrote it as a grown-up, remembering how things felt when he was small.",
    notice: "Read it out loud and feel the beat. The lines swing back and forth, long then short, just like the swing.",
    words: [{ word: "pleasantest", meaning: "the nicest, the most fun" }, { word: "cattle", meaning: "cows" }, { word: "countryside", meaning: "land outside of towns, with farms and fields" }],
    think: ["What can the child see from the top of the swing?", "What do you think is the pleasantest thing a child can do?"],
  },
  {
    slug: "bed-in-summer", title: "Bed in Summer", poet: "Robert Louis Stevenson", year: 1885, band: "K-2", hook: "Going to bed when the sky is still blue.",
    stanzas: lines(`
In winter I get up at night
And dress by yellow candle-light.
In summer, quite the other way,
I have to go to bed by day.

I have to go to bed and see
The birds still hopping on the tree,
Or hear the grown-up people's feet
Still going past me in the street.

And does it not seem hard to you,
When all the sky is clear and blue,
And I should like so much to play,
To have to go to bed by day?`),
    about: "Stevenson grew up in Scotland, far to the north. There the summer sun stays up very late, long after a child's bedtime.",
    notice: "The lines rhyme in pairs: night and light, way and day. Two lines in a row that rhyme are called a couplet.",
    words: [{ word: "candle-light", meaning: "the light from a candle. When this poem was written, homes had no electric lights." }],
    think: ["Why does the child think bedtime is unfair in summer?", "The poem ends with a question. How would you answer it?"],
  },
  {
    slug: "my-shadow", title: "My Shadow", poet: "Robert Louis Stevenson", year: 1885, band: "K-2", hook: "A shadow that grows, shrinks and sleeps in.",
    stanzas: lines(`
I have a little shadow that goes in and out with me,
And what can be the use of him is more than I can see.
He is very, very like me from the heels up to the head;
And I see him jump before me, when I jump into my bed.

The funniest thing about him is the way he likes to grow—
Not at all like proper children, which is always very slow;
For he sometimes shoots up taller like an india-rubber ball,
And he sometimes gets so little that there's none of him at all.

He hasn't got a notion of how children ought to play,
And can only make a fool of me in every sort of way.
He stays so close beside me, he's a coward you can see;
I'd think shame to stick to nursie as that shadow sticks to me!

One morning, very early, before the sun was up,
I rose and found the shining dew on every buttercup;
But my lazy little shadow, like an arrant sleepy-head,
Had stayed at home behind me and was fast asleep in bed.`),
    about: "The child in this poem talks about a shadow as if it were another child who follows him around. Stevenson never says how shadows really work. He lets you figure it out.",
    notice: "The poet treats the shadow like a person: it jumps, it is lazy, it sleeps in. Giving human actions to a thing is called personification.",
    words: [{ word: "india-rubber ball", meaning: "a bouncy rubber ball" }, { word: "notion", meaning: "an idea" }, { word: "nursie", meaning: "a nurse or nanny who looks after a child" }, { word: "arrant", meaning: "complete, total" }, { word: "dew", meaning: "tiny drops of water on the grass in the morning" }],
    think: ["Why was there no shadow before the sun was up?", "When is your shadow tall? When is it short?"],
  },
  {
    slug: "who-has-seen-the-wind", title: "Who Has Seen the Wind?", poet: "Christina Rossetti", year: 1872, band: "K-2", hook: "You can't see the wind, but you can see what it does.",
    stanzas: lines(`
Who has seen the wind?
Neither I nor you:
But when the leaves hang trembling,
The wind is passing through.

Who has seen the wind?
Neither you nor I:
But when the trees bow down their heads,
The wind is passing by.`),
    about: "Christina Rossetti was an English poet. This poem comes from Sing-Song, a book of short rhymes she wrote for young children.",
    notice: "Both stanzas begin with the same question. Saying something again on purpose is called repetition, and it makes a poem easy to remember.",
    words: [{ word: "neither", meaning: "not one and not the other" }, { word: "trembling", meaning: "shaking a little" }, { word: "bow", meaning: "to bend forward" }],
    think: ["How does the poet know the wind is there?", "What else can you not see but still know is real?"],
  },
  {
    slug: "the-caterpillar", title: "The Caterpillar", poet: "Christina Rossetti", year: 1872, band: "K-2", hook: "A caterpillar in a hurry, with a big change ahead.",
    stanzas: lines(`
Brown and furry
Caterpillar in a hurry,
Take your walk
To the shady leaf, or stalk,
Or what not,
Which may be the chosen spot.
No toad spy you,
Hovering bird of prey pass by you;
Spin and die,
To live again a butterfly.`),
    about: "The poet is talking to a caterpillar and wishing it a safe trip. A caterpillar spins a cocoon or forms a chrysalis, and comes out later as a moth or butterfly.",
    notice: "Short line, long line, short line, long line. Try clapping the beat as you read.",
    words: [{ word: "stalk", meaning: "the stem of a plant" }, { word: "hovering", meaning: "staying in one place in the air" }, { word: "bird of prey", meaning: "a bird that hunts, like a hawk" }],
    think: ["What does the poet hope will not happen to the caterpillar?", "What does \"to live again a butterfly\" mean?"],
  },
  {
    slug: "the-purple-cow", title: "The Purple Cow", poet: "Gelett Burgess", year: 1895, band: "K-2", hook: "A very silly poem about a cow.",
    stanzas: lines(`
I never saw a Purple Cow,
I never hope to see one;
But I can tell you, anyhow,
I'd rather see than be one.`),
    about: "Gelett Burgess wrote this as a joke, and it became one of the best-known silly poems in America. He later grew tired of people reciting it to him.",
    notice: "A poem written just to be silly is called nonsense verse. It still follows rules: count the beats and listen for the rhymes.",
    words: [{ word: "anyhow", meaning: "anyway" }],
    think: ["Why would the poet rather see a purple cow than be one?", "Make up your own: \"I never saw a ___ ___.\""],
  },
  {
    slug: "the-pasture", title: "The Pasture", poet: "Robert Frost", year: 1914, band: "K-2", hook: "An invitation to come along to the farm.",
    stanzas: lines(`
I'm going out to clean the pasture spring;
I'll only stop to rake the leaves away
(And wait to watch the water clear, I may):
I sha'n't be gone long.—You come too.

I'm going out to fetch the little calf
That's standing by the mother. It's so young,
It totters when she licks it with her tongue.
I sha'n't be gone long.—You come too.`),
    about: "Robert Frost was a farmer in New England before he was a famous poet. He liked this poem so much that he put it at the front of his books, as a way of inviting readers in.",
    notice: "Each stanza ends with the same line. A line that keeps coming back in a poem is called a refrain.",
    words: [{ word: "pasture", meaning: "a grassy field where farm animals eat" }, { word: "spring", meaning: "a place where water comes up out of the ground" }, { word: "sha'n't", meaning: "an old way to write \"shall not\"" }, { word: "totters", meaning: "walks in a wobbly way" }],
    think: ["What two jobs is the speaker going to do?", "Who do you think \"you\" is?"],
  },

  // ─── 3-5 ───────────────────────────────────────────────────────────────────
  {
    slug: "fog", title: "Fog", poet: "Carl Sandburg", year: 1916, band: "3-5", hook: "Fog arrives the way a cat does.",
    stanzas: lines(`
The fog comes
on little cat feet.

It sits looking
over harbor and city
on silent haunches
and then moves on.`),
    about: "Carl Sandburg lived in Chicago, a city on a huge lake where fog rolls in off the water. He said he wrote this poem while waiting to meet someone, watching the fog over the harbor.",
    notice: "The whole poem is one comparison: fog is a cat. Saying one thing is another, without using \"like\" or \"as\", is a metaphor.",
    words: [{ word: "harbor", meaning: "a sheltered place by the shore where ships stay" }, { word: "haunches", meaning: "the back legs and hips of an animal when it sits" }],
    think: ["How is fog like a cat? Find three ways in the poem.", "What animal would you choose for rain? For thunder?"],
  },
  {
    slug: "dust-of-snow", title: "Dust of Snow", poet: "Robert Frost", year: 1923, band: "3-5", hook: "A crow, some snow, and a better mood.",
    stanzas: lines(`
The way a crow
Shook down on me
The dust of snow
From a hemlock tree

Has given my heart
A change of mood
And saved some part
Of a day I had rued.`),
    about: "Robert Frost wrote many poems about small moments outdoors in New England. Here, something tiny turns a bad day around.",
    notice: "The whole poem is a single sentence, split into eight very short lines. Read it without stopping, then read it again slowly, one line at a time.",
    words: [{ word: "hemlock", meaning: "a kind of evergreen tree" }, { word: "rued", meaning: "felt sorry about, wished had gone differently" }],
    think: ["What happened to the speaker, and how did it change the day?", "Has something small ever changed your mood? What was it?"],
  },
  {
    slug: "afternoon-on-a-hill", title: "Afternoon on a Hill", poet: "Edna St. Vincent Millay", year: 1917, band: "3-5", hook: "A whole happy afternoon outdoors.",
    stanzas: lines(`
I will be the gladdest thing
    Under the sun!
I will touch a hundred flowers
    And not pick one.

I will look at cliffs and clouds
    With quiet eyes,
Watch the wind bow down the grass,
    And the grass rise.

And when lights begin to show
    Up from the town,
I will mark which must be mine,
    And then start down!`),
    about: "Edna St. Vincent Millay grew up on the coast of Maine and became one of the most popular American poets of her time. This poem is from her first book.",
    notice: "Every other line is short and set in from the edge. The long lines tell what she will do, and the short lines finish the thought.",
    words: [{ word: "gladdest", meaning: "happiest" }, { word: "mark", meaning: "to notice, to pick out" }],
    think: ["Why do you think she touches the flowers but does not pick them?", "What is she looking for when the lights come on in the town?"],
  },
  {
    slug: "theme-in-yellow", title: "Theme in Yellow", poet: "Carl Sandburg", year: 1916, band: "3-5", hook: "A pumpkin tells its own story.",
    stanzas: lines(`
I spot the hills
With yellow balls in autumn.
I light the prairie cornfields
Orange and tawny gold clusters
And I am called pumpkins.
On the last of October
When dusk is fallen
Children join hands
And circle round me
Singing ghost songs
And love to the harvest moon;
I am a jack-o'-lantern
With terrible teeth
And the children know
I am fooling.`),
    about: "Carl Sandburg grew up on the prairie in Illinois, among cornfields and pumpkin patches. In this poem the speaker is not a person at all.",
    notice: "This poem has no rhyme and no steady beat. That is called free verse. Sandburg uses color words instead to tie the poem together.",
    words: [{ word: "prairie", meaning: "a wide, flat land covered in grass" }, { word: "tawny", meaning: "a yellow-brown color" }, { word: "dusk", meaning: "the time just after sunset" }, { word: "harvest moon", meaning: "the full moon in early autumn" }],
    think: ["Who is the \"I\" in this poem? How do you know?", "Why do the children know the jack-o'-lantern is \"fooling\"?"],
  },
  {
    slug: "windy-nights", title: "Windy Nights", poet: "Robert Louis Stevenson", year: 1885, band: "3-5", hook: "Who is galloping past in the dark?",
    stanzas: lines(`
Whenever the moon and stars are set,
    Whenever the wind is high,
All night long in the dark and wet,
    A man goes riding by.
Late in the night when the fires are out,
Why does he gallop and gallop about?

Whenever the trees are crying aloud,
    And ships are tossed at sea,
By, on the highway, low and loud,
    By at the gallop goes he.
By at the gallop he goes, and then
By he comes back at the gallop again.`),
    about: "A child lies awake on a stormy night and hears the wind rushing past the house. To the child it sounds like a rider on a horse.",
    notice: "Say the last two lines quickly. The beat goes da-da-DUM, da-da-DUM, like a horse galloping.",
    words: [{ word: "gallop", meaning: "the fastest way a horse runs" }, { word: "tossed", meaning: "thrown about" }, { word: "highway", meaning: "a main road" }],
    think: ["Is there really a man on a horse? What do you think the child hears?", "Which words in the poem sound like the wind?"],
  },
  {
    slug: "hope-is-the-thing-with-feathers", title: "Hope Is the Thing with Feathers", poet: "Emily Dickinson", year: 1891, band: "3-5", hook: "Hope is a small bird that never stops singing.",
    stanzas: lines(`
Hope is the thing with feathers
That perches in the soul,
And sings the tune without the words,
And never stops at all,

And sweetest in the gale is heard;
And sore must be the storm
That could abash the little bird
That kept so many warm.

I've heard it in the chillest land,
And on the strangest sea;
Yet, never, in extremity,
It asked a crumb of me.`),
    about: "Emily Dickinson lived a quiet life in Massachusetts and wrote almost 1,800 poems. Only a few were printed while she was alive. After she died, her sister found the rest, and they were published.",
    notice: "The poem never says \"hope is like a bird.\" It just calls hope \"the thing with feathers\" and keeps the picture going to the last line. A comparison that runs through a whole poem is an extended metaphor.",
    words: [{ word: "perches", meaning: "sits, the way a bird sits on a branch" }, { word: "gale", meaning: "a very strong wind" }, { word: "abash", meaning: "to make someone feel small or ashamed" }, { word: "extremity", meaning: "the hardest, most difficult time" }],
    think: ["When does the bird's song sound sweetest? What does that tell you about hope?", "What does hope ask for in return?"],
  },
  {
    slug: "im-nobody", title: "I'm Nobody! Who Are You?", poet: "Emily Dickinson", year: 1891, band: "3-5", hook: "A secret between two nobodies.",
    stanzas: lines(`
I'm nobody! Who are you?
Are you nobody, too?
Then there's a pair of us—don't tell!
They'd banish us, you know.

How dreary to be somebody!
How public, like a frog
To tell your name the livelong day
To an admiring bog!`),
    about: "Emily Dickinson stayed out of the public eye her whole life. In this poem she sounds glad about it, and she invites the reader to be in on the secret.",
    notice: "The speaker talks straight to you, the reader, and even whispers \"don't tell!\" Notice how the exclamation marks change the way you read each line.",
    words: [{ word: "banish", meaning: "to send someone away" }, { word: "dreary", meaning: "dull and gloomy" }, { word: "livelong", meaning: "whole, entire" }, { word: "bog", meaning: "a wet, muddy place where frogs live" }],
    think: ["Why does the speaker compare a \"somebody\" to a frog?", "Would you rather be a nobody or a somebody? Why?"],
  },
  {
    slug: "there-is-no-frigate-like-a-book", title: "There Is No Frigate Like a Book", poet: "Emily Dickinson", year: 1894, band: "3-5", hook: "A book can take you farther than any ship.",
    stanzas: lines(`
There is no frigate like a book
To take us lands away,
Nor any coursers like a page
Of prancing poetry.
This traverse may the poorest take
Without oppress of toll;
How frugal is the chariot
That bears a human soul!`),
    about: "Emily Dickinson rarely left her home town, but she read all the time. She first shared this poem in a letter.",
    notice: "Count the ways to travel: a ship, horses, a chariot. Each one is a metaphor for reading.",
    words: [{ word: "frigate", meaning: "a fast sailing ship" }, { word: "coursers", meaning: "swift horses" }, { word: "traverse", meaning: "a journey across" }, { word: "toll", meaning: "money you pay to use a road" }, { word: "frugal", meaning: "costing very little" }, { word: "chariot", meaning: "a cart pulled by horses" }],
    think: ["What can a book do that a ship cannot?", "Where is the farthest place a book has taken you?"],
  },
  {
    slug: "jabberwocky", title: "Jabberwocky", poet: "Lewis Carroll", year: 1871, band: "3-5", hook: "A hero, a monster, and a lot of made-up words.",
    stanzas: lines(`
'Twas brillig, and the slithy toves
      Did gyre and gimble in the wabe:
All mimsy were the borogoves,
      And the mome raths outgrabe.

"Beware the Jabberwock, my son!
      The jaws that bite, the claws that catch!
Beware the Jubjub bird, and shun
      The frumious Bandersnatch!"

He took his vorpal sword in hand;
      Long time the manxome foe he sought—
So rested he by the Tumtum tree
      And stood awhile in thought.

And, as in uffish thought he stood,
      The Jabberwock, with eyes of flame,
Came whiffling through the tulgey wood,
      And burbled as it came!

One, two! One, two! And through and through
      The vorpal blade went snicker-snack!
He left it dead, and with its head
      He went galumphing back.

"And hast thou slain the Jabberwock?
      Come to my arms, my beamish boy!
O frabjous day! Callooh! Callay!"
      He chortled in his joy.

'Twas brillig, and the slithy toves
      Did gyre and gimble in the wabe:
All mimsy were the borogoves,
      And the mome raths outgrabe.`),
    about: "Lewis Carroll wrote Alice's Adventures in Wonderland. This poem comes from the second Alice book, Through the Looking-Glass, where Alice finds it written backwards in a mirror-book.",
    notice: "Most of the strange words are invented, yet you can still follow the story. Two of Carroll's inventions, \"chortle\" and \"galumph\", became real English words.",
    words: [{ word: "'twas", meaning: "it was" }, { word: "shun", meaning: "to stay away from" }, { word: "foe", meaning: "an enemy" }, { word: "sought", meaning: "looked for" }, { word: "hast thou slain", meaning: "an old way to say \"have you killed\"" }],
    think: ["Tell the story of the poem in three sentences, using only real words.", "Pick one made-up word. What do you think it means, and what gave you the clue?"],
  },
  {
    slug: "the-eagle", title: "The Eagle", poet: "Alfred, Lord Tennyson", year: 1851, band: "3-5", hook: "Six lines, one eagle, one sudden dive.",
    stanzas: lines(`
He clasps the crag with crooked hands;
Close to the sun in lonely lands,
Ring'd with the azure world, he stands.

The wrinkled sea beneath him crawls;
He watches from his mountain walls,
And like a thunderbolt he falls.`),
    about: "Alfred Tennyson was the most famous poet in England in the 1800s. He called this short poem a \"fragment\", a small piece.",
    notice: "Listen to the hard c sounds in the first line: clasps, crag, crooked. Repeating the same starting sound is called alliteration.",
    words: [{ word: "clasps", meaning: "holds tightly" }, { word: "crag", meaning: "a steep, rough rock" }, { word: "ring'd", meaning: "ringed, with something all around" }, { word: "azure", meaning: "bright blue" }, { word: "thunderbolt", meaning: "a flash of lightning with thunder" }],
    think: ["Why does the sea look \"wrinkled\" and seem to \"crawl\" from where the eagle sits?", "The poem is still for five lines. What happens in the last one?"],
  },
  {
    slug: "dreams", title: "Dreams", poet: "Langston Hughes", year: 1923, band: "3-5", hook: "What life is like without dreams.",
    stanzas: lines(`
Hold fast to dreams
For if dreams die
Life is a broken-winged bird
That cannot fly.

Hold fast to dreams
For when dreams go
Life is a barren field
Frozen with snow.`),
    about: "Langston Hughes was a leading writer of the Harlem Renaissance, a time in the 1920s when Black artists, writers and musicians in New York City made work that changed American culture. He published this poem as a young man, near the start of his career.",
    notice: "Each stanza gives the same advice and then one picture of a life without dreams. Compare the two pictures. How are they alike?",
    words: [{ word: "hold fast", meaning: "hold on tightly" }, { word: "barren", meaning: "empty, with nothing growing" }],
    think: ["What two things does the poet compare a life without dreams to?", "What is a dream you want to hold fast to?"],
  },
  {
    slug: "stopping-by-woods-on-a-snowy-evening", title: "Stopping by Woods on a Snowy Evening", poet: "Robert Frost", year: 1923, band: "3-5", hook: "A quiet stop on a dark, snowy road.",
    stanzas: lines(`
Whose woods these are I think I know.
His house is in the village though;
He will not see me stopping here
To watch his woods fill up with snow.

My little horse must think it queer
To stop without a farmhouse near
Between the woods and frozen lake
The darkest evening of the year.

He gives his harness bells a shake
To ask if there is some mistake.
The only other sound's the sweep
Of easy wind and downy flake.

The woods are lovely, dark and deep,
But I have promises to keep,
And miles to go before I sleep,
And miles to go before I sleep.`),
    about: "Robert Frost said he wrote this poem in one sitting, early one morning, after staying up all night working on a different poem. It became one of the best-loved poems in America.",
    notice: "Look at the end words. In each stanza three lines rhyme, and the one that doesn't sets up the rhyme for the next stanza. In the last stanza, all four lines rhyme.",
    words: [{ word: "queer", meaning: "strange, odd" }, { word: "harness", meaning: "the straps a horse wears to pull a wagon or sleigh" }, { word: "downy", meaning: "soft, like tiny feathers" }],
    think: ["Why does the traveler stop? Why does he go on?", "Why do you think the poet says the last line twice?"],
  },
  {
    slug: "the-arrow-and-the-song", title: "The Arrow and the Song", poet: "Henry Wadsworth Longfellow", year: 1845, band: "3-5", hook: "An arrow and a song, both found again years later.",
    stanzas: lines(`
I shot an arrow into the air,
It fell to earth, I knew not where;
For, so swiftly it flew, the sight
Could not follow it in its flight.

I breathed a song into the air,
It fell to earth, I knew not where;
For who has sight so keen and strong,
That it can follow the flight of song?

Long, long afterward, in an oak
I found the arrow, still unbroke;
And the song, from beginning to end,
I found again in the heart of a friend.`),
    about: "Henry Wadsworth Longfellow was the most widely read American poet of the 1800s. Children across the country learned his poems by heart.",
    notice: "The first two stanzas are built the same way, almost word for word. Putting two things side by side like this helps you compare them.",
    words: [{ word: "swiftly", meaning: "very fast" }, { word: "keen", meaning: "sharp" }, { word: "unbroke", meaning: "not broken" }],
    think: ["How is a song like an arrow in this poem?", "What do you think the poem says about the things we say to our friends?"],
  },

  // ─── 6-8 ───────────────────────────────────────────────────────────────────
  {
    slug: "the-road-not-taken", title: "The Road Not Taken", poet: "Robert Frost", year: 1915, band: "6-8", hook: "Two roads in a wood, and a choice to explain later.",
    stanzas: lines(`
Two roads diverged in a yellow wood,
And sorry I could not travel both
And be one traveler, long I stood
And looked down one as far as I could
To where it bent in the undergrowth;

Then took the other, as just as fair,
And having perhaps the better claim,
Because it was grassy and wanted wear;
Though as for that the passing there
Had worn them really about the same,

And both that morning equally lay
In leaves no step had trodden black.
Oh, I kept the first for another day!
Yet knowing how way leads on to way,
I doubted if I should ever come back.

I shall be telling this with a sigh
Somewhere ages and ages hence:
Two roads diverged in a wood, and I—
I took the one less traveled by,
And that has made all the difference.`),
    about: "This may be the most quoted American poem, and one of the most argued about. Frost said he wrote it partly to tease a friend who always wished, after a walk, that they had taken the other path.",
    notice: "Read the second and third stanzas closely. How different are the two roads, really? Then read the last stanza again and ask whether the speaker is telling the plain truth.",
    words: [{ word: "diverged", meaning: "split and went in different directions" }, { word: "undergrowth", meaning: "bushes and small plants under the trees" }, { word: "wanted wear", meaning: "had not been walked on much" }, { word: "trodden", meaning: "stepped on" }, { word: "hence", meaning: "from now" }],
    think: ["What evidence in the poem shows the two roads were almost the same?", "The speaker says he will tell this story \"with a sigh.\" What kind of sigh do you think it is?"],
  },
  {
    slug: "nothing-gold-can-stay", title: "Nothing Gold Can Stay", poet: "Robert Frost", year: 1923, band: "6-8", hook: "Eight lines on how the best moments pass.",
    stanzas: lines(`
Nature's first green is gold,
Her hardest hue to hold.
Her early leaf's a flower;
But only so an hour.
Then leaf subsides to leaf.
So Eden sank to grief,
So dawn goes down to day.
Nothing gold can stay.`),
    about: "In early spring, new leaves on some trees look golden for a few days before they turn green. Frost starts with that small fact and widens it, line by line.",
    notice: "The poem is only forty words long and rhymes in couplets. Notice how each pair of lines moves from something new and bright to something ordinary.",
    words: [{ word: "hue", meaning: "a color" }, { word: "subsides", meaning: "sinks down, settles" }, { word: "Eden", meaning: "in the Bible, the perfect garden where the first people lived" }],
    think: ["What does \"gold\" stand for in this poem?", "Is the poem only sad, or does it also say something about why early moments matter?"],
  },
  {
    slug: "fire-and-ice", title: "Fire and Ice", poet: "Robert Frost", year: 1923, band: "6-8", hook: "Two ways the world could end, and what they stand for.",
    stanzas: lines(`
Some say the world will end in fire,
Some say in ice.
From what I've tasted of desire
I hold with those who favor fire.
But if it had to perish twice,
I think I know enough of hate
To say that for destruction ice
Is also great
And would suffice.`),
    about: "Scientists in Frost's time were debating how the world might one day end. Frost turns that question into one about people. The poem first ran in a magazine in 1920. This is the wording from his 1923 book.",
    notice: "Fire and ice are symbols here. The poem tells you what each one stands for. The calm, almost casual voice makes the idea land harder.",
    words: [{ word: "desire", meaning: "wanting something very strongly" }, { word: "perish", meaning: "to die, to be destroyed" }, { word: "suffice", meaning: "to be enough" }],
    think: ["Which feeling does fire stand for? Which does ice stand for?", "Why might a poet use understatement, like \"would suffice\", for such a big subject?"],
  },
  {
    slug: "mother-to-son", title: "Mother to Son", poet: "Langston Hughes", year: 1922, band: "6-8", hook: "A mother's advice about a hard climb.",
    stanzas: lines(`
Well, son, I'll tell you:
Life for me ain't been no crystal stair.
It's had tacks in it,
And splinters,
And boards torn up,
And places with no carpet on the floor—
Bare.
But all the time
I'se been a-climbin' on,
And reachin' landin's,
And turnin' corners,
And sometimes goin' in the dark
Where there ain't been no light.
So boy, don't you turn back.
Don't you set down on the steps
'Cause you finds it's kinder hard.
Don't you fall now—
For I'se still goin', honey,
I'se still climbin',
And life for me ain't been no crystal stair.`),
    about: "Langston Hughes wrote this poem when he was about twenty. He wanted his poems to sound like real people talking, so the mother speaks in her own everyday voice.",
    notice: "The whole poem is one extended metaphor: life is a staircase. Look at the line with a single word. Why give \"Bare\" a line to itself?",
    words: [{ word: "crystal stair", meaning: "a staircase made of sparkling glass: something easy and beautiful" }, { word: "landin's", meaning: "landings, the flat places between sets of stairs" }, { word: "kinder", meaning: "kind of" }],
    think: ["What do the tacks, splinters and dark places stand for?", "What does the mother want her son to do, and how does her own life back up the advice?"],
  },
  {
    slug: "sympathy", title: "Sympathy", poet: "Paul Laurence Dunbar", year: 1899, band: "6-8", hook: "\"I know why the caged bird sings.\"",
    stanzas: lines(`
I know what the caged bird feels, alas!
    When the sun is bright on the upland slopes;
When the wind stirs soft through the springing grass,
And the river flows like a stream of glass;
    When the first bird sings and the first bud opes,
And the faint perfume from its chalice steals—
I know what the caged bird feels!

I know why the caged bird beats his wing
    Till its blood is red on the cruel bars;
For he must fly back to his perch and cling
When he fain would be on the bough a-swing;
    And a pain still throbs in the old, old scars
And they pulse again with a keener sting—
I know why he beats his wing!

I know why the caged bird sings, ah me,
    When his wing is bruised and his bosom sore,—
When he beats his bars and he would be free;
It is not a carol of joy or glee,
    But a prayer that he sends from his heart's deep core,
But a plea, that upward to Heaven he flings—
I know why the caged bird sings!`),
    about: "Paul Laurence Dunbar was one of the first Black American poets to be read across the country. His parents had been enslaved. Decades later, Maya Angelou took the title of her most famous book from this poem's last line.",
    notice: "Each stanza opens and closes with nearly the same line, like the bars of a cage around it. Track the three verbs: feels, beats, sings.",
    words: [{ word: "alas", meaning: "a word that shows sadness" }, { word: "opes", meaning: "opens" }, { word: "chalice", meaning: "a cup. Here, the cup shape of a flower" }, { word: "fain would", meaning: "would gladly, would much rather" }, { word: "bough", meaning: "a large branch" }, { word: "carol", meaning: "a happy song" }, { word: "plea", meaning: "a strong, serious request" }],
    think: ["According to the last stanza, why does the caged bird sing?", "What might the cage stand for? Use the poem and what you know about the poet's life."],
  },
  {
    slug: "invictus", title: "Invictus", poet: "William Ernest Henley", year: 1888, band: "6-8", hook: "\"I am the master of my fate.\"",
    stanzas: lines(`
Out of the night that covers me,
      Black as the pit from pole to pole,
I thank whatever gods may be
      For my unconquerable soul.

In the fell clutch of circumstance
      I have not winced nor cried aloud.
Under the bludgeonings of chance
      My head is bloody, but unbowed.

Beyond this place of wrath and tears
      Looms but the Horror of the shade,
And yet the menace of the years
      Finds and shall find me unafraid.

It matters not how strait the gate,
      How charged with punishments the scroll,
I am the master of my fate:
      I am the captain of my soul.`),
    about: "William Ernest Henley was seriously ill from childhood and lost a leg to disease as a young man. He wrote this poem in a hospital bed in his twenties, during a long treatment to save his other leg. The title is Latin for \"unconquered.\"",
    notice: "The poem is built on contrast. In each stanza, the first lines describe something crushing and the last lines answer it.",
    words: [{ word: "fell", meaning: "cruel, deadly" }, { word: "circumstance", meaning: "the things that happen to you that you can't control" }, { word: "winced", meaning: "flinched from pain" }, { word: "bludgeonings", meaning: "heavy blows, as if from a club" }, { word: "unbowed", meaning: "not bent, still held high" }, { word: "wrath", meaning: "great anger" }, { word: "menace", meaning: "a threat" }, { word: "strait", meaning: "narrow, hard to pass through" }],
    think: ["What can the speaker control, and what can't he?", "How does knowing where Henley wrote this poem change the way you read it?"],
  },
  {
    slug: "if", title: "If—", poet: "Rudyard Kipling", year: 1910, band: "6-8", hook: "A long list of what it takes to grow up well.",
    stanzas: lines(`
If you can keep your head when all about you
    Are losing theirs and blaming it on you,
If you can trust yourself when all men doubt you,
    But make allowance for their doubting too;
If you can wait and not be tired by waiting,
    Or being lied about, don't deal in lies,
Or being hated, don't give way to hating,
    And yet don't look too good, nor talk too wise:

If you can dream—and not make dreams your master;
    If you can think—and not make thoughts your aim;
If you can meet with Triumph and Disaster
    And treat those two impostors just the same;
If you can bear to hear the truth you've spoken
    Twisted by knaves to make a trap for fools,
Or watch the things you gave your life to, broken,
    And stoop and build 'em up with worn-out tools:

If you can make one heap of all your winnings
    And risk it on one turn of pitch-and-toss,
And lose, and start again at your beginnings
    And never breathe a word about your loss;
If you can force your heart and nerve and sinew
    To serve your turn long after they are gone,
And so hold on when there is nothing in you
    Except the Will which says to them: 'Hold on!'

If you can talk with crowds and keep your virtue,
    Or walk with Kings—nor lose the common touch,
If neither foes nor loving friends can hurt you,
    If all men count with you, but none too much;
If you can fill the unforgiving minute
    With sixty seconds' worth of distance run,
Yours is the Earth and everything that's in it,
    And—which is more—you'll be a Man, my son!`),
    about: "Rudyard Kipling, who also wrote The Jungle Book, wrote this poem as advice from a father to a son. In its own time, \"be a Man\" meant \"be a grown-up of good character.\" Readers today take the advice as meant for anyone.",
    notice: "The entire poem is one sentence. Every \"if\" piles on another condition, and the answer does not arrive until the last two lines.",
    words: [{ word: "make allowance for", meaning: "to understand and forgive" }, { word: "impostors", meaning: "fakes, things that pretend to be what they are not" }, { word: "knaves", meaning: "dishonest people" }, { word: "pitch-and-toss", meaning: "a gambling game played with coins" }, { word: "sinew", meaning: "the tough cords that join muscle to bone. Here, strength" }, { word: "virtue", meaning: "goodness" }, { word: "the common touch", meaning: "being able to get along with ordinary people" }],
    think: ["Why does Kipling call both Triumph and Disaster \"impostors\"?", "Which piece of advice in the poem is hardest to follow? Which matters most to you?"],
  },
  {
    slug: "o-captain-my-captain", title: "O Captain! My Captain!", poet: "Walt Whitman", year: 1865, band: "6-8", hook: "A ship comes home safe, but its captain does not.",
    stanzas: lines(`
O Captain! my Captain! our fearful trip is done,
The ship has weather'd every rack, the prize we sought is won,
The port is near, the bells I hear, the people all exulting,
While follow eyes the steady keel, the vessel grim and daring;
        But O heart! heart! heart!
           O the bleeding drops of red,
              Where on the deck my Captain lies,
                 Fallen cold and dead.

O Captain! my Captain! rise up and hear the bells;
Rise up—for you the flag is flung—for you the bugle trills,
For you bouquets and ribbon'd wreaths—for you the shores a-crowding,
For you they call, the swaying mass, their eager faces turning;
        Here Captain! dear father!
           This arm beneath your head!
              It is some dream that on the deck,
                You've fallen cold and dead.

My Captain does not answer, his lips are pale and still,
My father does not feel my arm, he has no pulse nor will,
The ship is anchor'd safe and sound, its voyage closed and done,
From fearful trip the victor ship comes in with object won;
        Exult O shores, and ring O bells!
           But I with mournful tread,
              Walk the deck my Captain lies,
                 Fallen cold and dead.`),
    about: "Walt Whitman wrote this poem in 1865, after President Abraham Lincoln was killed just days after the Civil War ended. The captain is Lincoln, the ship is the United States, and the \"fearful trip\" is the war.",
    notice: "Every stanza has two moods. The long lines celebrate with the crowd on shore, and the short, stepped lines grieve on the deck. A poem of mourning like this is called an elegy.",
    words: [{ word: "weather'd every rack", meaning: "come through every storm" }, { word: "exulting", meaning: "celebrating with great joy" }, { word: "keel", meaning: "the bottom of a ship" }, { word: "bugle", meaning: "a small horn, like a trumpet" }, { word: "mournful tread", meaning: "sad, slow steps" }],
    think: ["What is the crowd on shore feeling? What is the speaker feeling? Why are they different?", "Why might Whitman have told this as a story about a ship instead of naming Lincoln?"],
  },
  {
    slug: "the-new-colossus", title: "The New Colossus", poet: "Emma Lazarus", year: 1883, band: "6-8", hook: "The poem on the Statue of Liberty.",
    stanzas: lines(`
Not like the brazen giant of Greek fame,
With conquering limbs astride from land to land;
Here at our sea-washed, sunset gates shall stand
A mighty woman with a torch, whose flame
Is the imprisoned lightning, and her name
Mother of Exiles. From her beacon-hand
Glows world-wide welcome; her mild eyes command
The air-bridged harbor that twin cities frame.
"Keep, ancient lands, your storied pomp!" cries she
With silent lips. "Give me your tired, your poor,
Your huddled masses yearning to breathe free,
The wretched refuse of your teeming shore.
Send these, the homeless, tempest-tost to me,
I lift my lamp beside the golden door!"`),
    about: "Emma Lazarus wrote this poem to help raise money for the base of the Statue of Liberty. She had been helping refugees who arrived in New York with nothing. In 1903 the poem was put on a bronze plaque inside the statue's base.",
    notice: "This is a sonnet: fourteen lines with a set pattern of rhymes. The first eight lines describe the statue. In the last six, the statue speaks.",
    words: [{ word: "Colossus", meaning: "a giant statue. The old one stood in ancient Greece" }, { word: "brazen", meaning: "made of brass. Also bold and showy" }, { word: "exiles", meaning: "people forced to leave their home country" }, { word: "beacon", meaning: "a light that guides or welcomes" }, { word: "pomp", meaning: "grand, showy display" }, { word: "yearning", meaning: "wanting something very deeply" }, { word: "teeming", meaning: "crowded, full of people" }, { word: "tempest-tost", meaning: "thrown about by storms" }],
    think: ["How is the new statue different from the old \"brazen giant\"?", "The statue's lips are \"silent,\" yet she \"cries\" out. What do you make of that?"],
  },
  {
    slug: "ozymandias", title: "Ozymandias", poet: "Percy Bysshe Shelley", year: 1818, band: "6-8", hook: "A broken statue of a king who thought he'd last forever.",
    stanzas: lines(`
I met a traveller from an antique land,
Who said—"Two vast and trunkless legs of stone
Stand in the desert. . . . Near them, on the sand,
Half sunk a shattered visage lies, whose frown,
And wrinkled lip, and sneer of cold command,
Tell that its sculptor well those passions read
Which yet survive, stamped on these lifeless things,
The hand that mocked them, and the heart that fed;
And on the pedestal these words appear:
'My name is Ozymandias, king of kings:
Look on my works, ye Mighty, and despair!'
Nothing beside remains. Round the decay
Of that colossal wreck, boundless and bare
The lone and level sands stretch far away."`),
    about: "Ozymandias is a Greek name for Ramesses II, a pharaoh who ruled Egypt more than 3,000 years ago. Shelley wrote the poem in a friendly contest with another poet, when a piece of a huge statue of the pharaoh was on its way to a London museum.",
    notice: "The king's words say one thing and the scene around them says the opposite. When what is said and what is true pull apart like this, it is called irony.",
    words: [{ word: "antique", meaning: "very old, ancient" }, { word: "trunkless", meaning: "without a body" }, { word: "visage", meaning: "a face" }, { word: "pedestal", meaning: "the base a statue stands on" }, { word: "despair", meaning: "to lose all hope" }, { word: "colossal", meaning: "enormous" }, { word: "boundless", meaning: "without end" }],
    think: ["What did the king want people to feel when they read his words? What do they feel now?", "What lasts longer in this poem: the king's power, or the sculptor's art?"],
  },
  {
    slug: "the-tyger", title: "The Tyger", poet: "William Blake", year: 1794, band: "6-8", hook: "Who could have made a creature so fierce?",
    stanzas: lines(`
Tyger Tyger, burning bright,
In the forests of the night;
What immortal hand or eye,
Could frame thy fearful symmetry?

In what distant deeps or skies.
Burnt the fire of thine eyes?
On what wings dare he aspire?
What the hand, dare seize the fire?

And what shoulder, and what art,
Could twist the sinews of thy heart?
And when thy heart began to beat,
What dread hand? and what dread feet?

What the hammer? what the chain,
In what furnace was thy brain?
What the anvil? what dread grasp,
Dare its deadly terrors clasp!

When the stars threw down their spears
And water'd heaven with their tears:
Did he smile his work to see?
Did he who made the Lamb make thee?

Tyger Tyger burning bright,
In the forests of the night:
What immortal hand or eye,
Dare frame thy fearful symmetry?`),
    about: "William Blake was a poet and artist in London who printed his own books by hand, with his own pictures. This poem has a partner, \"The Lamb,\" about a gentle creature. Blake spelled the animal's name his own way.",
    notice: "The poem is made almost entirely of questions, and none of them is answered. Compare the first stanza with the last. One word has changed.",
    words: [{ word: "immortal", meaning: "living forever" }, { word: "symmetry", meaning: "balance. Both sides matching" }, { word: "aspire", meaning: "to rise or reach high" }, { word: "sinews", meaning: "the tough cords that join muscle to bone" }, { word: "anvil", meaning: "the heavy iron block a blacksmith hammers metal on" }, { word: "thy / thine / thee", meaning: "old words for \"your\" and \"you\"" }],
    think: ["The maker in this poem works like a blacksmith. Which words tell you so?", "Why do you think Blake changed \"Could\" to \"Dare\" in the last stanza?"],
  },
  {
    slug: "i-wandered-lonely-as-a-cloud", title: "I Wandered Lonely as a Cloud", poet: "William Wordsworth", year: 1807, band: "6-8", hook: "A field of daffodils, remembered for years.",
    stanzas: lines(`
I wandered lonely as a cloud
That floats on high o'er vales and hills,
When all at once I saw a crowd,
A host, of golden daffodils;
Beside the lake, beneath the trees,
Fluttering and dancing in the breeze.

Continuous as the stars that shine
And twinkle on the milky way,
They stretched in never-ending line
Along the margin of a bay:
Ten thousand saw I at a glance,
Tossing their heads in sprightly dance.

The waves beside them danced; but they
Out-did the sparkling waves in glee:
A poet could not but be gay,
In such a jocund company:
I gazed—and gazed—but little thought
What wealth the show to me had brought:

For oft, when on my couch I lie
In vacant or in pensive mood,
They flash upon that inward eye
Which is the bliss of solitude;
And then my heart with pleasure fills,
And dances with the daffodils.`),
    about: "William Wordsworth lived in the Lake District of England and walked for miles almost every day. He and his sister Dorothy came upon these daffodils on a walk in 1802. She described them in her journal, and he wrote the poem two years later. The wording here is from his own revised version of 1815.",
    notice: "The first line is a simile, a comparison using \"as\" or \"like.\" Watch the word \"dance.\" It appears in every stanza, and the dancer changes each time.",
    words: [{ word: "o'er", meaning: "over" }, { word: "vales", meaning: "valleys" }, { word: "host", meaning: "a very large number" }, { word: "sprightly", meaning: "lively, full of energy" }, { word: "jocund", meaning: "cheerful" }, { word: "pensive", meaning: "thinking quietly and deeply" }, { word: "inward eye", meaning: "the imagination, or memory" }, { word: "solitude", meaning: "being alone" }],
    think: ["What is the \"wealth\" the daffodils brought the poet?", "The last stanza happens long after the walk. What does it say about memory?"],
  },
  {
    slug: "sea-fever", title: "Sea Fever", poet: "John Masefield", year: 1902, band: "6-8", hook: "A sailor who can't stay away from the sea.",
    stanzas: lines(`
I must go down to the seas again, to the lonely sea and the sky,
And all I ask is a tall ship and a star to steer her by;
And the wheel's kick and the wind's song and the white sail's shaking,
And a grey mist on the sea's face, and a grey dawn breaking.

I must go down to the seas again, for the call of the running tide
Is a wild call and a clear call that may not be denied;
And all I ask is a windy day with the white clouds flying,
And the flung spray and the blown spume, and the sea-gulls crying.

I must go down to the seas again, to the vagrant gypsy life,
To the gull's way and the whale's way where the wind's like a whetted knife;
And all I ask is a merry yarn from a laughing fellow-rover,
And quiet sleep and a sweet dream when the long trick's over.`),
    about: "John Masefield went to sea as a teenager to train as a ship's officer and later became Poet Laureate of the United Kingdom. The very first printing left the word \"go\" out of the opening line. Later printings, like this one, have it.",
    notice: "Read it aloud and feel the lines roll, long and rocking like a ship. Listen for repeated sounds too: \"the wheel's kick and the wind's song and the white sail's shaking.\"",
    words: [{ word: "spume", meaning: "foam on the waves" }, { word: "vagrant", meaning: "wandering, with no fixed home" }, { word: "whetted", meaning: "sharpened" }, { word: "yarn", meaning: "a long story" }, { word: "fellow-rover", meaning: "another traveler" }, { word: "trick", meaning: "a sailor's turn on duty at the wheel" }],
    think: ["What does the speaker ask for in each stanza?", "\"The long trick\" could mean more than a turn at the wheel. What else might it mean?"],
  },
  {
    slug: "the-red-wheelbarrow", title: "The Red Wheelbarrow", poet: "William Carlos Williams", year: 1923, band: "6-8", hook: "Sixteen words. So much depends on them.",
    stanzas: lines(`
so much depends
upon

a red wheel
barrow

glazed with rain
water

beside the white
chickens`),
    about: "William Carlos Williams was a doctor in New Jersey who wrote poems between patients, sometimes on prescription pads. He believed a poem could be made from the most ordinary things.",
    notice: "The poem is one sentence, broken so each stanza looks a little like a wheelbarrow: a long line resting on one short word. Even \"wheelbarrow\" is split in two.",
    words: [{ word: "glazed", meaning: "covered with something shiny and smooth" }],
    think: ["What do you think depends on the wheelbarrow?", "Why break the lines this way? Read it as a plain sentence, then as the poem. What changes?"],
  },
];

export const POEM_BANDS: { band: PoemBand; label: string }[] = [
  { band: "K-2", label: "First poems" },
  { band: "3-5", label: "Grades 3 to 5" },
  { band: "6-8", label: "Grades 6 to 8" },
];

export const poemBySlug = (slug: string | undefined) => POEMS.find((p) => p.slug === slug) ?? null;
export const poemLineCount = (p: Poem) => p.stanzas.reduce((n, s) => n + s.length, 0);
/** Poems are read slowly: about half a minute for every eight lines, and never less than a minute. */
export const poemMinutes = (p: Poem) => Math.max(1, Math.round(poemLineCount(p) / 16));
