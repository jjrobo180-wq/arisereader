#!/usr/bin/env python3
"""Generate quiz questions for batch 3 of children's books."""

import json

quizzes = [
    # 1. Diary of a Wimpy Kid: Double Down
    {
        "title": "Diary of a Wimpy Kid: Double Down",
        "author": "Jeff Kinney",
        "ageGroup": "8-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "What does Greg believe about his life at the beginning of the book?",
                "options": ["That it is a reality TV show", "That he is dreaming", "That he is a superhero", "That he is being filmed for a movie"],
                "correct": "A"
            },
            {
                "question": "What does Greg buy at the school book fair instead of books?",
                "options": ["Toys", "Candy", "Comic books", "Video games"],
                "correct": "A"
            },
            {
                "question": "What contest does Greg enter at school to try to win candy corn?",
                "options": ["A balloon release contest", "A spelling bee", "A pie-eating contest", "A costume contest"],
                "correct": "B"
            },
            {
                "question": "Who finds Greg's balloon and is considered a possible role model for Greg?",
                "options": ["Maddox", "Rowley", "Fregley", "Jake McGough"],
                "correct": "A"
            },
            {
                "question": "What instrument does Greg choose to play in the school band?",
                "options": ["French horn", "Flute", "Trumpet", "Drums"],
                "correct": "A"
            },
            {
                "question": "Why does Greg join the school band?",
                "options": ["To get invited to Mariana's Halloween party", "To impress his parents", "To get extra credit", "To avoid gym class"],
                "correct": "B"
            },
            {
                "question": "What happens to the jar of candy corn that Greg wins?",
                "options": ["The family pig eats it", "Rowley drops it", "Greg gives it away", "Manny spills it"],
                "correct": "A"
            },
            {
                "question": "What movie do Greg and Rowley decide to make?",
                "options": ["Night of the Night Crawlers", "The Haunted Schoolhouse", "Zombie Attack", "The Monster Next Door"],
                "correct": "A"
            },
            {
                "question": "What does Greg's father think when Greg doesn't perform in the school concert?",
                "options": ["That Greg deliberately backed out", "That Greg was sick", "That Greg had stage fright", "That Greg was lost"],
                "correct": "A"
            },
            {
                "question": "What does Greg's father ground him for at the end of the book?",
                "options": ["Goofing off and missing the concert", "Failing a test", "Breaking a window", "Stealing candy"],
                "correct": "B"
            }
        ]
    },
    # 2. Diary of a Wimpy Kid: The Getaway
    {
        "title": "Diary of a Wimpy Kid: The Getaway",
        "author": "Jeff Kinney",
        "ageGroup": "8-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Where does Greg's family decide to go instead of celebrating Christmas at home?",
                "options": ["Isle de Corales resort", "Disney World", "A ski lodge", "Hawaii"],
                "correct": "A"
            },
            {
                "question": "Where had Greg's parents gone for their honeymoon?",
                "options": ["Isle de Corales", "Paris", "Hawaii", "A cruise"],
                "correct": "A"
            },
            {
                "question": "What problem does the family discover when they arrive at the resort?",
                "options": ["They took the wrong suitcase", "Their room was double-booked", "The resort was closed", "They lost their tickets"],
                "correct": "A"
            },
            {
                "question": "What scares Greg in his slippers one morning at the resort?",
                "options": ["A tarantula", "A snake", "A scorpion", "A crab"],
                "correct": "A"
            },
            {
                "question": "What animal does Manny keep in a bucket at the resort?",
                "options": ["A box jellyfish", "A starfish", "A hermit crab", "A sea urchin"],
                "correct": "A"
            },
            {
                "question": "Why are the Heffleys ordered to leave the resort?",
                "options": ["They stole another family's clothes", "They were too loud", "Manny broke a window", "Greg was rude to staff"],
                "correct": "A"
            },
            {
                "question": "What does the family do before leaving to end the trip on a positive note?",
                "options": ["Sneak back into the resort to take a family picture", "Go to the beach one last time", "Buy souvenirs", "Have a nice dinner"],
                "correct": "A"
            },
            {
                "question": "What does Greg discover on the resort's website after returning home?",
                "options": ["The resort is seeking information about his family", "The resort has closed down", "The resort changed its name", "The resort posted their photo publicly"],
                "correct": "A"
            },
            {
                "question": "What happens during the banana boat ride?",
                "options": ["The banana boat is punctured", "They fall off", "A shark appears", "They get lost"],
                "correct": "A"
            },
            {
                "question": "Where does Greg end up when the family splits up to escape the resort?",
                "options": ["A private beach in the adults-only section", "The golf course", "The pool area", "The kitchen"],
                "correct": "B"
            }
        ]
    },
    # 3. Diary of a Wimpy Kid: The Meltdown
    {
        "title": "Diary of a Wimpy Kid: The Meltdown",
        "author": "Jeff Kinney",
        "ageGroup": "8-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "What does Greg worry about on a hot day in January?",
                "options": ["Climate change", "Failing a test", "Losing his friends", "His pet pig"],
                "correct": "A"
            },
            {
                "question": "What does Greg's mother forbid him from doing as punishment for forgetting a social studies assignment?",
                "options": ["Watching TV or playing video games", "Going outside", "Eating dessert", "Riding his bike"],
                "correct": "A"
            },
            {
                "question": "What two groups on Greg's street are rivals?",
                "options": ["Upper Surrey Street and Lower Surrey Street", "Whirley Street and Surrey Street", "The Mingo Kids and the Safety Patrols", "The north side and the south side"],
                "correct": "A"
            },
            {
                "question": "Who are the savage group of kids that live in the woods?",
                "options": ["The Mingo Kids", "The Whirley Street Kids", "The Safety Patrols", "The Surrey Street Gang"],
                "correct": "A"
            },
            {
                "question": "What organization at school is made up only of female students?",
                "options": ["The Safety Patrols", "The Hall Monitors", "The Student Council", "The Peacekeepers"],
                "correct": "A"
            },
            {
                "question": "What does Greg build that indirectly starts a snowball fight?",
                "options": ["A snow fort", "A snowman", "An igloo", "A snowball launcher"],
                "correct": "A"
            },
            {
                "question": "Who is the Lower Surrey Street spy that lures defenders away from the fort?",
                "options": ["Trevor Nix", "Rowley Jefferson", "Jake McGough", "Manny Heffley"],
                "correct": "A"
            },
            {
                "question": "What happens when the delayed snowplow arrives?",
                "options": ["It drives through the remains of the fight", "It gets stuck in the snow", "It crashes into the fort", "It blocks the road"],
                "correct": "A"
            },
            {
                "question": "What did the family pet pig do that is mentioned in the book?",
                "options": ["It escaped from obedience school", "It ate all the candy corn", "It ran away", "It destroyed the yard"],
                "correct": "A"
            },
            {
                "question": "How does Greg feel at the end of the snowball fight?",
                "options": ["Glad that he survived", "Angry at Rowley", "Embarrassed", "Ready for revenge"],
                "correct": "B"
            }
        ]
    },
    # 4. Dog Man
    {
        "title": "Dog Man",
        "author": "Dav Pilkey",
        "ageGroup": "7-10",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Who are the fictional creators of the Dog Man comics?",
                "options": ["George Beard and Harold Hutchins", "Jack and Annie", "Greg and Rowley", "Henry and Ribsy"],
                "correct": "A"
            },
            {
                "question": "What is Dog Man's origin story?",
                "options": ["He has the head of a police dog and the body of a human cop", "He was bitten by a radioactive dog", "He is a robot shaped like a dog", "He was born with special powers"],
                "correct": "A"
            },
            {
                "question": "Who is the main villain known as 'The World's Most Evilest Cat'?",
                "options": ["Petey", "Flippy", "Li'l Petey", "Big Jim"],
                "correct": "A"
            },
            {
                "question": "What weapon does Petey use to try to defeat Dog Man in the first chapter?",
                "options": ["A giant vacuum cleaner", "A laser beam", "A freeze ray", "A robot army"],
                "correct": "A"
            },
            {
                "question": "How does Dog Man defeat the vacuum cleaner?",
                "options": ["He leads it to the beach where it sucks up too much water and explodes", "He unplugs it", "He breaks it with his paws", "He buries it in sand"],
                "correct": "A"
            },
            {
                "question": "In 'Robo Chief,' who replaces the police chief with a robot?",
                "options": ["An evil mayor", "Petey", "A mad scientist", "The police department"],
                "correct": "A"
            },
            {
                "question": "What does Petey do to all the words in books in 'Book 'Em Dog Man'?",
                "options": ["He zaps all the words out of books", "He burns all the books", "He hides the books", "He rewrites the books"],
                "correct": "A"
            },
            {
                "question": "How does Dog Man foil Petey's plan to remove words from books?",
                "options": ["He finds Petey's secret stash of books and distributes them to children", "He defeats Petey in a fight", "He uses a machine to restore the words", "He calls the police"],
                "correct": "A"
            },
            {
                "question": "What does Petey use to bring a hot dog to life?",
                "options": ["Living spray", "A magic potion", "A laser beam", "A spell"],
                "correct": "A"
            },
            {
                "question": "How does Dog Man defeat the hot dog army?",
                "options": ["He eats the army, with help from regular dogs", "He freezes them all", "He uses living spray against them", "He traps them in a building"],
                "correct": "A"
            }
        ]
    },
    # 5. Dog Man Unleashed
    {
        "title": "Dog Man Unleashed",
        "author": "Dav Pilkey",
        "ageGroup": "7-10",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What does Dog Man buy for the Chief's birthday at the pet store?",
                "options": ["A fish", "A bone", "A toy", "A collar"],
                "correct": "A"
            },
            {
                "question": "What is the fish named that Dog Man brings to the police station?",
                "options": ["Flippy", "Goldie", "Swimmy", "Bubbles"],
                "correct": "A"
            },
            {
                "question": "What does Flippy eat that makes him extremely intelligent?",
                "options": ["Brain Dots", "Fish food", "A magic potion", "Supervitamins"],
                "correct": "A"
            },
            {
                "question": "Who is the reporter who buys Zuzu and is Dog Man's biggest fan?",
                "options": ["Sarah Hatoff", "Mary Jane", "Nancy Drew", "Lucille"],
                "correct": "A"
            },
            {
                "question": "How does Petey escape from cat jail?",
                "options": ["He tricks an officer using a paper decoy of himself", "He digs a tunnel", "He picks the lock", "He bribes a guard"],
                "correct": "A"
            },
            {
                "question": "Who brings the paper version of Petey to life with Living Spray?",
                "options": ["Dr. Boog E. Feeva", "Dr. Dookie", "The Chief", "Sarah Hatoff"],
                "correct": "A"
            },
            {
                "question": "What is the name of the tank Petey builds to collect treasure?",
                "options": ["Treasure Tank 2000", "The Love Mobile", "Golden Rover", "The Treasure Hunter"],
                "correct": "A"
            },
            {
                "question": "What ray does Petey use to make people fall in love with him?",
                "options": ["Love Ray", "Hypno Ray", "Charm Beam", "Mind Control Ray"],
                "correct": "A"
            },
            {
                "question": "Who is revealed to be the mysterious pet-store robber?",
                "options": ["Flippy", "Petey", "Flat Petey", "Dr. Boog E. Feeva"],
                "correct": "A"
            },
            {
                "question": "How does Flat Petey get defeated at the end?",
                "options": ["Dog Man licks him, covering him with saliva, and he freezes stiff", "He is torn to pieces", "He falls in water and dissolves", "He is eaten by a dog"],
                "correct": "A"
            }
        ]
    },
    # 6. Dog Man: A Tale of Two Kitties
    {
        "title": "Dog Man: A Tale of Two Kitties",
        "author": "Dav Pilkey",
        "ageGroup": "7-10",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What does Petey do to create a butler for himself?",
                "options": ["He buys a cloning machine", "He hires a robot", "He builds an android", "He uses Living Spray"],
                "correct": "A"
            },
            {
                "question": "What happens instead of creating a full-sized clone of Petey?",
                "options": ["A kitten version of Petey is created", "Nothing happens", "A dog is created", "An evil twin is made"],
                "correct": "A"
            },
            {
                "question": "What does the kitten clone name himself?",
                "options": ["Li'l Petey", "Snowball", "Junior", "Fluffy"],
                "correct": "A"
            },
            {
                "question": "Why did the clone come out as a kitten instead of an adult?",
                "options": ["Petey didn't read the back page saying the clone must wait 18 years to reach adulthood", "The machine was broken", "He used the wrong DNA", "The machine was set to kitten mode"],
                "correct": "A"
            },
            {
                "question": "What does Petey eventually do to Li'l Petey?",
                "options": ["He abandons him", "He sells him", "He teaches him to be evil", "He keeps him as a butler"],
                "correct": "A"
            },
            {
                "question": "What is Flippy turned into at the laboratory?",
                "options": ["A robot", "A ghost", "A giant fish", "A human"],
                "correct": "A"
            },
            {
                "question": "What does Flippy bring to life using his mind powers?",
                "options": ["Beasty Buildings", "An army of cats", "A giant monster", "An army of robots"],
                "correct": "A"
            },
            {
                "question": "What is the name of Petey's robot that he builds?",
                "options": ["80-Hexotron-Droidformigon (80-HD)", "Mega-Bot 3000", "Robo-Petey", "The Supa Robot"],
                "correct": "A"
            },
            {
                "question": "How does Li'l Petey defeat Flippy?",
                "options": ["He shows Flippy a comic book he made, making Flippy cry with happiness and weakening his powers", "He fights Flippy with 80-HD", "He uses Living Spray", "He tricks Flippy into a trap"],
                "correct": "A"
            },
            {
                "question": "Where does Li'l Petey end up living at the end of the book?",
                "options": ["With Dog Man", "With Petey", "With Sarah Hatoff", "At the police station"],
                "correct": "A"
            }
        ]
    },
    # 7. Captain Underpants and the Attack of the Talking Toilets
    {
        "title": "Captain Underpants and the Attack of the Talking Toilets",
        "author": "Dav Pilkey",
        "ageGroup": "7-10",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What event does Jerome Horwitz Elementary School hold?",
                "options": ["An Invention Convention", "A science fair", "A talent show", "A field day"],
                "correct": "A"
            },
            {
                "question": "Why are George and Harold forced to stay in study hall all day?",
                "options": ["Because they glued everyone to their seats the previous year", "Because they were late", "Because they cheated on a test", "Because they were fighting"],
                "correct": "A"
            },
            {
                "question": "What invention does Melvin Sneedly create?",
                "options": ["A photocopier that can turn a picture into a real being", "A time machine", "A robot that cleans", "A flying device"],
                "correct": "A"
            },
            {
                "question": "What happens when George and Harold use Melvin's invention to copy their comic?",
                "options": ["The talking toilets come to life", "The comic characters come to life", "The school catches fire", "Nothing happens"],
                "correct": "A"
            },
            {
                "question": "What does the Turbo Toilet 2000 do to Captain Underpants?",
                "options": ["Swallows him whole", "Sends him flying", "Traps him inside", "Flushes him away"],
                "correct": "A"
            },
            {
                "question": "What super-powered robot do George and Harold build using Melvin's machine?",
                "options": ["The Incredible Robo-Plunger", "The Turbo Flush Bot", "The Toilet Terminator", "The Plunger Master 3000"],
                "correct": "A"
            },
            {
                "question": "What does the Incredible Robo-Plunger do after repairing all the damage?",
                "options": ["Flies off to Uranus", "Becomes the new school mascot", "Explodes", "Turns into a regular plunger"],
                "correct": "A"
            },
            {
                "question": "What do George and Harold do after Mr. Krupp cancels their detention?",
                "options": ["Hold an all-day carnival for the students", "Go home early", "Throw a party in the gym", "Sell the school's furniture"],
                "correct": "A"
            },
            {
                "question": "What do George and Harold reveal they sold to pay for the carnival?",
                "options": ["Mr. Krupp's antique furniture and the teachers' lounge furniture", "School supplies", "Melvin's invention", "The school's computers"],
                "correct": "A"
            },
            {
                "question": "Who is eaten by one of the talking toilets?",
                "options": ["Mr. Meaner, the gym teacher", "Mr. Krupp", "Melvin Sneedly", "Ms. Ribble"],
                "correct": "A"
            }
        ]
    },
    # 8. Captain Underpants and the Perilous Plot of Professor Poopypants
    {
        "title": "Captain Underpants and the Perilous Plot of Professor Poopypants",
        "author": "Dav Pilkey",
        "ageGroup": "7-10",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Where is Professor Poopypants from?",
                "options": ["New Swissland", "Switzerland", "New Jersey", "New Swisslandia"],
                "correct": "A"
            },
            {
                "question": "What are the names of Professor Poopypants' two inventions?",
                "options": ["Shrinky-Pig and Goosy-Grow", "Shrink-Ray and Grow-Ray", "Mini-Mizer and Mega-Mizer", "Small-O-Matic and Big-O-Matic"],
                "correct": "A"
            },
            {
                "question": "Why does everyone laugh at Professor Poopypants?",
                "options": ["Because of his silly name", "Because of his funny clothes", "Because of his accent", "Because of his bad jokes"],
                "correct": "A"
            },
            {
                "question": "What job does Professor Poopypants apply for at the school?",
                "options": ["A replacement teacher", "A janitor", "A librarian", "A science teacher"],
                "correct": "A"
            },
            {
                "question": "What does Professor Poopypants do to the school?",
                "options": ["He shrinks it and holds everyone hostage", "He blows it up", "He floods it", "He freezes it"],
                "correct": "A"
            },
            {
                "question": "What does Professor Poopypants create to give everyone silly names?",
                "options": ["A system of three alphabetical name charts", "A magic potion", "A computer program", "A name-generating machine"],
                "correct": "A"
            },
            {
                "question": "What are George and Harold's silly names changed to?",
                "options": ["Fluffy and Cheeseball", "Buttercup and Snicklefritz", "Bubbles and Noodle", "Pinky and Stinky"],
                "correct": "A"
            },
            {
                "question": "What does Captain Underpants refuse to do when given a silly name?",
                "options": ["Obey the order to change names", "Fight Professor Poopypants", "Wear a costume", "Help George and Harold"],
                "correct": "A"
            },
            {
                "question": "How does Captain Underpants defeat Professor Poopypants?",
                "options": ["George enlarges Captain Underpants to the size of the gerbil", "He uses the Shrinky-Pig", "He tricks Poopypants", "He calls for help"],
                "correct": "A"
            },
            {
                "question": "What name does Professor Poopypants change his name to at the end?",
                "options": ["Tippy Tinkletrousers", "Professor Pippy", "Dr. Sillypants", "Captain Poopy"],
                "correct": "A"
            }
        ]
    },
    # 9. Magic Tree House: Night of the Ninjas
    {
        "title": "The Magic Tree House: Night of the Ninjas",
        "author": "Mary Pope Osborne",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What do Jack and Annie find inside the tree house that Annie names Peanut?",
                "options": ["A tiny mouse", "A small bird", "A kitten", "A frog"],
                "correct": "A"
            },
            {
                "question": "Where does the tree house transport Jack and Annie?",
                "options": ["Ancient Japan", "Ancient China", "Ancient Egypt", "Ancient Greece"],
                "correct": "A"
            },
            {
                "question": "What note do the children find from Morgan le Fay?",
                "options": ["That she needs help because she is under a spell", "That she has been captured", "That she is waiting for them", "That she has left forever"],
                "correct": "A"
            },
            {
                "question": "Who do the ninjas take Jack and Annie to meet?",
                "options": ["A ninja master", "A samurai warrior", "A village chief", "A wise monk"],
                "correct": "A"
            },
            {
                "question": "What must Jack and Annie do to prove themselves worthy?",
                "options": ["Find their way back through the dark forest alone while avoiding the samurai", "Fight a samurai", "Cross a river", "Find a hidden treasure"],
                "correct": "A"
            },
            {
                "question": "What advice does the ninja master give the children?",
                "options": ["Use nature, be nature, and follow nature", "Be brave and strong", "Run fast and hide", "Trust no one"],
                "correct": "A"
            },
            {
                "question": "How does Jack determine which direction to go?",
                "options": ["He uses a stick and its shadow in the moonlight", "He uses a compass", "He follows the stars", "He asks Annie"],
                "correct": "A"
            },
            {
                "question": "What does Annie tell Jack to do when they see a samurai warrior?",
                "options": ["Be as still as a rock", "Run away", "Hide in a tree", "Fight back"],
                "correct": "A"
            },
            {
                "question": "What does the ninja master give the children after they prove themselves?",
                "options": ["A moonstone", "A sword", "A map", "A scroll"],
                "correct": "A"
            },
            {
                "question": "What helps Jack and Annie find their way back to the tree house?",
                "options": ["Peanut the mouse leads them", "They follow the moon", "They follow the river", "They remember the path"],
                "correct": "A"
            }
        ]
    },
    # 10. Magic Tree House: Afternoon on the Amazon
    {
        "title": "The Magic Tree House: Afternoon on the Amazon",
        "author": "Mary Pope Osborne",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Where does the tree house transport Jack and Annie in this book?",
                "options": ["The Amazon rainforest", "African jungle", "Australian outback", "South American coast"],
                "correct": "A"
            },
            {
                "question": "What is the first item Jack and Annie have already found for Morgan?",
                "options": ["A moonstone", "A mango", "A mammoth bone", "A map"],
                "correct": "A"
            },
            {
                "question": "What animal does Peanut the mouse do to help the children?",
                "options": ["Guides them back to the tree house", "Fights off a snake", "Finds food", "Distracts a predator"],
                "correct": "A"
            },
            {
                "question": "What do Jack and Annie use as a canoe to travel down the Amazon River?",
                "options": ["A hollowed-out log", "A raft", "A fallen tree", "A large leaf"],
                "correct": "A"
            },
            {
                "question": "What kind of ants march through the rain forest that frighten the children?",
                "options": ["Flesh-eating ants", "Fire ants", "Army ants", "Leaf-cutter ants"],
                "correct": "A"
            },
            {
                "question": "What does Jack grab thinking it is a vine but turns out to be alive?",
                "options": ["A snake", "A crocodile", "A monkey's tail", "A fish"],
                "correct": "A"
            },
            {
                "question": "What animal does Annie befriend that helps them?",
                "options": ["A monkey", "A parrot", "A jaguar cub", "A tapir"],
                "correct": "A"
            },
            {
                "question": "What does the monkey give the children as the second item for Morgan?",
                "options": ["A mango", "A banana", "A coconut", "A papaya"],
                "correct": "A"
            },
            {
                "question": "What does Annie almost get attacked by while playing with what looks like a kitten?",
                "options": ["A mother jaguar", "A crocodile", "A snake", "A tiger"],
                "correct": "A"
            },
            {
                "question": "How do the items Jack and Annie have collected relate to Morgan's name?",
                "options": ["They both start with the letter M", "They both end with the letter A", "They are both foods", "They are both round"],
                "correct": "A"
            }
        ]
    },
    # 11. Magic Tree House: Sunset of the Sabertooth
    {
        "title": "The Magic Tree House: Sunset of the Sabertooth",
        "author": "Mary Pope Osborne",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Where does the tree house transport Jack and Annie?",
                "options": ["The Ice Age", "Ancient Egypt", "Prehistoric Africa", "Ancient Rome"],
                "correct": "A"
            },
            {
                "question": "What are Jack and Annie wearing when they arrive at their destination?",
                "options": ["Bathing suits", "Winter coats", "School uniforms", "Pajamas"],
                "correct": "A"
            },
            {
                "question": "What people lived during the Ice Age according to Jack's book?",
                "options": ["Cro-Magnons", "Neanderthals", "Vikings", "Cavemen"],
                "correct": "A"
            },
            {
                "question": "What do Jack and Annie find inside the first cave they explore?",
                "options": ["A sleeping bear", "A sabertooth tiger", "A Cro-Magnon family", "A treasure"],
                "correct": "A"
            },
            {
                "question": "What do the children leave in the Cro-Magnon cave as gifts?",
                "options": ["Their towels and swimming goggles", "Their shoes", "Their backpacks", "Their books"],
                "correct": "A"
            },
            {
                "question": "What do Jack and Annie find on the cave walls?",
                "options": ["Prehistoric animal drawings", "Treasure maps", "Ancient writing", "Footprints"],
                "correct": "A"
            },
            {
                "question": "What does the sorcerer painted on the cave wall look like?",
                "options": ["A creature with an owl's face and reindeer antlers", "A giant bear", "A wolf-man", "A deer with human legs"],
                "correct": "A"
            },
            {
                "question": "What animal do Jack and Annie fall into a pit trying to escape from?",
                "options": ["A sabertooth tiger", "A woolly mammoth", "A cave bear", "A giant elk"],
                "correct": "A"
            },
            {
                "question": "What does the sorcerer give Jack as the third item for Morgan?",
                "options": ["A mammoth bone flute", "A stone knife", "A cave painting", "An animal skin"],
                "correct": "A"
            },
            {
                "question": "What does Annie name the woolly mammoth that helps them?",
                "options": ["Lulu", "Manny", "Frosty", "Snowball"],
                "correct": "A"
            }
        ]
    },
    # 12. Magic Tree House: Midnight on the Moon
    {
        "title": "The Magic Tree House: Midnight on the Moon",
        "author": "Mary Pope Osborne",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Where does the tree house transport Jack and Annie?",
                "options": ["A moon base in the year 2031", "A space station", "Mars in the future", "The moon in 1969"],
                "correct": "A"
            },
            {
                "question": "How many items have Jack and Annie already collected for Morgan before this book?",
                "options": ["Three items", "Two items", "One item", "Four items"],
                "correct": "A"
            },
            {
                "question": "What must Jack and Annie wear to survive on the moon?",
                "options": ["Space suits", "Oxygen masks", "Winter coats", "Special helmets"],
                "correct": "A"
            },
            {
                "question": "Why do Jack and Annie bounce like rabbits on the moon?",
                "options": ["Because there is no gravity", "Because of the bouncy surface", "Because of the wind", "Because they are excited"],
                "correct": "A"
            },
            {
                "question": "What do Jack and Annie find on the moon that men from Earth placed there?",
                "options": ["An American flag", "A spaceship", "A building", "A satellite"],
                "correct": "A"
            },
            {
                "question": "What do the children discover and ride on the moon?",
                "options": ["A moon buggy", "A rocket sled", "A lunar rover", "A space motorcycle"],
                "correct": "A"
            },
            {
                "question": "What does the moon man draw for Jack and Annie?",
                "options": ["A map of stars", "A picture of Earth", "A constellation", "A message"],
                "correct": "A"
            },
            {
                "question": "What shape do the stars on the map form?",
                "options": ["A mouse", "A dog", "A cat", "A rabbit"],
                "correct": "A"
            },
            {
                "question": "What is revealed about Peanut the mouse?",
                "options": ["Peanut is actually Morgan le Fay transformed", "Peanut can talk", "Peanut is from the moon", "Peanut is a magical creature"],
                "correct": "A"
            },
            {
                "question": "Who put the spell on Morgan le Fay?",
                "options": ["Merlin the magician", "An evil witch", "A dark wizard", "The ninja master"],
                "correct": "A"
            }
        ]
    },
    # 13. Magic Tree House: Day of the Dragon King
    {
        "title": "The Magic Tree House: Day of the Dragon King",
        "author": "Mary Pope Osborne",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Where does the tree house transport Jack and Annie?",
                "options": ["Ancient China", "Ancient Japan", "Ancient Egypt", "Ancient Rome"],
                "correct": "A"
            },
            {
                "question": "What is the Dragon King's real title?",
                "options": ["The first emperor of China", "A mythical dragon", "A warlord", "A wizard"],
                "correct": "A"
            },
            {
                "question": "What must Jack and Annie save before it is destroyed?",
                "options": ["A bamboo book from the Imperial Library", "A golden dragon statue", "A magic scroll", "An ancient map"],
                "correct": "A"
            },
            {
                "question": "What writing medium does Morgan give the children before they leave?",
                "options": ["A bamboo stick", "A brush", "A scroll", "A pen"],
                "correct": "A"
            },
            {
                "question": "Who do Jack and Annie meet that asks them to deliver a message?",
                "options": ["A cowherd", "A farmer", "A soldier", "A merchant"],
                "correct": "A"
            },
            {
                "question": "What does the silk weaver give the children?",
                "options": ["A ball of silk", "A silk garment", "A silk scroll", "A silk pouch"],
                "correct": "A"
            },
            {
                "question": "What famous structure did the Dragon King force his people to build?",
                "options": ["The Great Wall of China", "A giant palace", "An army of statues", "A massive tomb"],
                "correct": "A"
            },
            {
                "question": "What does the Dragon King fear and want to destroy?",
                "options": ["Books and knowledge", "Weapons", "Foreign invaders", "Rebellions"],
                "correct": "A"
            },
            {
                "question": "Where do Jack and Annie hide to escape the soldiers?",
                "options": ["The burial grounds with life-size clay figures", "A cave", "A river", "A farmhouse"],
                "correct": "A"
            },
            {
                "question": "What guides Jack and Annie to the exit when they are lost in the burial grounds?",
                "options": ["The ball of silk rolls toward the exit", "Peanut leads them", "Jack reads a map", "They hear music"],
                "correct": "A"
            }
        ]
    },
    # 14. Magic Tree House: Ghost Town at Sundown
    {
        "title": "The Magic Tree House: Ghost Town at Sundown",
        "author": "Mary Pope Osborne",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What animal does Annie see that she believes is a sign from Morgan?",
                "options": ["A rabbit", "A deer", "A bird", "A cat"],
                "correct": "A"
            },
            {
                "question": "Where does the tree house transport Jack and Annie?",
                "options": ["A ghost town called Rattlesnake Flats", "A mining town", "A frontier fort", "A cattle ranch"],
                "correct": "A"
            },
            {
                "question": "What time period does this adventure take place in?",
                "options": ["The late 1800s Wild West", "The early 1900s", "The 1700s", "The mid-1800s"],
                "correct": "A"
            },
            {
                "question": "What do the children discover playing by itself in the hotel?",
                "options": ["A piano", "A jukebox", "A violin", "A phonograph"],
                "correct": "A"
            },
            {
                "question": "What do the children hide in to watch the horse thieves?",
                "options": ["Two empty barrels", "A closet", "Behind a building", "In a wagon"],
                "correct": "A"
            },
            {
                "question": "What does Annie name the colt that trots into town?",
                "options": ["Sunset", "Dusty", "Cowboy", "Star"],
                "correct": "A"
            },
            {
                "question": "Who surprises the children and claims the horses belong to him?",
                "options": ["A cowboy named Slim", "A sheriff", "A rancher", "A farmer"],
                "correct": "A"
            },
            {
                "question": "What is the answer to Morgan's riddle?",
                "options": ["An echo", "A ghost", "A voice", "A shadow"],
                "correct": "A"
            },
            {
                "question": "Who is believed to be the ghost playing the piano?",
                "options": ["Lonesome Luke", "Slim", "A former sheriff", "A miner"],
                "correct": "A"
            },
            {
                "question": "What song does Slim play on his harmonica that the children recognize?",
                "options": ["Red River Valley", "Home on the Range", "Oh Susanna", "Amazing Grace"],
                "correct": "A"
            }
        ]
    },
    # 15. Magic Tree House: Lions at Lunchtime
    {
        "title": "The Magic Tree House: Lions at Lunchtime",
        "author": "Mary Pope Osborne",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Where does the tree house transport Jack and Annie?",
                "options": ["The plains of Africa", "The African jungle", "The Sahara Desert", "The African savanna"],
                "correct": "A"
            },
            {
                "question": "What animal leads Jack and Annie to the tree house at the beginning?",
                "options": ["A small deer-like animal", "A rabbit", "A bird", "A monkey"],
                "correct": "A"
            },
            {
                "question": "What does Morgan's riddle say they are looking for?",
                "options": ["Something gold, sweet, and surrounded by danger", "Something shiny and dangerous", "Something sweet and hidden", "Something gold and rare"],
                "correct": "A"
            },
            {
                "question": "What animals are trying to cross a river that Annie wants to help?",
                "options": ["Wildebeests", "Zebras", "Gazelles", "Hippos"],
                "correct": "A"
            },
            {
                "question": "What does Annie fall into while trying to help the animals?",
                "options": ["A mud pit", "A river", "A ditch", "A trap"],
                "correct": "A"
            },
            {
                "question": "What animals do Jack and Annie scare away by learning they are cowards?",
                "options": ["Hyenas", "Lions", "Vultures", "Jackals"],
                "correct": "A"
            },
            {
                "question": "What animal sprays Annie with water from its trunk?",
                "options": ["An elephant", "A hippo", "A rhino", "A buffalo"],
                "correct": "A"
            },
            {
                "question": "What bird leads the children to a beehive?",
                "options": ["A honey guide", "A vulture", "A hornbill", "A starling"],
                "correct": "A"
            },
            {
                "question": "What is the answer to Morgan's riddle?",
                "options": ["Honey", "Gold", "Amber", "Mango"],
                "correct": "A"
            },
            {
                "question": "How do Jack and Annie get past the pride of lions at the base of the tree?",
                "options": ["They stand beneath a giraffe and walk with it", "They sneak past quietly", "They distract the lions with food", "They climb down from above"],
                "correct": "A"
            }
        ]
    },
    # 16. Junie B. Jones and the Stupid Smelly Bus
    {
        "title": "Junie B. Jones and the Stupid Smelly Bus",
        "author": "Barbara Park",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What grade is Junie B. Jones about to start?",
                "options": ["Kindergarten", "First grade", "Preschool", "Second grade"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. insist on being called?",
                "options": ["Junie B., with the B", "Just Junie", "Juniper", "Beatrice"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. hate riding?",
                "options": ["The school bus", "The car", "The subway", "The train"],
                "correct": "A"
            },
            {
                "question": "Who does Junie B. meet on the bus that she dislikes?",
                "options": ["A boy named Jim", "A girl named Lucille", "A boy named William", "A girl named Grace"],
                "correct": "A"
            },
            {
                "question": "What does Lucille tell Junie B. happens on the bus ride home?",
                "options": ["Children pour chocolate milk on other children's heads", "Children throw food", "Children get pushed", "Children get sick"],
                "correct": "A"
            },
            {
                "question": "Where does Junie B. hide instead of getting on the bus to go home?",
                "options": ["A supply closet", "The library", "The bathroom", "Under a desk"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. do while exploring the school after everyone leaves?",
                "options": ["Pretends to be the teacher and the nurse", "Reads books", "Plays games", "Eats snacks"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. play with in the nurse's office that is too tall for her?",
                "options": ["Crutches", "A stethoscope", "A bandage", "A thermometer"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. do when she needs to use the restroom and all doors are locked?",
                "options": ["She calls 911", "She waits until morning", "She goes outside", "She finds a key"],
                "correct": "A"
            },
            {
                "question": "Who does Junie B.'s mother suggest she sit with on the bus the next day?",
                "options": ["A girl named Grace", "A girl named Lucille", "A boy named Jim", "Her brother"],
                "correct": "A"
            }
        ]
    },
    # 17. Junie B. Jones and a Little Monkey Business
    {
        "title": "Junie B. Jones and a Little Monkey Business",
        "author": "Barbara Park",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What exciting news does Junie B. get about her family?",
                "options": ["She is getting a new baby brother", "She is getting a puppy", "She is moving", "She is getting a new room"],
                "correct": "A"
            },
            {
                "question": "Where does Junie B. stay while the baby is being born?",
                "options": ["Her grandfather's house", "Her aunt's house", "A neighbor's house", "Her friend's house"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. eat while she is upset about the baby?",
                "options": ["A fat lemon pie", "A box of cookies", "Ice cream", "Pancakes"],
                "correct": "A"
            },
            {
                "question": "What does Junie B.'s grandmother tell her about the new baby?",
                "options": ["That he is a cute little monkey", "That he looks just like her", "That he has lots of hair", "That he is very small"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. believe her baby brother actually is?",
                "options": ["A real monkey", "An alien", "A doll", "A kitten"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. call her baby brother?",
                "options": ["Mr. Monkey", "Baby Ollie", "Gutzman", "Little Frank"],
                "correct": "A"
            },
            {
                "question": "Why do Junie B.'s friends Grace and Lucille give her fancy presents?",
                "options": ["To be the first to see her new baby brother", "Because it's her birthday", "Because they feel sorry for her", "Because she shared her lunch"],
                "correct": "A"
            },
            {
                "question": "What name does Junie B. want to give her baby brother?",
                "options": ["Gutzman", "Monkey", "Frank", "Ollie"],
                "correct": "A"
            },
            {
                "question": "Who is Miss Gutzman?",
                "options": ["Junie B.'s lunch lady", "Junie B.'s teacher", "Junie B.'s neighbor", "Junie B.'s grandmother"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. imagine lives under her bed?",
                "options": ["A droopy guy with claws", "A monster", "A snake", "A ghost"],
                "correct": "A"
            }
        ]
    },
    # 18. Junie B. Jones and Her Big Fat Mouth
    {
        "title": "Junie B. Jones and Her Big Fat Mouth",
        "author": "Barbara Park",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What special event does Mrs. announce in Room Nine?",
                "options": ["Job Day", "Career Week", "Show and Tell Day", "Dress-Up Day"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. tell her classmates she has?",
                "options": ["The bestest job of all", "A secret talent", "A new pet", "A special costume"],
                "correct": "A"
            },
            {
                "question": "What does Junie B. get for punishment in class?",
                "options": ["Time-out", "Extra homework", "Lost recess", "A note home"],
                "correct": "A"
            },
            {
                "question": "What does the janitor stop Junie B. from doing at recess?",
                "options": ["Eating cherry Life Savers off the ground", "Climbing a tree", "Fighting with Jim", "Running in the hall"],
                "correct": "A"
            },
            {
                "question": "What three jobs does Junie B. originally want to combine?",
                "options": ["Artist, someone with keys, and a superhero", "Doctor, pilot, and firefighter", "Teacher, nurse, and chef", "Painter, driver, and police officer"],
                "correct": "A"
            },
            {
                "question": "What job does Junie B. finally decide to dress up as for Job Day?",
                "options": ["A janitor", "A superhero", "An artist", "A police officer"],
                "correct": "A"
            },
            {
                "question": "What items does Junie B. bring for her Job Day costume?",
                "options": ["Keys and a paint brush", "A cape and a mask", "A stethoscope and a badge", "A brush and a helmet"],
                "correct": "A"
            },
            {
                "question": "What is the janitor's name who becomes Junie B.'s friend?",
                "options": ["Gus Vallony", "Mr. Meaner", "Mr. Krupp", "Mr. Pennycuff"],
                "correct": "A"
            },
            {
                "question": "Why are Junie B.'s parents too busy to help her?",
                "options": ["They are taking care of the new baby, Ollie", "They are working", "They are on vacation", "They are sick"],
                "correct": "A"
            },
            {
                "question": "How do the classmates react when Junie B. announces she wants to be a janitor?",
                "options": ["They laugh at her", "They cheer", "They are confused", "They are impressed"],
                "correct": "A"
            }
        ]
    },
    # 19. Notebook of Doom: Rise of the Balloon Goons
    {
        "title": "The Notebook of Doom: Rise of the Balloon Goons",
        "author": "Troy Cummings",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What is the name of the main character who moves to a new town?",
                "options": ["Alexander Bopp", "Henry Huggins", "Greg Heffley", "Jack Beard"],
                "correct": "A"
            },
            {
                "question": "What is the name of the town Alexander moves to?",
                "options": ["Stermont", "Springfield", "Sleepy Hollow", "Salem"],
                "correct": "A"
            },
            {
                "question": "What does Alexander find that is full of information about monsters?",
                "options": ["A notebook called the Notebook of Doom", "A secret diary", "An old map", "A mysterious book"],
                "correct": "A"
            },
            {
                "question": "What word is inscribed on the front cover of the notebook?",
                "options": ["DOOM", "MONSTERS", "DANGER", "BEWARE"],
                "correct": "A"
            },
            {
                "question": "Where is Alexander's new classroom temporarily located?",
                "options": ["In the hospital morgue", "In a church", "In a library", "In a gymnasium"],
                "correct": "A"
            },
            {
                "question": "What kind of monsters attack Alexander throughout the town?",
                "options": ["Balloon goons", "Shadow smashers", "Tunnel fish", "Forkupines"],
                "correct": "A"
            },
            {
                "question": "What are the balloon goons similar to?",
                "options": ["Those bendy balloon guys that businesses use", "Regular balloons", "Parade floats", "Hot air balloons"],
                "correct": "A"
            },
            {
                "question": "What does Alexander's teacher nickname him?",
                "options": ["Salamander Snott", "Al", "Alexander the Great", "Bopp"],
                "correct": "A"
            },
            {
                "question": "Who becomes Alexander's friend and ally against the balloon goons?",
                "options": ["Rip Bonkowski", "Dottie Rogers", "Mr. Plunkett", "Mr. Hoarsely"],
                "correct": "A"
            },
            {
                "question": "How is the balloon goon fortress finally defeated?",
                "options": ["Alexander's dad pops their fortress", "Alexander uses a pin", "Rain deflates them", "They pop on their own"],
                "correct": "A"
            }
        ]
    },
    # 20. Notebook of Doom: Day of the Night Crawlers
    {
        "title": "The Notebook of Doom: Day of the Night Crawlers",
        "author": "Troy Cummings",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What strange creatures appear all over Stermont after it rains?",
                "options": ["Worms called night crawlers", "Slugs", "Frogs", "Snails"],
                "correct": "A"
            },
            {
                "question": "What does Alexander's father cook him for breakfast on a rainy morning?",
                "options": ["A smiley-face without a mouth", "Pancakes", "Oatmeal", "Toast and eggs"],
                "correct": "A"
            },
            {
                "question": "What completes the smiley face on Alexander's breakfast plate?",
                "options": ["A worm flops on his plate", "A piece of bacon", "A drop of syrup", "A berry"],
                "correct": "A"
            },
            {
                "question": "What does Alexander suspect the worms might be?",
                "options": ["Megaworms described in the Notebook of Doom", "Aliens", "Poisonous creatures", "Regular earthworms"],
                "correct": "A"
            },
            {
                "question": "What new monsters are threatening Stermont Elementary?",
                "options": ["Giant fish monsters called tunnel fish", "Giant bugs", "Underground worms", "Shadow creatures"],
                "correct": "A"
            },
            {
                "question": "What is the name of the human-sized fish monster that can speak English?",
                "options": ["Fish-Kabob", "Tunnel Fish", "Mega Worm", "Bubble-Wrap Warrior"],
                "correct": "A"
            },
            {
                "question": "Who does the Fish-Kabob monster masquerade as at the school?",
                "options": ["The gym teacher", "The principal", "The librarian", "The janitor"],
                "correct": "A"
            },
            {
                "question": "What do Alexander and Rip try to learn more about?",
                "options": ["The monster-filled notebook", "The town's history", "The hospital morgue", "The water tower"],
                "correct": "A"
            },
            {
                "question": "What do the night crawlers turn out to be trying to do?",
                "options": ["Warn Alexander and Rip about the tunnel fish", "Attack the school", "Take over the town", "Find food"],
                "correct": "A"
            },
            {
                "question": "What does S.S.M.P. stand for?",
                "options": ["Super Secret Monster Patrol", "Super Strong Monster Patrol", "Secret Society of Monster Protectors", "Stermont's Secret Monster Patrol"],
                "correct": "A"
            }
        ]
    },
    # 21. Ivy and Bean
    {
        "title": "Ivy and Bean",
        "author": "Annie Barrows",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What is Bean's real first name?",
                "options": ["Bernice", "Beatrice", "Barbara", "Brianna"],
                "correct": "A"
            },
            {
                "question": "Where do Bean and Ivy both live?",
                "options": ["Pancake Court", "Maple Street", "Cul-de-sac Lane", "Birch Court"],
                "correct": "A"
            },
            {
                "question": "Who is Bean's older sister?",
                "options": ["Nancy", "Ivy", "Sophie", "Mary Jane"],
                "correct": "A"
            },
            {
                "question": "Why does Bean's mother think Bean should play with Ivy?",
                "options": ["Because she thinks Ivy is a nice girl", "Because they are the same age", "Because Ivy is lonely", "Because Bean has no other friends"],
                "correct": "A"
            },
            {
                "question": "What does Bean think about Ivy before they become friends?",
                "options": ["That Ivy looks boring", "That Ivy is mean", "That Ivy is too smart", "That Ivy is weird"],
                "correct": "A"
            },
            {
                "question": "What does Bean take from Nancy's purse?",
                "options": ["A $20 bill", "A bracelet", "A phone", "Lipstick"],
                "correct": "A"
            },
            {
                "question": "What is Ivy studying to become?",
                "options": ["A witch", "A fairy", "A wizard", "A sorceress"],
                "correct": "A"
            },
            {
                "question": "What kind of spell do Bean and Ivy decide to cast on Nancy?",
                "options": ["A dancing spell that makes a person dance forever", "A sleeping spell", "An invisibility spell", "A silence spell"],
                "correct": "A"
            },
            {
                "question": "What do the girls need to collect for the dancing spell?",
                "options": ["A handful of worms", "Dead frogs", "Spider webs", "Flower petals"],
                "correct": "A"
            },
            {
                "question": "Where does Nancy fall when she chases Bean and Ivy?",
                "options": ["Into the pit where they collected the worms", "Into a puddle", "Down the stairs", "Into a bush"],
                "correct": "A"
            }
        ]
    },
    # 22. Ivy and Bean and the Ghost That Had to Go
    {
        "title": "Ivy and Bean and the Ghost That Had to Go",
        "author": "Annie Barrows",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Where does Ivy discover a ghost?",
                "options": ["In the school bathroom", "In the cafeteria", "In the library", "In the gym"],
                "correct": "A"
            },
            {
                "question": "What does Ivy first notice about the bathroom?",
                "options": ["A white mist coming from the air vent", "Strange noises", "Cold temperatures", "A foul smell"],
                "correct": "A"
            },
            {
                "question": "What is the name of Ivy and Bean's teacher?",
                "options": ["Ms. Aruba-Tate", "Mrs. Noble", "Mrs. Quimby", "Ms. Ribble"],
                "correct": "A"
            },
            {
                "question": "What does Ivy originally distract her classmates from?",
                "options": ["Her lack of cartwheeling skills", "A test she failed", "Her new shoes", "A bad grade"],
                "correct": "A"
            },
            {
                "question": "What does Ivy use to try to expel the ghost?",
                "options": ["A special potion and ceremony", "A spell from a book", "A magic wand", "A séance"],
                "correct": "A"
            },
            {
                "question": "What does Ivy wear when she performs the ghost-banishing spell?",
                "options": ["A cape and goth-inspired makeup", "A witch costume", "A white robe", "A mask"],
                "correct": "A"
            },
            {
                "question": "What do Ivy and Bean give the ghost as presents for its trip?",
                "options": ["They flush presents down the toilet", "They leave them by the vent", "They bury them outside", "They put them in the sink"],
                "correct": "A"
            },
            {
                "question": "What happens when Ivy and Bean perform their potion ceremony?",
                "options": ["The toilet overflows", "Nothing happens", "The ghost appears", "The bathroom catches fire"],
                "correct": "A"
            },
            {
                "question": "Who is Bean's older sister that they try to mess with?",
                "options": ["Nancy", "Ivy", "Sophie", "Mary Jane"],
                "correct": "A"
            },
            {
                "question": "What does their teacher tell Ivy about using imagination?",
                "options": ["That some stories can be harmful and they must use their imaginations responsibly", "That imagination is not real", "That ghosts don't exist", "That she should stop making up stories"],
                "correct": "A"
            }
        ]
    },
    # 23. Ramona Quimby, Age 8
    {
        "title": "Ramona Quimby, Age 8",
        "author": "Beverly Cleary",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What grade is Ramona starting in this book?",
                "options": ["Third grade", "Second grade", "Fourth grade", "Fifth grade"],
                "correct": "A"
            },
            {
                "question": "What does Mr. Quimby give Beezus and Ramona for good luck?",
                "options": ["New pink erasers", "New pencils", "New notebooks", "New shoes"],
                "correct": "A"
            },
            {
                "question": "Who does Ramona spend afternoons with after school?",
                "options": ["Howie Kemp's grandmother and his sister Willa Jean", "Her grandmother", "A babysitter", "Her aunt Beatrice"],
                "correct": "A"
            },
            {
                "question": "What does Mrs. Whaley call the reading time at school?",
                "options": ["D.E.A.R. time - Drop Everything and Read", "Quiet Reading Time", "Free Reading", "Silent Study"],
                "correct": "A"
            },
            {
                "question": "What happens when Ramona tries to crack an egg on her head at lunch?",
                "options": ["The egg is raw and splatters over her face and hair", "The egg cracks perfectly", "Nothing happens", "The egg is already peeled"],
                "correct": "A"
            },
            {
                "question": "What does Ramona overhear Mrs. Whaley calling her?",
                "options": ["A show-off and a nuisance", "A troublemaker", "A brat", "Annoying"],
                "correct": "A"
            },
            {
                "question": "What does Mr. Quimby punish Beezus and Ramona for by making them cook dinner?",
                "options": ["Refusing to eat tongue for dinner", "Fighting with each other", "Breaking a dish", "Being late"],
                "correct": "A"
            },
            {
                "question": "What happens to Ramona at school that makes her vomit?",
                "options": ["She sees the jars of fly larvae in blue oatmeal", "She eats bad food", "She gets too hot", "She is nervous"],
                "correct": "A"
            },
            {
                "question": "What kind of presentation does Ramona give for her book report?",
                "options": ["A cat-food commercial", "A puppet show", "A song", "A play"],
                "correct": "A"
            },
            {
                "question": "What happens at the Whopperburger restaurant?",
                "options": ["An old man pays for the family's meal", "Ramona drops her hamburger", "The family gets free dessert", "They meet their teacher"],
                "correct": "A"
            }
        ]
    },
    # 24. Beezus and Ramona
    {
        "title": "Beezus and Ramona",
        "author": "Beverly Cleary",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "How old is Beezus in this book?",
                "options": ["Nine years old", "Eight years old", "Ten years old", "Seven years old"],
                "correct": "A"
            },
            {
                "question": "How old is Ramona in this book?",
                "options": ["Four years old", "Three years old", "Five years old", "Six years old"],
                "correct": "A"
            },
            {
                "question": "What is Ramona's favorite book about?",
                "options": ["A forlorn steam shovel named Scoopy", "A magic garden", "A fairy princess", "A talking dog"],
                "correct": "A"
            },
            {
                "question": "What does Ramona wear to the library that embarrasses Beezus?",
                "options": ["Paper rabbit ears", "A costume", "Mismatched shoes", "A tutu"],
                "correct": "A"
            },
            {
                "question": "What does Ramona do to the library book?",
                "options": ["She signs her name on every page", "She tears out pages", "She spills food on it", "She loses it"],
                "correct": "A"
            },
            {
                "question": "What imaginary animal does Ramona bring to Beezus's art class?",
                "options": ["An imaginary lizard named Ralph", "An imaginary dog", "An imaginary dragon", "An imaginary bird"],
                "correct": "A"
            },
            {
                "question": "What does Beezus discover Ramona has done to the apples in the basement?",
                "options": ["Taken a bite out of every apple", "Painted them all", "Smashed them", "Hidden them"],
                "correct": "A"
            },
            {
                "question": "What do Beezus and Ramona make from the damaged apples?",
                "options": ["Applesauce", "Apple pie", "Apple juice", "Apple cider"],
                "correct": "A"
            },
            {
                "question": "What does Ramona do to Beezus's birthday cake?",
                "options": ["Puts her doll in the oven while it's baking", "Drops it on the floor", "Eats it", "Hides it"],
                "correct": "A"
            },
            {
                "question": "Who saves Beezus's birthday celebration?",
                "options": ["Aunt Beatrice", "Mrs. Quimby", "Henry", "Mr. Quimby"],
                "correct": "A"
            }
        ]
    },
    # 25. Henry Huggins
    {
        "title": "Henry Huggins",
        "author": "Beverly Cleary",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What does Henry find while waiting for the bus?",
                "options": ["A skinny stray dog", "A lost kitten", "A dollar bill", "A bicycle"],
                "correct": "A"
            },
            {
                "question": "What does Henry name the stray dog?",
                "options": ["Ribsy", "Scoopy", "Dizzy", "Puddles"],
                "correct": "A"
            },
            {
                "question": "Why does Henry name the dog Ribsy?",
                "options": ["Because the dog is so thin Henry can see his ribs", "Because the dog likes ribs", "Because of his ribs of fur", "Because he found him near a rib joint"],
                "correct": "A"
            },
            {
                "question": "What does Henry buy at the pet store that keeps multiplying?",
                "options": ["Guppies", "Goldfish", "Hamsters", "Sea monkeys"],
                "correct": "A"
            },
            {
                "question": "What does Ribsy eat that Henry was bringing home from the pet store?",
                "options": ["Horse meat", "Dog food", "Fish food", "A bone"],
                "correct": "A"
            },
            {
                "question": "What does Henry accidentally do with Scooter's football?",
                "options": ["Throws it into a passing car window", "Kicks it over a fence", "Loses it in a river", "Pops it"],
                "correct": "A"
            },
            {
                "question": "How does Henry earn money to replace the football?",
                "options": ["Collecting night crawler worms for fishing bait", "Mowing lawns", "Selling lemonade", "Doing chores"],
                "correct": "A"
            },
            {
                "question": "What happens to Henry during the school Christmas play?",
                "options": ["Ribsy spills green paint on Henry's head", "Henry forgets his lines", "Henry trips on stage", "His costume tears"],
                "correct": "A"
            },
            {
                "question": "What prize does Ribsy win at the dog show?",
                "options": ["Most unusual dog", "Best in show", "Fastest dog", "Best trick"],
                "correct": "A"
            },
            {
                "question": "When a boy claims Ribsy is his lost dog, how do they decide who keeps him?",
                "options": ["They let Ribsy choose between them", "They flip a coin", "They have a race", "They ask a judge"],
                "correct": "A"
            }
        ]
    }
]

# Verify all books have exactly 10 questions and correct answers are distributed
for i, book in enumerate(quizzes):
    assert len(book["questions"]) == 10, f"Book {i+1} ({book['title']}) has {len(book['questions'])} questions, expected 10"
    answers = [q["correct"] for q in book["questions"]]
    assert all(a in ["A", "B", "C", "D"] for a in answers), f"Invalid answer in book {i+1}"
    # Check distribution
    from collections import Counter
    dist = Counter(answers)
    # Ensure at least 2 of each letter
    for letter in ["A", "B", "C", "D"]:
        if dist[letter] < 2:
            print(f"WARNING: Book {i+1} ({book['title']}) has only {dist[letter]} answers for {letter}")

print(f"Total books: {len(quizzes)}")
print(f"Total questions: {sum(len(b['questions']) for b in quizzes)}")

# Save to file
with open("/home/user/workspace/bookquiz/quizzes_batch_3.json", "w") as f:
    json.dump(quizzes, f, indent=2)

print("Saved to /home/user/workspace/bookquiz/quizzes_batch_3.json")
