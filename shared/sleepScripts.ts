// Arise LifeHub · Sleep: the words the Sleep app reads aloud. Sleep stories, guided body
// relaxations, prayers, "boring on purpose" readings, and King James Version passages (public
// domain) for falling asleep to.
//
// A script is a list of lines. A string is said aloud (the narrator splits it into sentences and
// leaves a short, calm pause after each); a number is that many seconds of quiet. Everything here
// is written to be heard with the eyes closed: short sentences, nothing that startles, and an
// ending that lets the listener stop listening.

/** Words to say, or seconds of quiet. */
export type ScriptLine = string | number;

export type ScriptKind = "story" | "body" | "mind" | "prayer" | "boring";

export type SleepScript = {
  id: string;
  title: string;
  kind: ScriptKind;
  /** One plain line on what it is. */
  blurb: string;
  /** Christian content: shown only when the faith option is on. */
  faith?: boolean;
  /** For a Bible-based story: the passage it retells. */
  ref?: string;
  lines: ScriptLine[];
};

// ── Sleep stories ────────────────────────────────────────────────────────────

const STORIES: SleepScript[] = [
  {
    id: "night-train", kind: "story", title: "The night train", blurb: "A warm sleeper compartment, rocking gently through the countryside until morning.",
    lines: [
      "Tonight you are traveling by night train, in a small compartment of your own. Your ticket has already been checked. There is nothing you need to do until morning.", 3,
      "The compartment is narrow and warm, paneled in dark wood that has been polished by many careful hands. A little lamp glows above the bed, the color of honey. The sheets are cool and crisp, and a thick wool blanket is folded twice at the foot of the bunk.", 3,
      "Outside, the platform lights slide slowly backward, one, and then another, and then the station is gone. The train settles into its rhythm. Every few seconds the wheels find a joint in the rails, and there is a soft double knock, steady as a heartbeat.", 4,
      "You change into something soft and climb under the blanket. The pillow is deeper than you expected. Your head sinks into it, and the whole carriage sways, very gently, side to side, like a cradle someone is rocking without thinking about it.", 4,
      "Through the gap in the curtain, the countryside goes by in shades of blue. A field. A line of trees, dark against the sky. A farmhouse with one window still lit, and then it's gone. A river, holding a little of the moon, and then that's gone too.", 4,
      "Somewhere down the corridor, the conductor walks past, his footsteps soft on the carpet. He doesn't stop at your door. Everything is taken care of. The route is laid down in steel, mile after mile, all the way to morning. The train knows where it's going. You don't have to.", 5,
      "The heater ticks quietly under the window. The water glass on the little shelf trembles with each knock of the wheels, and the lamplight inside it trembles too.", 4,
      "The train slows for a small station. A door opens somewhere. There are a few voices, too far away to understand, and the door closes. A whistle, low and long. Then the gentle pull as the train leans forward again and finds its rhythm.", 5,
      "The towns are further apart now. The night is wide and dark and quiet, and the train moves through it like a warm, lit thread. Your hands are heavy on the blanket. Your feet are warm. The sway of the carriage rocks you a little deeper with each mile.", 5,
      "There will be breakfast in the morning, and a new place, and light coming in around the edges of the curtain. But that's hours away. For now there is only the dark, and the warm compartment, and the soft knock of the wheels, carrying you on through the night.", 6,
      "You can let the train carry you now.", 4, "All the way to morning.", 10,
    ],
  },
  {
    id: "bookshop-rain", kind: "story", title: "Rain at the bookshop", blurb: "Closing up a small bookshop on a rainy evening, with tea and a sleeping cat.",
    lines: [
      "It has been raining since the afternoon, a soft, steady rain that doesn't seem to be in any hurry. In the little bookshop on the corner, the last customer has gone, and Ada turns the sign on the door from Open to Closed.", 3,
      "She leaves the lamps on for now. She likes the shop best like this, with the street dark and wet outside and the windows full of reflected light. The rain runs down the glass in thin, wandering lines.", 4,
      "In the back room the kettle begins to whisper, and then to sing. She makes a pot of tea, the kind with a little vanilla in it, and carries a cup to the front desk, where the shop cat, a large gray one called Biscuit, is already asleep on a stack of newspapers. He opens one eye, decides nothing interesting is happening, and closes it again.", 4,
      "There are books to put away. There always are. Ada wheels the small wooden cart slowly between the shelves. A book of garden poems goes back to its place on the third shelf, between two thin volumes with faded green spines. A cookbook goes to the cookery section, where the shelves smell faintly of paper and dust and, somehow, cinnamon. A road atlas, a little worn at the corners. A children's book about a bear who couldn't fall asleep.", 5,
      "She straightens each row as she passes, squaring the spines with one fingertip, so they stand neatly, shoulder to shoulder, like people waiting quietly for a bus.", 4,
      "The rain grows a little heavier, drumming softly on the awning above the door, and then eases again. A car passes on the wet street, its tires hushing, and the light from its headlamps slides across the ceiling and is gone.", 5,
      "Ada sits down in the old armchair by the window, the one with the soft patched cushion, and pulls a knitted blanket over her knees. Her tea is still warm. She doesn't open a book. She just sits and listens to the rain, and lets the day settle, the way snow settles in a glass globe once you stop shaking it.", 5,
      "The radiator knocks once, and hums. Biscuit stretches one paw out and tucks it back under his chin.", 4,
      "The shop is full of stories, thousands of them, each one closed and quiet on its shelf, waiting patiently for morning. None of them needs anything from her tonight.", 5,
      "Her eyes are heavy now. The rain is so steady and so gentle that it's hard to tell where its sound ends and the quiet begins.", 5,
      "She lets her head rest against the wing of the chair. Just for a moment. The lamps glow. The rain falls. And the little bookshop on the corner keeps everything safe and dry, all through the long, soft night.", 10,
    ],
  },
  {
    id: "lighthouse", kind: "story", title: "The lighthouse keeper", blurb: "An old lighthouse at dusk: the climb, the lamp, the logbook, and the sea outside.",
    lines: [
      "On a small rocky island, at the end of a long and ordinary day, the lighthouse keeper begins his evening round.", 3,
      "The wind has dropped. The sea is calm, and the sky over the water is fading from gold to violet. Gulls settle on the rocks below, tucking their heads under their wings.", 4,
      "He opens the heavy door at the foot of the tower and begins to climb. The stairs turn round and round, and he counts them as he always does, not because he needs to, but because it's part of the evening. One, two, three. His hand slides along the cool iron rail. Twenty. Twenty one. Forty. His breathing slows to match his steps. Sixty. Eighty. A hundred and eight.", 5,
      "At the top is the lamp room, all glass, with the whole sky around it. He takes a soft cloth from his pocket and polishes the great lens, slowly, one curved panel at a time, until it's clear as water.", 4,
      "Then he lights the lamp. The flame catches, steadies, and grows, and the lens gathers its light into one long, calm beam that reaches out across the water. Slowly, slowly, the beam begins to turn.", 5,
      "Out on the sea, a small fishing boat heading home sees the light and knows exactly where it is. Further out, a cargo ship, lit up like a little town, adjusts its course by a degree and carries on.", 5,
      "The keeper sits at the small desk by the window and opens the logbook. He writes in neat, unhurried letters. Wind, light, from the southwest. Sea, calm. Visibility, good. Lamp lit at dusk. All well.", 5,
      "All well.", 4,
      "He climbs back down the hundred and eight steps, more slowly now, and in his small room at the base of the tower he warms a pan of milk on the stove and stirs in a spoonful of cocoa. The room is snug and plain: a narrow bed with a patchwork quilt, a chair, a shelf of books, a window looking out to sea.", 5,
      "He drinks his cocoa sitting on the edge of the bed. Through the window, every few seconds, the beam passes overhead, silent and slow, sweeping the dark water and moving on. Light, and then dark. Light, and then dark.", 5,
      "The waves wash gently over the rocks below, and pull back, and wash in again. He doesn't need to watch the light all night. It keeps turning on its own, steady and faithful, whether he's watching or not.", 6,
      "He lies down and pulls the quilt up to his chin. Light, and then dark. The waves come in, and go out. Light, and then dark.", 6,
      "Somewhere out there, every boat can see the way home.", 5, "All is well.", 10,
    ],
  },
  {
    id: "snow-cabin", kind: "story", title: "Snow at the cabin", blurb: "A cabin in the woods on the first snowy night: firewood, soup, and a heavy quilt.",
    lines: [
      "The snow began just after dark, a few slow flakes at first, drifting down past the cabin window as if they weren't sure they were allowed. Now it's falling steadily, large and soft, and the woods outside are turning white and quiet.", 4,
      "You've brought in the last armful of firewood. The logs are cold and smell of pine and bark, and you stack them by the stove, one on top of another, criss-cross, the way you were taught.", 4,
      "The stove door creaks as you open it. The coals inside are glowing orange. You lay a fresh log across them and watch the bark catch, curl, and begin to burn with a low, contented sound. You close the little door and the cabin fills slowly with warmth.", 5,
      "On the back of the stove a pot of soup has been simmering for an hour. Potatoes and carrots and a little thyme. You ladle some into a heavy bowl and eat it slowly at the table by the window, the bowl warming your hands.", 5,
      "Outside, the snow keeps falling. It covers the woodpile and the path and the low branches of the pines, which bend a little under it. There is no wind at all. The flakes fall straight down, past the yellow square of light from the window, and disappear into the dark.", 5,
      "Snow makes everything quieter. The whole forest is wrapped in it, hushed, the way a room is hushed when someone is sleeping in it.", 5,
      "You wash the bowl and set it upside down to dry. You check the stove one more time and turn the damper down, so the fire will burn low and slow and last until morning.", 4,
      "The bed is in the corner, under the slope of the roof, piled with blankets and an old quilt that's been washed so many times it's soft as flannel. You climb in. The sheets are cold for a moment, and then they aren't.", 5,
      "From the bed you can see the window, and the snow still falling past it, slow and endless and silent.", 5,
      "The fire ticks in the stove. The cabin creaks once, settling under the weight of the snow, the way an old house sighs before it sleeps.", 5,
      "By morning the woods will be deep and white, and the world will be new. But that's a long way off. Tonight there's nothing to do but lie here, warm and heavy, while the snow falls and falls.", 6,
      "Soft, and slow.", 5, "Soft, and slow.", 10,
    ],
  },
  {
    id: "slow-river", kind: "story", title: "The slow river", blurb: "Drifting downstream in a little wooden boat at dusk, past willows and lanterns.",
    lines: [
      "You're lying in the bottom of a small wooden boat, on a cushion and a folded blanket, drifting down a slow river at the very end of the day.", 3,
      "There are no oars to pull. The current is gentle and does all the work, turning the boat a little this way and a little that way, carrying it on at the pace of a slow walk.", 4,
      "Above you, the sky is deep blue and the first stars are coming out, one at a time, as if someone is lighting them with a long, careful match.", 4,
      "The river is wide here, and very calm. The water talks quietly against the side of the boat, a soft lapping, over and over. Along the banks, willows lean down and trail their long branches in the water.", 5,
      "A heron stands in the shallows on one leg, perfectly still, watching nothing in particular. As you drift past, it doesn't move at all. It's not in any hurry, and neither are you.", 5,
      "The boat slides under a small stone bridge. For a moment the sky is gone, and the sound of the water echoes, hollow and close, and then you're out the other side, under the stars again.", 5,
      "Further on, there are cottages near the bank, with lanterns hung by their gates. Their light lies on the water in long, wavering stripes. Someone's having supper. Someone's reading by the fire. Someone's already asleep.", 5,
      "The air smells of cut grass and cool water. The boat turns slowly, so that the bank you were watching drifts out of sight and the other bank drifts in, with its dark fields and its row of poplar trees.", 5,
      "You can feel the river moving underneath you, a slow and steady pull, the same pull it has had for a thousand years, carrying everything gently toward the sea.", 5,
      "Your arms rest at your sides. Your hands are open. Your head is heavy on the cushion, and the boat rocks so gently that you only notice it if you think about it.", 5,
      "You don't need to steer. You don't need to watch the banks. The river knows the way.", 6,
      "The water laps against the boat. The stars come out. And you drift, slowly, slowly, further and further downstream.", 10,
    ],
  },
  {
    id: "night-bakery", kind: "story", title: "The night bakery", blurb: "A baker's quiet hours before dawn: flour, warm ovens, and loaves rising.",
    lines: [
      "In a small town, long before the sun comes up, there is one window lit on the main street. It belongs to the bakery, and inside, Tom the baker is beginning his night's work.", 3,
      "The bakery is warm already. The big ovens at the back have been heating for an hour, and they give off a dry, steady warmth that fills every corner of the room.", 4,
      "Tom ties his apron and measures out the flour, scoop after scoop, into the big steel bowl. It falls like soft snow and sends up a faint white cloud that hangs in the lamplight. Water. Salt. A little yeast, dissolved in warm water until it smells sweet and earthy.", 5,
      "He mixes it all slowly, by hand, folding and turning, folding and turning, until the shaggy mixture comes together into one smooth, heavy dough.", 4,
      "Then he kneads. He presses the dough away from him with the heels of his hands, folds it back, turns it a quarter turn, and presses again. Press, fold, turn. Press, fold, turn. It's a rhythm his hands know so well that his mind can rest.", 6,
      "The dough grows soft and springy under his hands. He shapes it into a ball, sets it in the bowl, and covers it with a clean cloth. Now it needs to rest. Bread can't be rushed. It rises in its own time, slowly, in the warm and the quiet.", 5,
      "While it rests, Tom sweeps the floor. The broom whispers across the boards. He wipes down the long wooden table. He lines up the baskets for the morning, round ones for rolls and long ones for loaves.", 5,
      "Then he sits on the stool by the oven with a cup of coffee and does nothing at all. Outside, the street is empty and the streetlamps hum. The town is asleep. Every house is dark.", 5,
      "Under its cloth, the dough is rising, quietly doubling, filling with tiny bubbles of air. Nobody has to watch it. It just grows, the way things grow in the night.", 5,
      "Later, he'll shape the loaves and slide them into the oven, and the whole street will fill with the smell of fresh bread, and people will wake up to it and smile. But that's later.", 5,
      "For now, everything is resting. The dough, under its cloth. The town, under its blankets. The baker, on his stool, eyes half closed in the warmth of the ovens.", 6,
      "Everything is rising, slowly, in the warm and the quiet.", 10,
    ],
  },
  {
    id: "greenhouse", kind: "story", title: "The greenhouse in the rain", blurb: "Potting seedlings in a glasshouse while rain patters on the roof.",
    lines: [
      "At the bottom of the garden there's an old greenhouse, and tonight you're inside it, with rain falling on the glass roof above you.", 3,
      "It isn't cold. The greenhouse holds the warmth of the day, and the air is soft and damp and smells of soil and green leaves. A small lantern hangs from a hook and lights the long wooden bench in front of you.", 4,
      "The rain on the glass makes a sound like a thousand tiny fingertips tapping, light and fast and endless. Now and then a bigger drop gathers and slides down the panes in a slow, crooked line.", 5,
      "On the bench is a tray of seedlings, small and pale green, each with two round leaves. Beside it, a stack of clay pots and a sack of dark, crumbly soil.", 4,
      "You fill a pot with soil and press it down gently with your thumbs. You make a little hollow in the middle with one finger. Then, very carefully, you lift a seedling from the tray, holding it by a leaf, never by the stem, and settle it into its new home. A little more soil around it. A gentle press. One done.", 5,
      "You fill the next pot. Soil, press, hollow. Lift the seedling. Settle it in. A little more soil. A gentle press. Two done.", 5,
      "There's no rush. There are many seedlings, and the rain will go on for hours. You work slowly, pot after pot, and the row on the shelf grows longer.", 5,
      "Three. Four. Five.", 5,
      "When you've finished, you give them all a little water from the long-spouted can. The water darkens the soil and the seedlings lean, very slightly, toward the lantern.", 5,
      "You sit down on an upturned crate in the corner, wipe your hands on a cloth, and just listen. The rain on the roof. The drip from the gutter outside. The quiet breathing of all these green things growing.", 6,
      "Plants grow most at night, did you know that? In the dark and the quiet, while no one is watching, they stretch a little and strengthen a little, getting ready for the morning.", 6,
      "The rain taps on the glass. The lantern glows. And everything here is growing, slowly, softly, through the night.", 10,
    ],
  },
];

// ── Bible-based stories (faith) ─────────────────────────────────────────────

const FAITH_STORIES: SleepScript[] = [
  {
    id: "elijah", kind: "story", faith: true, ref: "1 Kings 19:4-13", title: "Elijah under the tree", blurb: "The tired prophet who God fed, let sleep, and spoke to in a gentle whisper.",
    lines: [
      "Elijah had been running for a whole day. He was a prophet, and he had been brave for a long time, and now he was simply tired. Tired in his legs, and tired in his heart.", 4,
      "He came to a lone tree in the wilderness, a juniper with thin, spreading branches, and sat down in its shade. The sand was still warm from the sun. He had nothing left to give. “It is enough,” he said to God. And he lay down under the tree, and he slept.", 6,
      "God did not scold him. God did not give him a list of things to do. While he slept, an angel came and touched him gently, and said, “Arise and eat.”", 5,
      "And there by his head was a cake of bread, baked on hot stones, and a jar of cool water. Elijah ate, and he drank. And then he lay down again, and went back to sleep.", 6,
      "Rest is not a failure. Sometimes the holiest thing to do is eat, and drink, and sleep.", 6,
      "The angel came a second time, and touched him, and said, “Arise and eat, because the journey is too great for thee.” God knew how far he had to go. God knew it was too much to carry alone. So he fed him again, and let him rest.", 6,
      "In the strength of that bread, Elijah walked for forty days and forty nights, all the way to the mountain of God. There he found a cave, and he went inside, and spent the night.", 5,
      "Then the Lord passed by. A great wind came, strong enough to break the rocks, but the Lord was not in the wind. After the wind, an earthquake, but the Lord was not in the earthquake. After the earthquake, a fire, but the Lord was not in the fire.", 6,
      "And after the fire, a still, small voice.", 6,
      "A gentle whisper. Quiet enough that Elijah had to be still to hear it.", 6,
      "God still speaks that way. Not always in the loud and the urgent, but in the quiet. You don't have to chase him tonight. You can be still, and let him come near.", 6,
      "You've come a long way today. The journey has been too great for you to carry alone, and you weren't meant to.", 5,
      "So rest now, like Elijah under the tree. Eat your bread. Drink your water. Lie down again.", 6,
      "He is watching over you while you sleep.", 10,
    ],
  },
  {
    id: "storm-boat", kind: "story", faith: true, ref: "Mark 4:35-41", title: "Asleep in the boat", blurb: "Jesus asleep on a cushion in the storm, and the great calm that followed.",
    lines: [
      "It was evening on the Sea of Galilee. The crowds had finally gone home, and Jesus said to his friends, “Let us pass over unto the other side.”", 4,
      "So they pushed the fishing boat out from the shore. The water was calm at first, and the sky was turning the color of peaches, and the oars dipped and rose, dipped and rose.", 5,
      "Jesus had been teaching all day. He was tired, the way you're tired tonight. He went to the back of the boat, where there was a cushion, and he lay down, and he fell asleep.", 5,
      "Then the wind came. It rushed down from the hills, and the sea rose up in great waves that broke over the side, until the boat was filling with water. The disciples, who were fishermen and knew the sea, were afraid.", 5,
      "And through all of it, Jesus slept, peacefully, on his cushion.", 6,
      "They woke him. “Master,” they said, “carest thou not that we perish?”", 4,
      "He got up. He looked at the wind, and he looked at the waves, and he said, “Peace, be still.”", 6,
      "And the wind stopped. And the waves lay down flat. And there was a great calm.", 7,
      "Imagine that calm. The water smooth as glass, all the way to the shore. The boat rocking gently, the way a cradle rocks. The last drops falling from the sail. Stars beginning to show in the clearing sky.", 6,
      "Whatever storm has been blowing in you today, the same voice speaks to it. Peace. Be still.", 7,
      "The disciples took up the oars again, slowly now, and the boat slid quietly across the dark water toward the other side. No one said much. There was nothing to be afraid of anymore.", 6,
      "Jesus could sleep in the storm because he knew whose hands held the sea. Those same hands are holding you.", 6,
      "So let the boat carry you. Let the water be calm. Lie down on your cushion, and sleep.", 6,
      "Peace.", 5, "Be still.", 10,
    ],
  },
  {
    id: "shepherd-count", kind: "story", faith: true, ref: "John 10:3, 11-14; Psalm 23", title: "Counting sheep with the Good Shepherd", blurb: "A shepherd counts his flock into the fold at night, one by one, and you count along.",
    lines: [
      "Evening is falling over the hills. The grass has turned from green to silver, and a shepherd is leading his flock home to the fold.", 4,
      "The fold is a circle of low stone walls on the side of the hill, with one narrow gap for a gate. The shepherd doesn't need a gate. At night, he lies down across the gap himself, so that nothing can come in, and nothing can wander out. He is the door.", 5,
      "But first, he counts them. Every night, every sheep. He stands at the opening with his staff held low, and the sheep pass under it, one at a time, and he counts them in.", 5,
      "He knows each one by name. The old ewe with the torn ear. The little one who always lags behind. The one who wandered off last spring and had to be carried home on his shoulders.", 5,
      "Let's count them in with him. You don't have to keep up. If you lose count, that's all right. The shepherd never loses count.", 5,
      "One.", 5, "Two.", 5, "Three.", 5, "Four.", 5, "Five.", 6,
      "Six.", 5, "Seven.", 5, "Eight.", 5, "Nine.", 5, "Ten.", 6,
      "He calls his own sheep by name, and leads them out.", 6,
      "Eleven.", 5, "Twelve.", 5, "Thirteen.", 5, "Fourteen.", 5, "Fifteen.", 6,
      "Sixteen.", 5, "Seventeen.", 5, "Eighteen.", 5, "Nineteen.", 5, "Twenty.", 6,
      "The Lord is my shepherd; I shall not want.", 6,
      "Twenty one.", 5, "Twenty two.", 5, "Twenty three.", 5, "Twenty four.", 5, "Twenty five.", 6,
      "Twenty six.", 5, "Twenty seven.", 5, "Twenty eight.", 5, "Twenty nine.", 5, "Thirty.", 6,
      "He maketh me to lie down in green pastures.", 6,
      "Thirty one.", 6, "Thirty two.", 6, "Thirty three.", 6, "Thirty four.", 6, "Thirty five.", 7,
      "Thirty six.", 6, "Thirty seven.", 6, "Thirty eight.", 6, "Thirty nine.", 6, "Forty.", 7,
      "He leadeth me beside the still waters. He restoreth my soul.", 7,
      "Forty one.", 6, "Forty two.", 6, "Forty three.", 6, "Forty four.", 6, "Forty five.", 7,
      "Forty six.", 7, "Forty seven.", 7, "Forty eight.", 7, "Forty nine.", 7, "Fifty.", 8,
      "That's all of them. Every one is home. Not one is missing.", 6,
      "The shepherd lies down across the doorway of the fold. The sheep settle in the dark, folding their legs under them, pressed warm against each other. Their breathing slows.", 6,
      "I am the good shepherd, and know my sheep.", 6,
      "You are counted, too. You are known by name. And he is lying across the doorway tonight, so you can sleep.", 10,
    ],
  },
  {
    id: "first-evening", kind: "story", faith: true, ref: "Genesis 1:1-5; 2:1-3", title: "The first evening", blurb: "God made the night, called it good, and rested on the seventh day.",
    lines: [
      "In the beginning, before anything else, there was darkness, and the Spirit of God moved gently over the face of the waters.", 5,
      "And God said, “Let there be light,” and there was light. And God saw the light, that it was good. And God divided the light from the darkness.", 5,
      "And God called the light Day, and the darkness he called Night.", 6,
      "He named the night. He made it on purpose. The dark is not an accident, and it isn't empty. It was given a name by the One who loves you.", 6,
      "And the evening and the morning were the first day.", 6,
      "Notice the order. Evening first, then morning. In God's way of counting, the day begins at night, with rest, before any work is done. You don't earn your sleep. Sleep comes first, and then the day.", 6,
      "Day after day, God made the world. The sky and the seas. The dry land, and the grass and the trees. The sun to rule the day, and the moon and the stars to rule the night. The fish, and the birds, and every living thing.", 6,
      "And at the end of each day, the evening came again, and then the morning.", 5,
      "When it was all finished, God looked at everything he had made, and behold, it was very good.", 6,
      "And on the seventh day, God rested.", 6,
      "Not because he was tired. God never grows tired. He rested because rest is good. He blessed the seventh day and made it holy.", 6,
      "So when you stop tonight, with things still undone, you're not falling behind. You're doing something holy. You're resting the way God rested.", 6,
      "The evening has come. The light has been divided from the darkness. The night has been named, and it is good.", 6,
      "And the morning will come, too. It always has.", 10,
    ],
  },
  {
    id: "samuel", kind: "story", faith: true, ref: "1 Samuel 3:1-10", title: "The lamp in the temple", blurb: "Young Samuel, asleep near the lamp of God, hears his name in the night.",
    lines: [
      "Long ago, in the house of the Lord at Shiloh, there lived a boy named Samuel. He helped the old priest Eli with the work of the temple, and at night he slept there too, near the ark of God.", 5,
      "It was late. Eli had gone to his room. His eyes were growing dim, and he had lain down to sleep. The temple was quiet and dark, except for one thing. The lamp of God had not yet gone out.", 6,
      "It burned with a small, steady flame, keeping watch through the night, and its light lay soft and golden on the stone floor.", 5,
      "Samuel was lying down, half asleep, watching the little flame, when he heard his name.", 5,
      "“Samuel.”", 5,
      "He got up and ran to Eli. “Here am I,” he said, “for thou calledst me.” But Eli said, “I called not; lie down again.” So Samuel went back, and lay down.", 6,
      "It happened again, and he went again, and again Eli said, “I called not, my son; lie down again.”", 5,
      "The third time, the old priest understood. It was the Lord who was calling the boy. And Eli told him, “Go, lie down: and it shall be, if he call thee, that thou shalt say, Speak, Lord; for thy servant heareth.”", 6,
      "So Samuel went back to his place, beside the burning lamp, and lay down. He wasn't afraid. He just waited, quietly, in the dark.", 6,
      "And the Lord came, and stood, and called as before, “Samuel, Samuel.”", 5,
      "And Samuel said, “Speak; for thy servant heareth.”", 7,
      "You can lie down the same way tonight. You don't have to do anything clever. You don't have to find the right words. You can simply lie still, near the light, and listen.", 6,
      "Speak, Lord. I'm listening.", 7,
      "The lamp of God has not gone out. It burns all night, small and steady, watching over you.", 6,
      "Lie down again.", 10,
    ],
  },
];

// ── Guided body relaxations ──────────────────────────────────────────────────

const BODY: SleepScript[] = [
  {
    id: "body-scan", kind: "body", title: "Body scan for sleep", blurb: "Slowly let go of each part of your body, from head to toes.",
    lines: [
      "Let your body settle into the bed. You don't have to do this perfectly. There's nothing to get right.", 4,
      "Take a slow breath in through your nose.", 4, "And let it go, slowly, through your mouth.", 5,
      "Once more. In.", 4, "And out.", 6,
      "Now let your breathing do whatever it wants to do. You don't need to control it.", 5,
      "Bring your attention to the top of your head. Just notice what's there. Warmth, coolness, tingling, or nothing at all. Nothing is fine too.", 6,
      "Let your forehead soften. The little muscles between your eyebrows can let go.", 5,
      "Your eyes can rest, heavy in their sockets.", 4, "Your cheeks soften.", 4,
      "Your jaw unclenches. Let a little space come between your teeth.", 5,
      "Your tongue rests softly in your mouth.", 5,
      "Feel your neck. It has held your head up all day. It can stop now. The pillow has it.", 7,
      "Your shoulders. Let them sink, away from your ears, down into the bed.", 6,
      "Now your right arm.", 3, "The upper arm, heavy.", 3, "The elbow.", 3, "The forearm.", 3, "Your right hand, resting, the fingers loose.", 6,
      "Now your left arm.", 3, "The upper arm, heavy.", 3, "The elbow.", 3, "The forearm.", 3, "Your left hand, resting, the fingers loose.", 6,
      "Notice your chest, rising and falling on its own.", 6, "You don't have to breathe. Your body is doing it for you.", 6,
      "Your stomach softens. Let it be round. There's no one to hold it in for.", 6,
      "Your lower back. Let it melt into the mattress.", 6,
      "Your hips grow heavy.", 4, "Your thighs, heavy.", 4, "Your knees.", 4, "Your calves, soft.", 4,
      "Your ankles.", 3, "Your feet.", 3, "All ten toes, warm and loose.", 6,
      "If your mind wanders, that's just what minds do. Each time you notice, come back to the next part of your body. Noticing is the practice.", 7,
      "Now feel your whole body at once, lying here.", 6, "Heavy.", 5, "Warm.", 5, "Held.", 7,
      "There's nowhere you need to be, and nothing you need to do, until morning.", 7,
      "You can stop listening now, and let sleep come whenever it's ready.", 10,
    ],
  },
  {
    id: "pmr", kind: "body", title: "Tense and let go", blurb: "Progressive muscle relaxation: tighten each muscle group, then release it.",
    lines: [
      "This takes about ten minutes. You'll gently tighten one part of your body, then let it go, and notice the difference. Use about half your strength. It should never hurt, and you can skip any part that's sore or injured.", 4,
      "Lie comfortably, and let your eyes close.", 5,
      "Start with your feet. Curl your toes and tighten your feet. Hold it.", 5,
      "And let go.", 8, "Feel the tension draining out. Your feet are softer now than before.", 6,
      "Now your calves. Point your toes up toward your face, and feel the backs of your legs tighten. Hold.", 5,
      "And release.", 8, "Let your lower legs be heavy.", 5,
      "Now your thighs. Press your knees together and tighten the muscles above them. Hold.", 5,
      "And let go.", 8, "Notice the warmth that comes in after.", 5,
      "Squeeze the muscles of your seat. Hold.", 5, "And release.", 8,
      "Tighten your stomach, as if you were bracing for a tickle. Hold.", 5,
      "And let it go.", 8, "Let your belly be soft and round.", 5,
      "Make two fists. Squeeze them. Hold.", 5,
      "And open your hands.", 8, "Feel the blood flowing back into your fingers.", 6,
      "Bend your elbows and tighten your arms. Hold.", 5, "And let them drop.", 8,
      "Lift your shoulders up toward your ears. Hold them there.", 5,
      "And let them fall.", 8, "Further than before.", 5,
      "Now scrunch up your whole face. Squeeze your eyes, wrinkle your nose, press your lips together. Hold.", 5,
      "And let it go.", 8, "Let your forehead be smooth. Let your jaw hang loose.", 7,
      "One last time, your whole body. Tighten everything at once, from your toes to your face. Hold.", 5,
      "And let everything go.", 10,
      "Feel the difference between tight and loose. This looseness is what your body feels like when it's ready for sleep.", 7,
      "If any part has tightened up again, just let it go once more.", 6,
      "Breathe slowly. Let each breath out carry a little more tension away.", 10,
      "You've done the work. Now you can rest.", 12,
    ],
  },
  {
    id: "military", kind: "body", title: "The two-minute method", blurb: "Relax face, shoulders, chest and legs, then clear your mind for ten seconds.",
    lines: [
      "This method comes from a book about training pilots to fall asleep anywhere. It takes a little practice, so give it a few nights.", 4,
      "Relax your whole face. Your forehead, the muscles around your eyes, your cheeks, your jaw, your tongue.", 6,
      "Drop your shoulders as low as they'll go. Let your upper arms go limp, then your forearms, then your hands.", 7,
      "Breathe out, and let your chest relax.", 6,
      "Relax your legs. Your thighs. Your calves. Your feet.", 7,
      "Now clear your mind for ten seconds. If pictures help you, imagine you're lying in a canoe on a calm lake, with nothing but a clear sky above you.", 10,
      "If pictures keep you awake, use words instead. Silently say: don't think, don't think, don't think.", 10,
      "Each time a thought shows up, come back to the canoe, or to the words.", 15,
      "That's all. Stay here, and let it work.", 20,
    ],
  },
  {
    id: "warm-heavy", kind: "body", title: "Warm and heavy", blurb: "Autogenic training: quiet phrases that let your arms and legs grow warm and heavy.",
    lines: [
      "In this exercise, you'll silently repeat a few simple phrases, and let your body follow them. Don't force anything. Just say the words, and notice.", 5,
      "My right arm is heavy.", 6, "My right arm is heavy.", 6, "My right arm is heavy.", 8,
      "My left arm is heavy.", 6, "My left arm is heavy.", 6, "My left arm is heavy.", 8,
      "My arms are heavy and warm.", 6, "My arms are heavy and warm.", 8,
      "My legs are heavy.", 6, "My legs are heavy.", 6, "My legs are heavy and warm.", 8,
      "My whole body is heavy and warm.", 8,
      "My heartbeat is calm and steady.", 6, "My heartbeat is calm and steady.", 8,
      "My breathing is calm and easy.", 6, "It breathes me.", 8,
      "My stomach is soft and warm.", 8,
      "My forehead is pleasantly cool.", 8,
      "I am calm. I am warm. I am heavy.", 8,
      "Keep repeating whichever phrase feels best to you, slowly, as you drift.", 15,
    ],
  },
  {
    id: "deep-rest", kind: "body", title: "Deep rest", blurb: "A non-sleep deep rest practice: quick body tour, counting breaths, then letting go.",
    lines: [
      "This is a deep rest practice. You don't have to try to fall asleep. Just follow along, and if sleep comes, let it.", 5,
      "Lie on your back if that's comfortable, arms by your sides. Let your feet fall open.", 5,
      "Take a long breath in.", 4, "And a long, slow breath out.", 6, "Again, in.", 4, "And out.", 7,
      "Now we'll move your attention around your body, quickly, like a light touching each place. As each part is named, just notice it, and move on.", 4,
      "Right hand thumb.", 2, "First finger.", 2, "Second finger.", 2, "Third finger.", 2, "Little finger.", 2, "Palm of the hand.", 2, "Back of the hand.", 2, "Wrist.", 2, "Elbow.", 2, "Shoulder.", 2, "Right side of your chest.", 2, "Right hip.", 2, "Knee.", 2, "Ankle.", 2, "Heel.", 2, "Big toe.", 2, "All the toes of the right foot.", 4,
      "Left hand thumb.", 2, "First finger.", 2, "Second finger.", 2, "Third finger.", 2, "Little finger.", 2, "Palm of the hand.", 2, "Back of the hand.", 2, "Wrist.", 2, "Elbow.", 2, "Shoulder.", 2, "Left side of your chest.", 2, "Left hip.", 2, "Knee.", 2, "Ankle.", 2, "Heel.", 2, "Big toe.", 2, "All the toes of the left foot.", 4,
      "The back of your head.", 2, "Your forehead.", 2, "Your eyebrows.", 2, "Your eyelids.", 2, "Your nose.", 2, "Your lips.", 2, "Your chin.", 2, "Your throat.", 2, "Your heart.", 2, "Your belly.", 3,
      "The whole right side of your body.", 3, "The whole left side of your body.", 3, "Your whole body, together.", 6,
      "Now count your breaths backward, starting at twenty. On each breath out, silently say the number. Twenty.", 6,
      "If you lose your place, start again at twenty. It doesn't matter where you end up.", 30,
      "Let the numbers go now.", 5,
      "Notice heaviness in your body. As if your arms and legs were made of wet sand, sinking down.", 8,
      "Now notice lightness. As if your body were as light as a feather, floating just above the bed.", 8,
      "Heavy.", 6, "Light.", 6, "Heavy.", 6, "Light.", 8,
      "Now let both go. Just rest.", 10,
      "You are resting deeply. Your body is restoring itself, whether or not you fall asleep.", 8,
      "There's nothing left to do. You can stay here, and let sleep come whenever it wants to.", 20,
    ],
  },
  {
    id: "sinking", kind: "body", title: "Sinking into the bed", blurb: "A short one: with every breath out, sink a little deeper.",
    lines: [
      "Notice where your body touches the bed. The back of your head. Your shoulders. Your back. Your hips. Your legs. Your heels.", 6,
      "With your next breath out, let yourself sink a little deeper into the mattress. Just a little.", 6,
      "And with the next breath out, a little deeper.", 6,
      "You don't have to hold yourself up anymore. The bed is holding you. All of you.", 7,
      "Each breath out, a little heavier.", 6, "A little deeper.", 6, "A little softer.", 8,
      "Let the bed take all your weight.", 8, "Let it hold you all night.", 15,
    ],
  },
];

// ── Mind: guidance read aloud ────────────────────────────────────────────────

const MIND: SleepScript[] = [
  {
    id: "paradox", kind: "mind", title: "Try to stay awake", blurb: "Paradoxical intention: stop trying to sleep, and the pressure lets go.",
    lines: [
      "Tonight, you're going to try something that sounds backward. Instead of trying to fall asleep, you're going to gently try to stay awake.", 4,
      "Lie comfortably in the dark, with your eyes open. Not wide open, not straining. Just open.", 5,
      "You don't have to do anything. Don't read, don't check your phone. Just lie here, awake, resting in the dark.", 6,
      "If your eyes want to close, tell them, kindly, to stay open just a little longer.", 7,
      "Here's why this works. When you try hard to sleep, you get anxious about whether it's working, and that worry keeps you awake. When you stop trying, the worry has nothing to hold onto.", 6,
      "So there's no pressure tonight. You're not trying to sleep. You're just lying here, resting, eyes open, letting the night be quiet.", 8,
      "If sleep sneaks up on you anyway, you don't have to fight it very hard.", 20,
    ],
  },
  {
    id: "get-up", kind: "mind", title: "The 20-minute rule", blurb: "Can't sleep? Get up for a bit. Read this once you're up, somewhere dim.",
    lines: [
      "If it feels like you've been lying awake for about twenty minutes, it's time to get up for a little while. Don't check the clock. A rough guess is fine.", 4,
      "Go to another room, if you can, and keep the lights low. A single lamp is perfect.", 4,
      "Do something calm and a little boring. Fold laundry. Read something dull, on paper if you have it. Sort a drawer. Listen to something quiet. Avoid anything exciting, and avoid bright screens.", 5,
      "Don't eat a big snack, and don't start a project. You're not giving up on sleep. You're just waiting for it somewhere else.", 5,
      "When you notice you're getting sleepy, when your eyes feel heavy or you yawn, go back to bed.", 5,
      "If you're still awake after a while, it's fine to do this again. It can feel strange at first, but over a few nights it teaches your brain that bed is a place for sleep, not for lying awake and worrying.", 6,
      "It's one of the most proven things you can do for sleep. You're doing it right.", 10,
    ],
  },
];

// ── Boring on purpose (for when you're up, in dim light) ──────────────────────

const BORING: SleepScript[] = [
  {
    id: "kitchen-drawer", kind: "boring", title: "The kitchen drawer", blurb: "A slow, careful inventory of one ordinary kitchen drawer.",
    lines: [
      "This is the second drawer down, to the left of the sink. It is a little sticky, and opens best if you lift it slightly as you pull.", 4,
      "At the front, on the left, are the spoons that don't belong to any set. There are six of them. Two are teaspoons with plain handles. One is a slightly larger spoon with a pattern of leaves near the top. Two are measuring spoons, a tablespoon and a half teaspoon, from a set whose other members have gone missing. The sixth is a small wooden spoon with a darkened tip.", 4,
      "Behind the spoons is a bundle of twist ties, held together by one more twist tie. They are mostly white, with a few green ones. Some still have bread crumbs in their folds.", 4,
      "To the right of the twist ties is a roll of tape, the clear kind, with the end lost somewhere on the roll. Beside it, a pair of kitchen scissors, orange handled, slightly loose at the hinge.", 4,
      "In the middle of the drawer, lying flat, is a stack of takeout menus. The top one is for a pizza place. The second is also for a pizza place, but a different one. The third is for a restaurant that has since closed. Underneath them is a rubber band that has gone a little sticky with age.", 4,
      "Along the back of the drawer runs a row of small items. A bottle opener. A birthday candle, blue, never used. A battery whose charge is unknown. Two more batteries, also unknown. A pencil, sharpened at both ends. A key to something, though nobody remembers what.", 4,
      "In the far right corner there is a cork. It came from a bottle at some point, and was kept in case it would be needed. So far, it has not been needed.", 4,
      "Beneath everything, the drawer is lined with a sheet of paper printed with small blue flowers. The paper has been there a long time. In one corner it has curled up slightly, and if you press it flat with your finger, it curls up again.", 4,
      "There is a little dust in the corners of the drawer, and a few grains of rice that must have escaped from something. Three grains, perhaps four.", 4,
      "That is everything in the drawer. You may close it now. It is a little sticky, and closes best if you lift it slightly as you push.", 10,
    ],
  },
  {
    id: "laundry", kind: "boring", title: "Folding the laundry", blurb: "Towels, socks, and the long, patient business of matching pairs.",
    lines: [
      "There is a basket of clean laundry. It is still slightly warm from the dryer. We will fold it, slowly, starting with the towels, because towels are the easiest.", 4,
      "Take the first towel. It is a bath towel, pale blue. Hold it by two corners and shake it out once. Lay it flat on the bed. Fold it in half the long way, so the edges meet. Smooth it with your palm. Fold it in half again, and then in thirds. Set it on the corner of the bed. That is one towel.", 5,
      "The second towel is also pale blue. Shake it out. Lay it flat. Fold it in half the long way. Smooth it. Fold it in half again, and then in thirds. Set it on top of the first towel. The stack is now two towels high.", 5,
      "The third towel is a hand towel, white, with a gray stripe. Hand towels are folded the same way, only smaller. In half, the long way. In half again. Then in thirds. It goes on a separate, smaller stack.", 5,
      "Now the socks. The socks are the long part. Pour them out onto the bed in a small heap. Most of them are gray. Some of them are black. A few of them are white, and those are easier to match.", 5,
      "Pick up one gray sock. Look for another gray sock that is the same length and has the same pattern on the toe. This one has a darker heel. Search the pile. Here is one with a darker heel, but it is slightly longer. Set it aside. Here is another. This one matches. Fold the tops together and set the pair down.", 5,
      "Pick up the next gray sock. This one has a small hole near the big toe. Look for its partner. It may also have a small hole. It does not. It may not have a partner at all. Set it aside, in the place for socks without partners.", 5,
      "Pick up a white sock. Here is another white sock. They match. Fold them together. Set them down.", 5,
      "Pick up a black sock. Look for another black sock of the same length. There are three black socks that are almost the same length. Hold two of them side by side. One has slightly looser elastic. Try the third. The third matches. Fold the tops together and set the pair down.", 5,
      "There are still many socks. There is no hurry. One gray sock. Another gray sock. A match. One black sock. Another black sock. Not a match. Another. A match.", 6,
      "The pile is getting smaller. The stacks of pairs are getting taller. The socks without partners wait together in their corner, hoping.", 10,
    ],
  },
  {
    id: "weather-towns", kind: "boring", title: "Weather in small towns", blurb: "An unhurried weather report for a list of quiet, made-up towns.",
    lines: [
      "Here is the weather for tonight, for a number of small towns.", 4,
      "In Millbrook, it will be cloudy, with a light wind from the west. The temperature will fall slowly to fifty one degrees. There is no rain expected. By morning, the clouds will thin a little.", 5,
      "In Ashford Green, skies will be mostly clear. The wind will be light and variable. Temperatures will drop to forty eight degrees, with a small chance of mist in the low fields near the river.", 5,
      "In Copper Hollow, it will be calm and overcast. The temperature will stay near fifty degrees through the night. The humidity will be moderate. Nothing much will change.", 5,
      "In Linden Falls, light drizzle is possible after midnight, but it will be very light. Most people will not notice it. The temperature will be forty nine degrees, and the wind will come from the southwest at three miles an hour.", 5,
      "In Pebble Creek, it will be cloudy, then partly cloudy, then cloudy again. Low of fifty degrees. Wind from the west, light.", 5,
      "In Fernley, skies will be clear. The stars will be visible to anyone who looks up, though most people will be asleep. The low will be forty six degrees.", 5,
      "In Hartwell, it will be mild and still. Fifty two degrees. A light breeze from the south. The weather in Hartwell is often like this.", 5,
      "In Oakmere, it will be cloudy, with a light wind from the west. The temperature will fall slowly to fifty one degrees. This is the same as the weather in Millbrook, which is not far away.", 5,
      "In Willow Bend, temperatures will fall to forty eight degrees. Mostly clear. A few thin clouds will drift over from the north, slowly, and then drift away.", 5,
      "Tomorrow's weather, for all of these towns, will be much the same. Mild. Calm. Partly cloudy. Light winds. Nothing much will happen anywhere at all.", 10,
    ],
  },
];

// ── Prayers and Christian practices (faith) ─────────────────────────────────

const PRAYERS: SleepScript[] = [
  {
    id: "examen", kind: "prayer", faith: true, title: "Evening examen", blurb: "Review the day with God: thanks, honesty, and handing over tomorrow.",
    lines: [
      "The examen is a way of praying through your day, practiced by Christians for nearly five hundred years. It's simple, and there are no wrong answers.", 4,
      "First, remember that God is here. You don't have to make him come. He's already with you, in this room, in this moment.", 6,
      "Take a slow breath, and say, Lord, I'm here. Thank you for being here with me.", 7,
      "Now, look back over your day with gratitude. Let it play back slowly, like a film. Where were the good moments? A meal. A kind word. A laugh. Something beautiful. Something that went right.", 10,
      "Pick one, and stay with it for a moment. Say thank you.", 10,
      "Now, notice your feelings from today. Where did you feel peace? Where did you feel restless, or anxious, or frustrated? You don't have to fix anything. Just notice, and be honest with God about it.", 12,
      "Is there something you wish had gone differently? Something you said, or didn't say? Bring it to him. His mercies are new every morning. Receive his forgiveness, and let it go.", 12,
      "Now, look toward tomorrow. What's coming? What are you worried about? Hand each thing to him, one at a time. Here, Lord. This is yours now.", 12,
      "Ask him for what you need for tomorrow. Strength. Patience. Peace. Whatever it is.", 8,
      "I will both lay me down in peace, and sleep: for thou, Lord, only makest me dwell in safety.", 8,
      "Amen.", 10,
    ],
  },
  {
    id: "keep-watch", kind: "prayer", faith: true, title: "Keep watch, dear Lord", blurb: "A night prayer attributed to St. Augustine, from the Book of Common Prayer.",
    lines: [
      "Keep watch, dear Lord, with those who work, or watch, or weep this night, and give your angels charge over those who sleep.", 5,
      "Tend the sick, Lord Christ; give rest to the weary, bless the dying, soothe the suffering, pity the afflicted, shield the joyous; and all for your love's sake.", 5,
      "Amen.", 8,
    ],
  },
  {
    id: "compline", kind: "prayer", faith: true, title: "Prayers at the close of day", blurb: "Three short night prayers from the Compline service.",
    lines: [
      "Be our light in the darkness, O Lord, and in your great mercy defend us from all perils and dangers of this night; for the love of your only Son, our Savior Jesus Christ.", 3, "Amen.", 6,
      "Visit this place, O Lord, and drive far from it all snares of the enemy; let your holy angels dwell with us to preserve us in peace; and let your blessing be upon us always; through Jesus Christ our Lord.", 3, "Amen.", 6,
      "Guide us waking, O Lord, and guard us sleeping; that awake we may watch with Christ, and asleep we may rest in peace.", 3, "Amen.", 8,
    ],
  },
  {
    id: "lords-prayer", kind: "prayer", faith: true, title: "The Lord's Prayer", blurb: "Matthew 6:9–13, slowly, a line at a time.",
    lines: [
      "Our Father which art in heaven,", 3, "Hallowed be thy name.", 4,
      "Thy kingdom come.", 3, "Thy will be done in earth, as it is in heaven.", 4,
      "Give us this day our daily bread.", 4,
      "And forgive us our debts, as we forgive our debtors.", 4,
      "And lead us not into temptation, but deliver us from evil:", 4,
      "For thine is the kingdom, and the power, and the glory, for ever.", 3, "Amen.", 8,
    ],
  },
  {
    id: "lay-me-down", kind: "prayer", faith: true, title: "Now I lay me down", blurb: "The old childhood prayer, with a gentle ending.",
    lines: [
      "Now I lay me down to sleep,", 2, "I pray the Lord my soul to keep.", 3,
      "His love to guard me through the night,", 2, "and wake me with the morning light.", 3,
      "Amen.", 8,
    ],
  },
  {
    id: "racing-mind", kind: "prayer", faith: true, title: "For a mind that won't slow down", blurb: "For the ADHD brain at bedtime.",
    lines: [
      "Lord, you made my mind, and you know how it works better than I do.", 4,
      "Tonight it's running in a hundred directions. Ideas, worries, plans, conversations, things I forgot, things I should have said.", 5,
      "I can't catch all of them, and I don't have to. You hold them all.", 5,
      "In the multitude of my thoughts within me, let your comforts delight my soul.", 6,
      "I give you every unfinished thing. Every open loop. Every reminder I'm afraid I'll lose. You don't forget anything, and you won't forget me.", 6,
      "Slow me down, Lord. Not by force, but by your peace.", 5,
      "Thou wilt keep him in perfect peace, whose mind is stayed on thee.", 6,
      "So I stay my mind on you. Just you. Just this breath. Just this moment.", 8,
      "Amen.", 10,
    ],
  },
  {
    id: "thoughts-captive", kind: "prayer", faith: true, title: "When my imagination won't stop", blurb: "For scenarios and pictures that keep playing: hand them over, then think on good things.",
    lines: [
      "Lord, my imagination is running tonight. Pictures, scenarios, conversations that haven't happened and probably never will.", 4,
      "Your word says, casting down imaginations, and bringing into captivity every thought to the obedience of Christ.", 5,
      "So I bring them to you. Not to fight them, just to hand them over. This one. And this one. And this one.", 8,
      "I don't have to finish the story in my head. I don't have to know how it ends. You already know.", 6,
      "Now help me think on what is true. On what is lovely. On what is good.", 5,
      "Something true: I am yours.", 5, "Something lovely: a quiet room, a warm blanket.", 5, "Something good: you are here, and you're not going anywhere.", 6,
      "Whatsoever things are true, whatsoever things are lovely, think on these things.", 8,
      "Amen.", 10,
    ],
  },
  {
    id: "anxious", kind: "prayer", faith: true, title: "When I'm anxious about tomorrow", blurb: "Handing tomorrow to God, one worry at a time.",
    lines: [
      "Father, I'm carrying tomorrow tonight, and it's heavy.", 4,
      "You told us to take no thought for the morrow, because tomorrow will take care of itself. Help me believe that.", 5,
      "Here is what I'm afraid of.", 3, "Take a moment, and name it to him.", 10,
      "I give it to you. I'm casting all my care upon you, because you care for me.", 6,
      "You'll already be there tomorrow, before I wake up. You'll be in every meeting, every conversation, every hard moment. Nothing will surprise you.", 6,
      "So for tonight, I set it down. I'll pick up only what you give me in the morning.", 6,
      "Give me rest now. Amen.", 10,
    ],
  },
  {
    id: "cant-sleep", kind: "prayer", faith: true, title: "When I can't sleep", blurb: "For lying awake, frustrated, in the dark.",
    lines: [
      "Lord, I can't sleep, and I'm getting frustrated.", 4,
      "But you don't slumber or sleep. You're awake right now, keeping watch, so I don't have to.", 5,
      "If sleep comes, thank you. If it doesn't come yet, help me rest anyway, here with you.", 5,
      "When I remember you upon my bed, and meditate on you in the night watches, my soul is satisfied.", 6,
      "So let this be a night watch with you. Not wasted time. Time with you.", 8,
      "I'm not alone in the dark. You're here. That's enough.", 8,
      "Amen.", 10,
    ],
  },
  {
    id: "woke-up", kind: "prayer", faith: true, title: "When I wake in the night", blurb: "A short prayer for 3 a.m.",
    lines: [
      "Lord, I'm awake again. It's dark, and it's quiet, and my mind wants to start working.", 4,
      "Not now. Nothing needs solving at this hour.", 4,
      "Return unto thy rest, O my soul; for the Lord hath dealt bountifully with thee.", 6,
      "Return to your rest.", 5, "Return to your rest.", 8,
      "Amen.", 10,
    ],
  },
  {
    id: "loved-ones", kind: "prayer", faith: true, title: "For the people I love", blurb: "Lifting each person up, and leaving them in good hands.",
    lines: [
      "Lord, before I sleep, I bring you the people I love.", 4,
      "Bring each one to mind, one at a time. See their face. Say their name to God.", 15,
      "Keep them tonight. Watch over them where they sleep. Give them what they need tomorrow.", 6,
      "I can't protect all of them. I can't fix everything for them. But you can hold them better than I ever could.", 6,
      "I leave them with you.", 5,
      "The Lord bless thee, and keep thee: the Lord make his face shine upon thee, and be gracious unto thee: the Lord lift up his countenance upon thee, and give thee peace.", 6,
      "Amen.", 10,
    ],
  },
  {
    id: "surrender", kind: "prayer", faith: true, title: "Handing over the day", blurb: "Letting go of what's done, and what's undone.",
    lines: [
      "Father, the day is over. Some of it went well. Some of it didn't. Some of it is still undone.", 5,
      "I give you what I did well. Thank you.", 4,
      "I give you what I got wrong. Forgive me.", 4,
      "I give you what I didn't finish. Hold it until morning.", 5,
      "Into thine hand I commit my spirit: thou hast redeemed me, O Lord God of truth.", 6,
      "Lord, now lettest thou thy servant depart in peace, according to thy word.", 6,
      "Amen.", 10,
    ],
  },
];

export const SCRIPTS: readonly SleepScript[] = [...STORIES, ...FAITH_STORIES, ...BODY, ...MIND, ...BORING, ...PRAYERS];

export const scriptById = (id: string) => SCRIPTS.find((s) => s.id === id);

/** Roughly how long a script takes to read aloud at a calm pace: about 120 words a minute,
 *  a short pause after each sentence, and every number of seconds of quiet. */
export function scriptMinutes(s: Pick<SleepScript, "lines">, pauseAfterSentence = 1.6): number {
  let secs = 0;
  for (const line of s.lines) {
    if (typeof line === "number") { secs += line; continue; }
    const words = line.split(/\s+/).filter(Boolean).length;
    const sentences = Math.max(1, (line.match(/[.!?](?=\s|$|”)/g) || []).length);
    secs += (words / 120) * 60 + sentences * pauseAfterSentence;
  }
  return Math.max(1, Math.round(secs / 60));
}

// ── Scripture for sleep (King James Version, public domain) ──────────────────
// The app reads each passage live from the LifeHub Bible lookup (bible-api.com, KJV), the same one
// the Bible app uses, and falls back to the text below when it's offline.

/** A Bible reference set for reading: "Psalm 139:1-12,17-18" becomes "Psalm 139:1–12, 17–18". */
export function displayRef(ref: string): string {
  return ref.replace(/(\d)-(\d)/g, "$1–$2").replace(/,(\d)/g, ", $1");
}

export type SleepPassage = {
  id: string;
  /** A reference the Bible lookup understands, like "Psalm 139:1-12,17-18". Show it with displayRef. */
  ref: string;
  title: string;
  /** Why it's good for night time. */
  note: string;
  verses: [number, string][];
};

export const PASSAGES: readonly SleepPassage[] = [
  { id: "ps4", ref: "Psalm 4", title: "Lie down in peace", note: "David's evening psalm. It ends with the best bedtime verse there is.", verses: [
    [1, "Hear me when I call, O God of my righteousness: thou hast enlarged me when I was in distress; have mercy upon me, and hear my prayer."],
    [2, "O ye sons of men, how long will ye turn my glory into shame? how long will ye love vanity, and seek after leasing? Selah."],
    [3, "But know that the LORD hath set apart him that is godly for himself: the LORD will hear when I call unto him."],
    [4, "Stand in awe, and sin not: commune with your own heart upon your bed, and be still. Selah."],
    [5, "Offer the sacrifices of righteousness, and put your trust in the LORD."],
    [6, "There be many that say, Who will shew us any good? LORD, lift thou up the light of thy countenance upon us."],
    [7, "Thou hast put gladness in my heart, more than in the time that their corn and their wine increased."],
    [8, "I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety."],
  ] },
  { id: "ps23", ref: "Psalm 23", title: "The Lord is my shepherd", note: "Green pastures, still waters, and a Shepherd who walks with you through the dark.", verses: [
    [1, "The LORD is my shepherd; I shall not want."],
    [2, "He maketh me to lie down in green pastures: he leadeth me beside the still waters."],
    [3, "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake."],
    [4, "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me."],
    [5, "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over."],
    [6, "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever."],
  ] },
  { id: "ps121", ref: "Psalm 121", title: "He never sleeps", note: "You can sleep, because the One who keeps you never does.", verses: [
    [1, "I will lift up mine eyes unto the hills, from whence cometh my help."],
    [2, "My help cometh from the LORD, which made heaven and earth."],
    [3, "He will not suffer thy foot to be moved: he that keepeth thee will not slumber."],
    [4, "Behold, he that keepeth Israel shall neither slumber nor sleep."],
    [5, "The LORD is thy keeper: the LORD is thy shade upon thy right hand."],
    [6, "The sun shall not smite thee by day, nor the moon by night."],
    [7, "The LORD shall preserve thee from all evil: he shall preserve thy soul."],
    [8, "The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore."],
  ] },
  { id: "ps91", ref: "Psalm 91", title: "Under his wings", note: "For fear in the night: “Thou shalt not be afraid for the terror by night.”", verses: [
    [1, "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty."],
    [2, "I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust."],
    [3, "Surely he shall deliver thee from the snare of the fowler, and from the noisome pestilence."],
    [4, "He shall cover thee with his feathers, and under his wings shalt thou trust: his truth shall be thy shield and buckler."],
    [5, "Thou shalt not be afraid for the terror by night; nor for the arrow that flieth by day;"],
    [6, "Nor for the pestilence that walketh in darkness; nor for the destruction that wasteth at noonday."],
    [7, "A thousand shall fall at thy side, and ten thousand at thy right hand; but it shall not come nigh thee."],
    [8, "Only with thine eyes shalt thou behold and see the reward of the wicked."],
    [9, "Because thou hast made the LORD, which is my refuge, even the most High, thy habitation;"],
    [10, "There shall no evil befall thee, neither shall any plague come nigh thy dwelling."],
    [11, "For he shall give his angels charge over thee, to keep thee in all thy ways."],
    [12, "They shall bear thee up in their hands, lest thou dash thy foot against a stone."],
    [13, "Thou shalt tread upon the lion and adder: the young lion and the dragon shalt thou trample under feet."],
    [14, "Because he hath set his love upon me, therefore will I deliver him: I will set him on high, because he hath known my name."],
    [15, "He shall call upon me, and I will answer him: I will be with him in trouble; I will deliver him, and honour him."],
    [16, "With long life will I satisfy him, and shew him my salvation."],
  ] },
  { id: "ps94", ref: "Psalm 94:18-19", title: "In the multitude of my thoughts", note: "For a mind that's full: God's comfort meets you in the middle of the noise.", verses: [
    [18, "When I said, My foot slippeth; thy mercy, O LORD, held me up."],
    [19, "In the multitude of my thoughts within me thy comforts delight my soul."],
  ] },
  { id: "ps131", ref: "Psalm 131", title: "A quieted soul", note: "Three verses about letting go of things too big for you.", verses: [
    [1, "LORD, my heart is not haughty, nor mine eyes lofty: neither do I exercise myself in great matters, or in things too high for me."],
    [2, "Surely I have behaved and quieted myself, as a child that is weaned of his mother: my soul is even as a weaned child."],
    [3, "Let Israel hope in the LORD from henceforth and for ever."],
  ] },
  { id: "ps46", ref: "Psalm 46", title: "Be still", note: "Even if the mountains shake, there is a river of peace.", verses: [
    [1, "God is our refuge and strength, a very present help in trouble."],
    [2, "Therefore will not we fear, though the earth be removed, and though the mountains be carried into the midst of the sea;"],
    [3, "Though the waters thereof roar and be troubled, though the mountains shake with the swelling thereof. Selah."],
    [4, "There is a river, the streams whereof shall make glad the city of God, the holy place of the tabernacles of the most High."],
    [5, "God is in the midst of her; she shall not be moved: God shall help her, and that right early."],
    [6, "The heathen raged, the kingdoms were moved: he uttered his voice, the earth melted."],
    [7, "The LORD of hosts is with us; the God of Jacob is our refuge. Selah."],
    [8, "Come, behold the works of the LORD, what desolations he hath made in the earth."],
    [9, "He maketh wars to cease unto the end of the earth; he breaketh the bow, and cutteth the spear in sunder; he burneth the chariot in the fire."],
    [10, "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth."],
    [11, "The LORD of hosts is with us; the God of Jacob is our refuge. Selah."],
  ] },
  { id: "ps139", ref: "Psalm 139:1-12,17-18", title: "The darkness is not dark to you", note: "He knows your lying down, and when you wake, you are still with him.", verses: [
    [1, "O LORD, thou hast searched me, and known me."],
    [2, "Thou knowest my downsitting and mine uprising, thou understandest my thought afar off."],
    [3, "Thou compassest my path and my lying down, and art acquainted with all my ways."],
    [4, "For there is not a word in my tongue, but, lo, O LORD, thou knowest it altogether."],
    [5, "Thou hast beset me behind and before, and laid thine hand upon me."],
    [6, "Such knowledge is too wonderful for me; it is high, I cannot attain unto it."],
    [7, "Whither shall I go from thy spirit? or whither shall I flee from thy presence?"],
    [8, "If I ascend up into heaven, thou art there: if I make my bed in hell, behold, thou art there."],
    [9, "If I take the wings of the morning, and dwell in the uttermost parts of the sea;"],
    [10, "Even there shall thy hand lead me, and thy right hand shall hold me."],
    [11, "If I say, Surely the darkness shall cover me; even the night shall be light about me."],
    [12, "Yea, the darkness hideth not from thee; but the night shineth as the day: the darkness and the light are both alike to thee."],
    [17, "How precious also are thy thoughts unto me, O God! how great is the sum of them!"],
    [18, "If I should count them, they are more in number than the sand: when I awake, I am still with thee."],
  ] },
  { id: "ps63", ref: "Psalm 63:1,5-8", title: "Upon my bed", note: "Meditating on God in the night watches.", verses: [
    [1, "O God, thou art my God; early will I seek thee: my soul thirsteth for thee, my flesh longeth for thee in a dry and thirsty land, where no water is;"],
    [5, "My soul shall be satisfied as with marrow and fatness; and my mouth shall praise thee with joyful lips:"],
    [6, "When I remember thee upon my bed, and meditate on thee in the night watches."],
    [7, "Because thou hast been my help, therefore in the shadow of thy wings will I rejoice."],
    [8, "My soul followeth hard after thee: thy right hand upholdeth me."],
  ] },
  { id: "ps62", ref: "Psalm 62:1-2,5-8", title: "My soul waits", note: "Waiting quietly, and pouring out your heart.", verses: [
    [1, "Truly my soul waiteth upon God: from him cometh my salvation."],
    [2, "He only is my rock and my salvation; he is my defence; I shall not be greatly moved."],
    [5, "My soul, wait thou only upon God; for my expectation is from him."],
    [6, "He only is my rock and my salvation: he is my defence; I shall not be moved."],
    [7, "In God is my salvation and my glory: the rock of my strength, and my refuge, is in God."],
    [8, "Trust in him at all times; ye people, pour out your heart before him: God is a refuge for us. Selah."],
  ] },
  { id: "ps127", ref: "Psalm 127:1-2", title: "He gives his beloved sleep", note: "Staying up late worrying doesn't build anything. Sleep is his gift.", verses: [
    [1, "Except the LORD build the house, they labour in vain that build it: except the LORD keep the city, the watchman waketh but in vain."],
    [2, "It is vain for you to rise up early, to sit up late, to eat the bread of sorrows: for so he giveth his beloved sleep."],
  ] },
  { id: "ps3", ref: "Psalm 3:3-5", title: "I laid me down and slept", note: "Written in a hard season, and still: I slept, and I woke.", verses: [
    [3, "But thou, O LORD, art a shield for me; my glory, and the lifter up of mine head."],
    [4, "I cried unto the LORD with my voice, and he heard me out of his holy hill. Selah."],
    [5, "I laid me down and slept; I awaked; for the LORD sustained me."],
  ] },
  { id: "ps16", ref: "Psalm 16:7-11", title: "Counsel in the night", note: "My heart instructs me in the night seasons.", verses: [
    [7, "I will bless the LORD, who hath given me counsel: my reins also instruct me in the night seasons."],
    [8, "I have set the LORD always before me: because he is at my right hand, I shall not be moved."],
    [9, "Therefore my heart is glad, and my glory rejoiceth: my flesh also shall rest in hope."],
    [10, "For thou wilt not leave my soul in hell; neither wilt thou suffer thine Holy One to see corruption."],
    [11, "Thou wilt shew me the path of life: in thy presence is fulness of joy; at thy right hand there are pleasures for evermore."],
  ] },
  { id: "ps34", ref: "Psalm 34:4-8", title: "Delivered from all my fears", note: "He heard, and he delivered.", verses: [
    [4, "I sought the LORD, and he heard me, and delivered me from all my fears."],
    [5, "They looked unto him, and were lightened: and their faces were not ashamed."],
    [6, "This poor man cried, and the LORD heard him, and saved him out of all his troubles."],
    [7, "The angel of the LORD encampeth round about them that fear him, and delivereth them."],
    [8, "O taste and see that the LORD is good: blessed is the man that trusteth in him."],
  ] },
  { id: "matt6", ref: "Matthew 6:25-34", title: "Take no thought for tomorrow", note: "Jesus on worry: the birds, the lilies, and today's trouble being enough.", verses: [
    [25, "Therefore I say unto you, Take no thought for your life, what ye shall eat, or what ye shall drink; nor yet for your body, what ye shall put on. Is not the life more than meat, and the body than raiment?"],
    [26, "Behold the fowls of the air: for they sow not, neither do they reap, nor gather into barns; yet your heavenly Father feedeth them. Are ye not much better than they?"],
    [27, "Which of you by taking thought can add one cubit unto his stature?"],
    [28, "And why take ye thought for raiment? Consider the lilies of the field, how they grow; they toil not, neither do they spin:"],
    [29, "And yet I say unto you, That even Solomon in all his glory was not arrayed like one of these."],
    [30, "Wherefore, if God so clothe the grass of the field, which to day is, and to morrow is cast into the oven, shall he not much more clothe you, O ye of little faith?"],
    [31, "Therefore take no thought, saying, What shall we eat? or, What shall we drink? or, Wherewithal shall we be clothed?"],
    [32, "(For after all these things do the Gentiles seek:) for your heavenly Father knoweth that ye have need of all these things."],
    [33, "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you."],
    [34, "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof."],
  ] },
  { id: "matt11", ref: "Matthew 11:28-30", title: "Rest for your souls", note: "An invitation for anyone who's tired.", verses: [
    [28, "Come unto me, all ye that labour and are heavy laden, and I will give you rest."],
    [29, "Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls."],
    [30, "For my yoke is easy, and my burden is light."],
  ] },
  { id: "phil4", ref: "Philippians 4:4-8", title: "Peace that guards your mind", note: "Pray about everything, then think on these things.", verses: [
    [4, "Rejoice in the Lord alway: and again I say, Rejoice."],
    [5, "Let your moderation be known unto all men. The Lord is at hand."],
    [6, "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God."],
    [7, "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."],
    [8, "Finally, brethren, whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, whatsoever things are lovely, whatsoever things are of good report; if there be any virtue, and if there be any praise, think on these things."],
  ] },
  { id: "isa26", ref: "Isaiah 26:3-4", title: "Perfect peace", note: "A mind stayed on him.", verses: [
    [3, "Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee."],
    [4, "Trust ye in the LORD for ever: for in the LORD JEHOVAH is everlasting strength."],
  ] },
  { id: "isa40", ref: "Isaiah 40:28-31", title: "He never grows weary", note: "Strength for the faint, from the God who never gets tired.", verses: [
    [28, "Hast thou not known? hast thou not heard, that the everlasting God, the LORD, the Creator of the ends of the earth, fainteth not, neither is weary? there is no searching of his understanding."],
    [29, "He giveth power to the faint; and to them that have no might he increaseth strength."],
    [30, "Even the youths shall faint and be weary, and the young men shall utterly fall:"],
    [31, "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."],
  ] },
  { id: "john14", ref: "John 14:1-3,27", title: "Let not your heart be troubled", note: "Jesus' own peace, given, not as the world gives.", verses: [
    [1, "Let not your heart be troubled: ye believe in God, believe also in me."],
    [2, "In my Father's house are many mansions: if it were not so, I would have told you. I go to prepare a place for you."],
    [3, "And if I go and prepare a place for you, I will come again, and receive you unto myself; that where I am, there ye may be also."],
    [27, "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid."],
  ] },
  { id: "rom8", ref: "Romans 8:31-39", title: "Nothing can separate you", note: "Not things present, nor things to come.", verses: [
    [31, "What shall we then say to these things? If God be for us, who can be against us?"],
    [32, "He that spared not his own Son, but delivered him up for us all, how shall he not with him also freely give us all things?"],
    [33, "Who shall lay any thing to the charge of God's elect? It is God that justifieth."],
    [34, "Who is he that condemneth? It is Christ that died, yea rather, that is risen again, who is even at the right hand of God, who also maketh intercession for us."],
    [35, "Who shall separate us from the love of Christ? shall tribulation, or distress, or persecution, or famine, or nakedness, or peril, or sword?"],
    [36, "As it is written, For thy sake we are killed all the day long; we are accounted as sheep for the slaughter."],
    [37, "Nay, in all these things we are more than conquerors through him that loved us."],
    [38, "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,"],
    [39, "Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord."],
  ] },
  { id: "mark4", ref: "Mark 4:35-41", title: "Peace, be still", note: "Jesus asleep in the storm, and the great calm.", verses: [
    [35, "And the same day, when the even was come, he saith unto them, Let us pass over unto the other side."],
    [36, "And when they had sent away the multitude, they took him even as he was in the ship. And there were also with him other little ships."],
    [37, "And there arose a great storm of wind, and the waves beat into the ship, so that it was now full."],
    [38, "And he was in the hinder part of the ship, asleep on a pillow: and they awake him, and say unto him, Master, carest thou not that we perish?"],
    [39, "And he arose, and rebuked the wind, and said unto the sea, Peace, be still. And the wind ceased, and there was a great calm."],
    [40, "And he said unto them, Why are ye so fearful? how is it that ye have no faith?"],
    [41, "And they feared exceedingly, and said one to another, What manner of man is this, that even the wind and the sea obey him?"],
  ] },
  { id: "prov3", ref: "Proverbs 3:24-26", title: "Your sleep shall be sweet", note: "A promise for lying down unafraid.", verses: [
    [24, "When thou liest down, thou shalt not be afraid: yea, thou shalt lie down, and thy sleep shall be sweet."],
    [25, "Be not afraid of sudden fear, neither of the desolation of the wicked, when it cometh."],
    [26, "For the LORD shall be thy confidence, and shall keep thy foot from being taken."],
  ] },
  { id: "lam3", ref: "Lamentations 3:22-26", title: "New every morning", note: "Whatever today was, his mercies start over at dawn.", verses: [
    [22, "It is of the LORD's mercies that we are not consumed, because his compassions fail not."],
    [23, "They are new every morning: great is thy faithfulness."],
    [24, "The LORD is my portion, saith my soul; therefore will I hope in him."],
    [25, "The LORD is good unto them that wait for him, to the soul that seeketh him."],
    [26, "It is good that a man should both hope and quietly wait for the salvation of the LORD."],
  ] },
  { id: "kings19", ref: "1 Kings 19:5-8", title: "Arise and eat", note: "God's care for the exhausted Elijah: food, water, and more sleep.", verses: [
    [5, "And as he lay and slept under a juniper tree, behold, then an angel touched him, and said unto him, Arise and eat."],
    [6, "And he looked, and, behold, there was a cake baken on the coals, and a cruse of water at his head. And he did eat and drink, and laid him down again."],
    [7, "And the angel of the LORD came again the second time, and touched him, and said, Arise and eat; because the journey is too great for thee."],
    [8, "And he arose, and did eat and drink, and went in the strength of that meat forty days and forty nights unto Horeb the mount of God."],
  ] },
  { id: "num6", ref: "Numbers 6:24-26", title: "A blessing for the night", note: "The priestly blessing, to end the day.", verses: [
    [24, "The LORD bless thee, and keep thee:"],
    [25, "The LORD make his face shine upon thee, and be gracious unto thee:"],
    [26, "The LORD lift up his countenance upon thee, and give thee peace."],
  ] },
];

export const passageById = (id: string) => PASSAGES.find((p) => p.id === id);

/** The King James Version's capitals, as a voice should say them. LORD and GOD are small capitals
 *  in print, and a few titles are set in full capitals; all are read as words, never spelled out
 *  or shouted. Whole titles go first, before LORD inside them is changed. */
const KJV_CAPS: readonly (readonly [RegExp, string])[] = [
  [/KING OF KINGS, AND LORD OF LORDS/g, "King of kings, and Lord of lords"],
  [/I AM THAT I AM/g, "I am that I am"],
  [/\bI AM\b/g, "I am"],
  [/\bJESUS\b/g, "Jesus"],
  [/\bJEHOVAH\b/g, "Jehovah"],
  [/\bLORD\b/g, "Lord"],
  [/\bGOD\b/g, "God"],
];
export function spokenCaps(text: string): string {
  return KJV_CAPS.reduce((t, [pattern, word]) => t.replace(pattern, word), text);
}

/** Text made easy for a voice to read: capitals spoken as words (spokenCaps), and "Selah" (a
 *  pause in the Psalms) becomes a few seconds of actual quiet. */
export function speakableVerse(text: string): ScriptLine[] {
  const clean = spokenCaps(text).replace(/\bshew\b/g, "show").trim();
  const parts = clean.split(/\s*\bSelah\.?\s*/);
  const out: ScriptLine[] = [];
  parts.forEach((p, i) => {
    if (p.trim()) out.push(p.trim());
    if (i < parts.length - 1) out.push(4);
  });
  return out;
}

/** A passage as a script for the narrator: verse by verse, with room to breathe between. */
export function passageScript(verses: readonly (readonly [number, string])[]): ScriptLine[] {
  const out: ScriptLine[] = [];
  for (const [, text] of verses) { out.push(...speakableVerse(text)); out.push(2); }
  out.push(8);
  return out;
}
