import json

questions = [
    {
        "title": "Walk Two Moons",
        "questions": [
            {
                "question_text": "What is the full name of the main character in Walk Two Moons?",
                "option_a": "Salamanca Tree Hiddle",
                "option_b": "Samanca Moon Hiddle",
                "option_c": "Salamanca Leaf Hiddle",
                "option_d": "Sal Tree Hiddle",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "Why does Sal travel with her grandparents from Ohio to Idaho?",
                "option_a": "To visit a national park",
                "option_b": "To find her mother, who left home",
                "option_c": "To attend a family wedding",
                "option_d": "To move to a new house",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "What does Phoebe, Sal's friend, claim to see in her neighborhood?",
                "option_a": "A ghost",
                "option_b": "A potential lunatic",
                "option_c": "A runaway dog",
                "option_d": "A shooting star",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "What is the name of Sal's father?",
                "option_b": "John Hiddle",
                "option_a": "Gram Hiddle",
                "option_c": "Thomas Hiddle",
                "option_d": "James Hiddle",
                "correct_answer": "c",
                "question_order": 4
            },
            {
                "question_text": "What does Sal's mother do before she leaves home?",
                "option_a": "She writes a letter",
                "option_b": "She leaves a note and kisses Sal goodbye",
                "option_c": "She argues with Sal's father",
                "option_d": "She packs all her belongings",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What happens to Gram Hiddle during the road trip?",
                "option_a": "She gets lost in a city",
                "option_b": "She is bitten by a snake",
                "option_c": "She loses her wallet",
                "option_d": "She wins a prize",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "Where does Sal's mother go when she leaves home?",
                "option_a": "Lewiston, Idaho",
                "option_b": "Bybanks, Kentucky",
                "option_c": "Euclid, Ohio",
                "option_d": "Chicago, Illinois",
                "correct_answer": "a",
                "question_order": 7
            },
            {
                "question_text": "What is the significance of the title 'Walk Two Moons'?",
                "option_a": "Sal walks by moonlight twice",
                "option_b": "It refers to a Native American proverb about walking in someone else's moccasins",
                "option_c": "Sal sees two moons in the sky",
                "option_d": "The road trip takes two months",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What does Sal do when she finally reaches Lewiston, Idaho?",
                "option_a": "She finds her mother alive and well",
                "option_b": "She learns her mother died in a bus accident",
                "option_c": "She meets her mother at a hospital",
                "option_d": "She decides to go home without looking",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What does Sal's friend Phoebe believe about her mother's disappearance?",
                "option_a": "That her mother was kidnapped",
                "option_b": "That her mother went shopping",
                "option_c": "That her mother left voluntarily",
                "option_d": "That her mother moved to Europe",
                "correct_answer": "a",
                "question_order": 10
            }
        ]
    },
    {
        "title": "The Wanderer",
        "questions": [
            {
                "question_text": "What is the name of the boat in The Wanderer?",
                "option_a": "The Seeker",
                "option_b": "The Wanderer",
                "option_c": "The Voyager",
                "option_d": "The Adventurer",
                "correct_answer": "b",
                "question_order": 1
            },
            {
                "question_text": "Who is the main character that sails across the Atlantic?",
                "option_a": "Sophie",
                "option_b": "Cody",
                "option_c": "Brian",
                "option_d": "Dock",
                "correct_answer": "a",
                "question_order": 2
            },
            {
                "question_text": "Who are the adults on the sailing trip with Sophie?",
                "option_b": "Her three uncles: Dock, Mo, and Stew",
                "option_a": "Her parents and grandparents",
                "option_c": "Her teachers and coaches",
                "option_d": "Her neighbors and family friends",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "What is Sophie's relationship to the uncles on the boat?",
                "option_a": "She is their niece",
                "option_b": "She is their daughter",
                "option_c": "She is their cousin",
                "option_d": "She is their granddaughter",
                "correct_answer": "a",
                "question_order": 4
            },
            {
                "question_text": "What does Sophie discover about her own past during the journey?",
                "option_a": "She was adopted and her real parents died",
                "option_b": "She was a champion sailor",
                "option_c": "She has a twin brother",
                "option_d": "She is afraid of water",
                "correct_answer": "a",
                "question_order": 5
            },
            {
                "question_text": "Who is Cody, one of Sophie's cousins on the trip?",
                "option_a": "A serious and studious boy",
                "option_b": "A prankster who likes to joke around",
                "option_c": "A shy boy who stays below deck",
                "option_d": "An experienced sailor",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What is the destination of the boat's voyage?",
                "option_a": "England",
                "option_b": "France",
                "option_c": "Ireland",
                "option_d": "Spain",
                "correct_answer": "a",
                "question_order": 7
            },
            {
                "question_text": "What does Sophie tell the others about her childhood?",
                "option_a": "She grew up in England",
                "option_b": "She says her parents died in a car accident and she was adopted",
                "option_c": "She lived on a boat her whole life",
                "option_d": "She was raised by her grandmother",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What major challenge does the crew face during the voyage?",
                "option_a": "A pirate attack",
                "option_b": "A massive storm that nearly destroys the boat",
                "option_c": "Running out of food",
                "option_d": "Getting lost at sea",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What is Sophie's uncle Dock's profession?",
                "option_a": "He is a fisherman",
                "option_b": "He is a carpenter",
                "option_c": "He is a doctor",
                "option_d": "He is a teacher",
                "correct_answer": "c",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Love That Dog",
        "questions": [
            {
                "question_text": "Who is the main character of Love That Dog?",
                "option_a": "Jack",
                "option_b": "Walter",
                "option_c": "Sky",
                "option_d": "Dean",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What is the name of Jack's dog?",
                "option_a": "Blue",
                "option_b": "Sky",
                "option_c": "Yellow",
                "option_d": "Leaf",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "What happens to Jack's dog Sky?",
                "option_a": "Sky runs away",
                "option_b": "Sky gets lost",
                "option_c": "Sky is killed by a car",
                "option_d": "Sky is given away",
                "correct_answer": "c",
                "question_order": 3
            },
            {
                "question_text": "Which famous poet does Jack come to admire through his teacher's lessons?",
                "option_a": "Robert Frost",
                "option_b": "Walter Dean Myers",
                "option_c": "Shel Silverstein",
                "option_d": "Emily Dickinson",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "What is Jack's initial attitude toward writing poetry?",
                "option_a": "He loves it immediately",
                "option_b": "He thinks boys don't write poetry",
                "option_c": "He finds it boring",
                "option_d": "He is afraid to try",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What does Jack's teacher, Miss Stretchberry, do to encourage him?",
                "option_a": "She forces him to read aloud",
                "option_b": "She types up his poems and shares them with the class",
                "option_c": "She gives him extra homework",
                "option_d": "She enters his poems in a contest",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What poem does Jack model his poem about Sky after?",
                "option_a": "A poem by Robert Frost about nature",
                "option_b": "A poem by Walter Dean Myers called 'Love That Boy'",
                "option_c": "A poem by Shel Silverstein",
                "option_d": "A poem by William Carlos Williams",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "How does the book Love That Dog present its story?",
                "option_a": "As a series of diary entries",
                "option_b": "As a series of poems written by Jack over the school year",
                "option_c": "As letters to a pen pal",
                "option_d": "As a traditional narrative",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What does Jack eventually want to do that shows his growth as a writer?",
                "option_a": "Write a novel",
                "option_b": "Invite Walter Dean Myers to visit his school",
                "option_c": "Publish his own book",
                "option_d": "Teach poetry to younger kids",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What color is Jack's dog Sky?",
                "option_a": "Black",
                "option_b": "White",
                "option_c": "Brown",
                "option_d": "Golden",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Bloomability",
        "questions": [
            {
                "question_text": "What is the name of the main character in Bloomability?",
                "option_a": "Dinnie",
                "option_b": "Sophie",
                "option_c": "Stella",
                "option_d": "Gretchen",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What is Dinnie's full name?",
                "option_a": "Donna Doone",
                "option_b": "Dinnie Doone",
                "option_c": "Dinah Doone",
                "option_d": "Daphne Doone",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "Where do Dinnie's aunt and uncle take her?",
                "option_a": "France",
                "option_b": "Italy",
                "option_c": "Switzerland",
                "option_d": "England",
                "correct_answer": "c",
                "question_order": 3
            },
            {
                "question_text": "What do Dinnie's aunt and uncle do for a living?",
                "option_a": "They run a hotel",
                "option_b": "They work at an international school in Switzerland",
                "option_c": "They are diplomats",
                "option_d": "They are scientists",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "Why does Dinnie call her time in Switzerland a 'kidnapping'?",
                "option_a": "Because she was taken against her will",
                "option_b": "Because her parents sold her",
                "option_c": "Because she was literally abducted",
                "option_d": "Because she got lost",
                "correct_answer": "a",
                "question_order": 5
            },
            {
                "question_text": "Who is the boy Dinnie befriends at the school?",
                "option_a": "Lila",
                "option_b": "Guthrie",
                "option_c": "Keisuke",
                "option_d": "Bella",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What natural event does Dinnie witness in Switzerland?",
                "option_a": "An earthquake",
                "option_b": "An avalanche",
                "option_c": "A volcanic eruption",
                "option_d": "A tornado",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "What does the word 'bloomability' represent in the story?",
                "option_a": "The ability to grow and bloom as a person",
                "option_b": "A type of flower in Switzerland",
                "option_c": "A school subject",
                "option_d": "A nickname for Dinnie",
                "correct_answer": "a",
                "question_order": 8
            },
            {
                "question_text": "Where does Dinnie live before going to Switzerland?",
                "option_a": "New York City",
                "option_b": "She moves constantly because her family follows opportunities around the US",
                "option_c": "A small town in Ohio",
                "option_d": "A farm in Texas",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What does Dinnie ultimately realize about her time in Switzerland?",
                "option_a": "That she wants to stay forever",
                "option_b": "That it was a wonderful opportunity that helped her grow",
                "option_c": "That she never wants to return",
                "option_d": "That she wasted her time",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "The School for Good and Evil",
        "questions": [
            {
                "question_text": "Who are the two main characters kidnapped to the School for Good and Evil?",
                "option_a": "Sophie and Agatha",
                "option_b": "Rosalind and Emma",
                "option_c": "Beatrix and Hortensia",
                "option_d": "Cecilia and Dot",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "Which girl is beautiful and dreams of being a princess?",
                "option_a": "Agatha",
                "option_b": "Sophie",
                "option_c": "Hester",
                "option_d": "Dot",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "Which girl is dark and gloomy, living in a graveyard?",
                "option_a": "Sophie",
                "option_b": "Agatha",
                "option_c": "Beatrix",
                "option_d": "Milly",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "What happens when Sophie and Agatha arrive at the school?",
                "option_a": "They are both placed in the School for Good",
                "option_b": "Sophie is placed in the School for Evil and Agatha in the School for Good",
                "option_c": "They are both placed in the School for Evil",
                "option_d": "They are sent home",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "What are students at the School for Good called?",
                "option_a": "Princes",
                "option_b": "Evers",
                "option_c": "Heroes",
                "option_d": "Glows",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What are students at the School for Evil called?",
                "option_a": "Nevers",
                "option_b": "Villains",
                "option_c": "Shadows",
                "option_d": "Curseds",
                "correct_answer": "a",
                "question_order": 6
            },
            {
                "question_text": "Who is the schoolmaster of the School for Good and Evil?",
                "option_a": "Professor Dovey",
                "option_b": "Leonora Lesso",
                "option_c": "The School Master, a mysterious masked figure",
                "option_d": "Lady Lesso",
                "correct_answer": "c",
                "question_order": 7
            },
            {
                "question_text": "What is the main competition the students must prepare for?",
                "option_a": "A magical duel",
                "option_b": "The Snow Ball, where Evers and Nevers are paired",
                "option_c": "A written exam",
                "option_d": "A talent show",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "Who is the prince that Sophie is determined to win?",
                "option_a": "Tedros",
                "option_b": "Chaddick",
                "option_c": "Hort",
                "option_d": "Tristan",
                "correct_answer": "a",
                "question_order": 9
            },
            {
                "question_text": "What is the ultimate twist about Sophie's true nature?",
                "option_a": "She is actually a witch",
                "option_b": "She becomes the most powerful villain, proving she truly belongs in Evil",
                "option_c": "She is revealed to be a princess",
                "option_d": "She is a fairy in disguise",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "The Tiger Rising",
        "questions": [
            {
                "question_text": "What is the name of the main character in The Tiger Rising?",
                "option_a": "Rob Horton",
                "option_b": "Sistine Bailey",
                "option_c": "Beauchamp",
                "option_d": "Willie Mae",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What does Rob discover in the woods near the motel?",
                "option_a": "A dead deer",
                "option_b": "A caged tiger",
                "option_c": "A lost dog",
                "option_d": "A hidden treasure",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "Who is the girl that Rob befriends at school?",
                "option_a": "Sistine Bailey",
                "option_b": "Nattie",
                "option_c": "Caroline",
                "option_d": "Maisie",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "What physical condition does Rob suffer from on his legs?",
                "option_a": "A rash",
                "option_b": "He has a mysterious skin condition that won't go away",
                "option_c": "Burns",
                "option_d": "Bruises",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "Who owns the tiger in the story?",
                "option_a": "Rob's father",
                "option_b": "Beauchamp, the motel owner",
                "option_c": "Sistine's father",
                "option_d": "The sheriff",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What does Rob do to cope with his problems?",
                "option_a": "He writes in a journal",
                "option_b": "He makes a suitcase of 'not-thoughts' to keep painful feelings locked away",
                "option_c": "He runs away",
                "option_d": "He talks to his father",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What does Sistine want to do with the tiger?",
                "option_a": "Keep it as a pet",
                "option_b": "Free it",
                "option_c": "Sell it",
                "option_d": "Tell the police",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "What happened to Rob's mother?",
                "option_a": "She left the family",
                "option_b": "She died of cancer",
                "option_c": "She moved away",
                "option_d": "She is in prison",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What does Rob's father give him to help with his legs?",
                "option_a": "Medicine",
                "option_b": "A prayer or faith healing, which clears up the condition",
                "option_c": "A special cream",
                "option_d": "New shoes",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What ultimately happens to the tiger?",
                "option_a": "It escapes on its own",
                "option_b": "Rob's father shoots it",
                "option_c": "It is taken to a zoo",
                "option_d": "Sistine frees it",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "The Miraculous Journey of Edward Tulane",
        "questions": [
            {
                "question_text": "What kind of toy is Edward Tulane?",
                "option_a": "A teddy bear",
                "option_b": "A china rabbit",
                "option_c": "A wooden doll",
                "option_d": "A porcelain cat",
                "correct_answer": "b",
                "question_order": 1
            },
            {
                "question_text": "Who is Edward's first and most devoted owner?",
                "option_a": "Abilene Tulane",
                "option_b": "Nellie",
                "option_c": "Bryce",
                "option_d": "Sarah Ruth",
                "correct_answer": "a",
                "question_order": 2
            },
            {
                "question_text": "What happens to Edward during a sea voyage?",
                "option_a": "He gets lost in the ship",
                "option_b": "He is thrown overboard by boys who annoy Abilene",
                "option_c": "He is stolen by a passenger",
                "option_d": "He falls from a deck",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "Who rescues Edward from the ocean?",
                "option_a": "A fisherman",
                "option_b": "A sailor",
                "option_c": "A little girl",
                "option_d": "A dolphin",
                "correct_answer": "a",
                "question_order": 4
            },
            {
                "question_text": "What is Edward's main character flaw at the beginning of the story?",
                "option_a": "He is cowardly",
                "option_b": "He is vain and does not love anyone",
                "option_c": "He is mean",
                "option_d": "He is lazy",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What does Edward learn through his various owners?",
                "option_a": "How to speak",
                "option_b": "How to love and open his heart",
                "option_c": "How to find his way home",
                "option_d": "How to be brave",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "Who is the old woman who tells Edward she has been waiting for him?",
                "option_a": "Nellie",
                "option_b": "A witch",
                "option_c": "An old doll in a doll shop",
                "option_d": "Abilene's grandmother",
                "correct_answer": "c",
                "question_order": 7
            },
            {
                "question_text": "Who is Bryce, one of Edward's owners?",
                "option_a": "A boy who carries Edward and makes him dance like a puppet",
                "option_b": "A fisherman's son",
                "option_c": "A rich boy",
                "option_d": "A street musician",
                "correct_answer": "a",
                "question_order": 8
            },
            {
                "question_text": "Who is Sarah Ruth, another of Edward's owners?",
                "option_a": "A princess",
                "option_b": "A little girl who is sick and dies",
                "option_c": "A doll maker",
                "option_d": "An old woman",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "How does Edward's journey end?",
                "option_a": "He is put in a museum",
                "option_b": "He is repaired and bought by Abilene, now grown, reuniting with his original owner",
                "option_c": "He stays in the doll shop",
                "option_d": "He is given to a museum",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Flora and Ulysses",
        "questions": [
            {
                "question_text": "What kind of animal is Ulysses?",
                "option_a": "A cat",
                "option_b": "A squirrel",
                "option_c": "A dog",
                "option_d": "A rabbit",
                "correct_answer": "b",
                "question_order": 1
            },
            {
                "question_text": "How does Ulysses gain superpowers?",
                "option_a": "He is struck by lightning",
                "option_b": "He is sucked into a vacuum cleaner",
                "option_c": "He drinks a magic potion",
                "option_d": "He is bitten by a radioactive bug",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "What is the full name of the girl who rescues Ulysses?",
                "option_a": "Flora Belle Buckman",
                "option_b": "Flora Rose Buckman",
                "option_c": "Flora Jane Buckman",
                "option_d": "Flora Mae Buckman",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "What does Flora's mother want her to do about Ulysses?",
                "option_a": "Keep him as a pet",
                "option_b": "Get rid of him",
                "option_c": "Take him to the vet",
                "option_d": "Enter him in a contest",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "What kind of stories does Flora read that help her understand Ulysses?",
                "option_a": "Fairy tales",
                "option_b": "Comic books, especially about a superhero called the Illuminated Adventures",
                "option_c": "Science fiction novels",
                "option_d": "Mystery novels",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What does Ulysses demonstrate he can do that proves his powers?",
                "option_a": "Fly",
                "option_b": "Write poetry and demonstrate super strength",
                "option_c": "Talk to humans",
                "option_d": "Turn invisible",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "Who is William Spiver, the boy who helps Flora?",
                "option_a": "Her cousin",
                "option_b": "A neighbor boy who is temporarily living with his great-aunt",
                "option_c": "Her classmate",
                "option_d": "A boy from a comic book",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "What does Flora's mother try to do to Ulysses?",
                "option_a": "Sell him",
                "option_b": "Kill him with a shovel",
                "option_c": "Give him to a zoo",
                "option_d": "Take him to a shelter",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What is the name of the vacuum cleaner that gave Ulysses his powers?",
                "option_a": "Ulysses 2000X",
                "option_b": "The Dyson",
                "option_c": "The Tornado",
                "option_d": "The Super Sucker",
                "correct_answer": "a",
                "question_order": 9
            },
            {
                "question_text": "What is Flora's parents' relationship like?",
                "option_a": "They are happily married",
                "option_b": "They are divorced",
                "option_c": "They are separated",
                "option_d": "They are remarried to others",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Raymie Nightingale",
        "questions": [
            {
                "question_text": "What is the full name of the main character?",
                "option_a": "Raymie Clarke",
                "option_b": "Raymie Nightingale",
                "option_c": "Raymie Harrison",
                "option_d": "Raymie Bennett",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "Why does Raymie enter the Little Miss Central Florida Tire contest?",
                "option_a": "To become famous",
                "option_b": "So her father, who left, will see her picture in the paper and come home",
                "option_c": "To win money",
                "option_d": "Because her mother wants her to",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "What are the names of the two other girls Raymie befriends?",
                "option_a": "Beverly Tapinski and Louisiana Elefante",
                "option_b": "Beverly Hill and Louise Grant",
                "option_c": "Betty Tapinski and Lucy Elefante",
                "option_d": "Brenda Tapp and Lola Elsworth",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "What is Louisiana Elefante known for?",
                "option_a": "Being a great swimmer",
                "option_b": "Having a mysterious past and being kidnapped by her grandmother",
                "option_c": "Being a talented singer",
                "option_d": "Being very wealthy",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "What does Beverly Tapinski want to do?",
                "option_a": "Win the contest",
                "option_b": "Sabotage the contest",
                "option_c": "Run away",
                "option_d": "Become a nurse",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What does Raymie plan to do as her talent for the contest?",
                "option_a": "Sing a song",
                "option_b": "Twirl a baton",
                "option_c": "Dance",
                "option_d": "Recite a poem",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "Who teaches Raymie to twirl the baton?",
                "option_a": "Her mother",
                "option_b": "Ida Nee, a former baton twirling champion",
                "option_c": "Her grandmother",
                "option_d": "Beverly",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "What happens at the Golden Acres nursing home?",
                "option_a": "The girls volunteer there",
                "option_b": "Raymie reads to an old woman who dies, and she realizes she can save people",
                "option_c": "They find Raymie's father there",
                "option_d": "They perform their baton routine",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "Why does Raymie call herself 'Raymie Nightingale'?",
                "option_a": "Her last name is Nightingale",
                "option_b": "She compares herself to Florence Nightingale, deciding she can save people",
                "option_c": "It is her stage name",
                "option_d": "Her grandmother gave her the nickname",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What is the name of the cat that Louisiana cares for?",
                "option_a": "Archie",
                "option_b": "Bunny",
                "option_c": "Whiskers",
                "option_d": "Swanky",
                "correct_answer": "a",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Louisiana's Way Home",
        "questions": [
            {
                "question_text": "Who is the main character of Louisiana's Way Home?",
                "option_a": "Louisiana Elefante",
                "option_b": "Raymie Clarke",
                "option_c": "Beverly Tapinski",
                "option_d": "Louisiana Nightingale",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "Where does Louisiana's grandmother take her in the middle of the night?",
                "option_a": "To Florida",
                "option_b": "To Georgia",
                "option_c": "To Tennessee",
                "option_d": "To Texas",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "Why does Louisiana's grandmother take her away from Florida?",
                "option_a": "Because they are moving",
                "option_b": "Because the date of destiny has arrived and they must leave",
                "option_c": "Because they are being evicted",
                "option_d": "Because of a family emergency",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "What happens to Louisiana's grandmother's toothache?",
                "option_a": "It gets better",
                "option_b": "She pulls her own tooth with pliers and gets an infection",
                "option_c": "She goes to a dentist",
                "option_d": "She ignores it",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "Where does Louisiana end up when her grandmother is hospitalized?",
                "option_a": "At a motel run by a kind couple",
                "option_b": "On the streets",
                "option_c": "At a children's shelter",
                "option_d": "With distant relatives",
                "correct_answer": "a",
                "question_order": 5
            },
            {
                "question_text": "Who are the couple that take Louisiana in?",
                "option_a": "Burke and his wife",
                "option_b": "Jerry and Betty",
                "option_c": "Allen and Bertha Pinkney",
                "option_d": "Clarence and Ethel",
                "correct_answer": "c",
                "question_order": 6
            },
            {
                "question_text": "What does Louisiana do for the Pinkneys to earn her keep?",
                "option_a": "She cooks meals",
                "option_b": "She does laundry and helps around the house",
                "option_c": "She cleans the motel rooms",
                "option_d": "She works in their store",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "What does Louisiana discover about her parents?",
                "option_a": "They are alive and looking for her",
                "option_b": "They died when she was young",
                "option_c": "Her parents were trapeze artists who died",
                "option_d": "She was abandoned",
                "correct_answer": "c",
                "question_order": 8
            },
            {
                "question_text": "What does Louisiana's grandmother reveal about Louisiana's life?",
                "option_a": "That Louisiana was adopted and her real parents are unknown",
                "option_b": "That Louisiana is a princess",
                "option_c": "That Louisiana has a trust fund",
                "option_d": "That Louisiana has siblings",
                "correct_answer": "a",
                "question_order": 9
            },
            {
                "question_text": "What does Louisiana ultimately decide about her identity?",
                "option_a": "She decides to find her real parents",
                "option_b": "She accepts that she is Louisiana Elefante and that her life is what she makes of it",
                "option_c": "She changes her name",
                "option_d": "She returns to Florida",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "The Lemonade War",
        "questions": [
            {
                "question_text": "Who are the two main sibling characters in The Lemonade War?",
                "option_a": "Evan and Jessie Treski",
                "option_b": "Evan and Megan Treski",
                "option_c": "Evan and Julie Treski",
                "option_d": "Evan and Jessie Morton",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "Why is Evan upset with Jessie at the start of the story?",
                "option_a": "She broke his toy",
                "option_b": "She is being moved up to his grade level, and he feels embarrassed",
                "option_c": "She told on him",
                "option_d": "She got better grades",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "How old is Jessie?",
                "option_a": "Eight",
                "option_b": "Nine",
                "option_c": "Ten",
                "option_d": "Seven",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "What do Evan and Jessie compete to see who can do?",
                "option_a": "Run the fastest",
                "option_b": "Make the most money selling lemonade",
                "option_c": "Get the best grades",
                "option_d": "Sell the most cookies",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "How long do they have for the lemonade war?",
                "option_a": "One day",
                "option_b": "Three days",
                "option_c": "Five days",
                "option_d": "A week",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What does Jessie do to gain an advantage?",
                "option_a": "She lowers her prices",
                "option_b": "She teams up with Megan and has a better location",
                "option_c": "She adds extra sugar",
                "option_d": "She advertises on TV",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What does Evan do to try to win?",
                "option_a": "He adds frills like lemon zest and a snack stand",
                "option_b": "He steals Jessie's money",
                "option_c": "He gives up",
                "option_d": "He cheats",
                "correct_answer": "a",
                "question_order": 7
            },
            {
                "question_text": "What happens to the lemonade money at one point?",
                "option_a": "It gets stolen",
                "option_b": "Jessie hides it and Evan takes it",
                "option_c": "It gets rained on",
                "option_d": "It gets lost",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What is the prize the winner expects?",
                "option_a": "A new bike",
                "option_b": "All the lemonade money",
                "option_c": "A trophy",
                "option_d": "A trip",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What is the resolution of the lemonade war?",
                "option_a": "Evan wins and keeps the money",
                "option_b": "Jessie wins, and they reconcile and put the money together",
                "option_c": "They both lose the money",
                "option_d": "Their parents take the money",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "The Candymakers",
        "questions": [
            {
                "question_text": "How many children are competing in the candy-making contest?",
                "option_a": "Three",
                "option_b": "Four",
                "option_c": "Five",
                "option_d": "Six",
                "correct_answer": "b",
                "question_order": 1
            },
            {
                "question_text": "What are the names of the four children in the contest?",
                "option_a": "Logan, Miles, Daisy, and Philip",
                "option_b": "Logan, Mason, Daisy, and Philip",
                "option_c": "Luke, Miles, Daisy, and Philip",
                "option_d": "Logan, Miles, Darcy, and Philip",
                "correct_answer": "a",
                "question_order": 2
            },
            {
                "question_text": "Who is Logan Sweet?",
                "option_a": "The son of the candy factory owner",
                "option_b": "A boy who hates candy",
                "option_c": "A new kid in town",
                "option_d": "A candy expert",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "Where is the candy-making contest held?",
                "option_a": "At the Life Is Sweet candy factory",
                "option_b": "At a school",
                "option_c": "At a museum",
                "option_d": "At a shopping mall",
                "correct_answer": "a",
                "question_order": 4
            },
            {
                "question_text": "What is Philip's secret?",
                "option_a": "He is a candy spy from a rival company",
                "option_b": "He is actually the son of the factory's rival",
                "option_c": "He cannot taste anything",
                "option_d": "He is afraid of sugar",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What is Miles known for?",
                "option_a": "He can taste any ingredient blindfolded",
                "option_b": "He is a boy who was raised by wolves",
                "option_c": "He is allergic to chocolate",
                "option_d": "He has a photographic memory",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What is Daisy's secret?",
                "option_a": "She is a princess in disguise",
                "option_b": "She is a spy",
                "option_c": "She has magical powers",
                "option_d": "She is a boy",
                "correct_answer": "a",
                "question_order": 7
            },
            {
                "question_text": "What does each contestant need to do for the contest?",
                "option_a": "Eat the most candy",
                "option_b": "Create a new candy to be judged",
                "option_c": "Sell the most candy",
                "option_d": "Guess the ingredients in a candy",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "How is the story structured?",
                "option_a": "Chronologically",
                "option_b": "Each section is told from a different contestant's perspective",
                "option_c": "In reverse order",
                "option_d": "As letters",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What does Logan create for his candy?",
                "option_a": "A chocolate bar",
                "option_b": "A candy that changes flavor as you eat it",
                "option_c": "A gummy bear",
                "option_d": "A lollipop",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "A Mango-Shaped Space",
        "questions": [
            {
                "question_text": "What is the name of the main character in A Mango-Shaped Space?",
                "option_a": "Mia Winchell",
                "option_b": "Mia Rodriguez",
                "option_c": "Maya Winchell",
                "option_d": "Mia Shapiro",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What condition does Mia have?",
                "option_a": "Color blindness",
                "option_b": "Synesthesia, where she sees colors when she hears sounds or sees letters and numbers",
                "option_c": "Autism",
                "option_d": "Dyslexia",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "How old is Mia when she discovers her synesthesia has a name?",
                "option_a": "Eight",
                "option_b": "Thirteen",
                "option_c": "Ten",
                "option_d": "Sixteen",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "Who is Mia's cat?",
                "option_a": "Mango",
                "option_b": "Peaches",
                "option_c": "Marmalade",
                "option_d": "Pumpkin",
                "correct_answer": "a",
                "question_order": 4
            },
            {
                "question_text": "Why is Mia's cat named Mango?",
                "option_a": "Because of its orange fur",
                "option_b": "Because the sound of its purr produces the color mango in Mia's mind",
                "option_c": "Because it loves mangoes",
                "option_d": "Because Mia found it under a mango tree",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "Who is the boy Mia meets who also has synesthesia?",
                "option_a": "Adam",
                "option_b": "Billy",
                "option_c": "Jenna",
                "option_d": "Roger",
                "correct_answer": "a",
                "question_order": 6
            },
            {
                "question_text": "What happens to Mango near the end of the story?",
                "option_a": "Mango runs away",
                "option_b": "Mango dies",
                "option_c": "Mango gets sick but recovers",
                "option_d": "Mango has kittens",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "How does Mia feel about her synesthesia at the beginning of the story?",
                "option_a": "She is proud of it",
                "option_b": "She has kept it a secret because she thinks something is wrong with her",
                "option_c": "She doesn't know she has it",
                "option_d": "She tells everyone about it",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "Who is Mia's best friend?",
                "option_a": "Jenna",
                "option_b": "Sarah",
                "option_c": "Adam",
                "option_d": "Rosa",
                "correct_answer": "a",
                "question_order": 9
            },
            {
                "question_text": "What does Mia learn about her condition?",
                "option_a": "That it is a disease",
                "option_b": "That it is a neurological condition called synesthesia that is not harmful",
                "option_c": "That it will go away",
                "option_d": "That she needs medication",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Every Soul a Star",
        "questions": [
            {
                "question_text": "Where do the three main characters meet?",
                "option_a": "At a summer camp",
                "option_b": "At Moon Shadow Campground to witness a total solar eclipse",
                "option_c": "At a science fair",
                "option_d": "At a school field trip",
                "correct_answer": "b",
                "question_order": 1
            },
            {
                "question_text": "Who are the three main characters?",
                "option_a": "Ally, Bree, and Jack",
                "option_b": "Ally, Beth, and Jake",
                "option_c": "Alice, Bree, and Jack",
                "option_d": "Ally, Bree, and James",
                "correct_answer": "a",
                "question_order": 2
            },
            {
                "question_text": "Who has lived at Moon Shadow Campground her whole life?",
                "option_a": "Bree",
                "option_b": "Jack",
                "option_c": "Ally",
                "option_d": "Mr. Silver",
                "correct_answer": "c",
                "question_order": 3
            },
            {
                "question_text": "Why is Bree at Moon Shadow?",
                "option_a": "She is on vacation",
                "option_b": "Her family is taking over the campground and she must move there",
                "option_c": "She is visiting relatives",
                "option_d": "She is lost",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "Why is Jack at Moon Shadow?",
                "option_a": "He is on vacation with his family",
                "option_b": "He was invited by his science teacher to help with an eclipse experiment as an alternative to summer school",
                "option_c": "He is camping with friends",
                "option_d": "He works there",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What is Ally's special interest?",
                "option_a": "Art",
                "option_b": "Astronomy, she knows all about stars and the eclipse",
                "option_c": "Music",
                "option_d": "Writing",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What does Bree want to be?",
                "option_a": "An actress",
                "option_b": "A model",
                "option_c": "A scientist",
                "option_d": "A singer",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "How does the story change perspectives?",
                "option_a": "It is told in first person",
                "option_b": "It alternates between the three main characters' points of view",
                "option_c": "It is told by a narrator",
                "option_d": "It is told in letters",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What does Ally discover about her parents?",
                "option_a": "They are not her real parents",
                "option_b": "They are moving away",
                "option_c": "They are getting divorced",
                "option_d": "They have a secret",
                "correct_answer": "a",
                "question_order": 9
            },
            {
                "question_text": "What do the three friends do during the eclipse?",
                "option_a": "They sleep through it",
                "option_b": "They watch it together and it changes their lives",
                "option_c": "They take photographs",
                "option_d": "They run away",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Jeremy Fink and the Meaning of Life",
        "questions": [
            {
                "question_text": "Who is the main character of the story?",
                "option_a": "Jeremy Fink",
                "option_b": "Jeremy Park",
                "option_c": "Jeremy Lark",
                "option_d": "Jeremy Clark",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What does Jeremy receive for his birthday?",
                "option_a": "A bicycle",
                "option_b": "A locked wooden box inscribed with 'The Meaning of Life'",
                "option_c": "A book",
                "option_d": "A video game",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "Who sent Jeremy the box?",
                "option_a": "His father, who has died",
                "option_b": "His mother",
                "option_c": "His grandfather",
                "option_d": "A stranger",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "What is the problem with the box?",
                "option_a": "It is broken",
                "option_b": "The four keys needed to open it are missing",
                "option_c": "It has no lock",
                "option_d": "It is too heavy",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "Who is Jeremy's best friend?",
                "option_a": "Lizzy",
                "option_b": "Alice",
                "option_c": "Ricky",
                "option_d": "Sam",
                "correct_answer": "a",
                "question_order": 5
            },
            {
                "question_text": "When must the box be opened by?",
                "option_a": "Christmas",
                "option_b": "Jeremy's thirteenth birthday",
                "option_c": "New Year's Day",
                "option_d": "The end of summer",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What do Jeremy and Lizzy do to find the keys?",
                "option_a": "They search the internet",
                "option_b": "They go on a scavenger hunt across New York City",
                "option_c": "They hire a detective",
                "option_d": "They give up",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "Who helps Jeremy and Lizzy with their search?",
                "option_a": "A pawn shop owner named Oswald",
                "option_b": "A police officer",
                "option_c": "A teacher",
                "option_d": "A librarian",
                "correct_answer": "a",
                "question_order": 8
            },
            {
                "question_text": "What does Jeremy learn about the meaning of life?",
                "option_a": "That it is a secret",
                "option_b": "That it cannot be found in a box but is discovered through experiences and relationships",
                "option_c": "That it is written in the box",
                "option_d": "That it is different for everyone",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "Where does the story take place?",
                "option_a": "Los Angeles",
                "option_b": "New York City",
                "option_c": "Chicago",
                "option_d": "Boston",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "So B. It",
        "questions": [
            {
                "question_text": "What is the name of the main character in So B. It?",
                "option_a": "Heidi",
                "option_b": "So B. It",
                "option_c": "Bernadette",
                "option_d": "Mama",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What is Heidi's mother's mental condition?",
                "option_a": "She is blind",
                "option_b": "She is mentally disabled and can only say a limited number of words",
                "option_c": "She is deaf",
                "option_d": "She is paralyzed",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "What is Heidi's mother's name?",
                "option_a": "So B. It",
                "option_b": "Bernadette",
                "option_c": "Sarah",
                "option_d": "Mama",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "Who takes care of Heidi and her mother?",
                "option_a": "A neighbor named Bernadette",
                "option_b": "A social worker",
                "option_c": "Heidi's grandmother",
                "option_d": "A foster parent",
                "correct_answer": "a",
                "question_order": 4
            },
            {
                "question_text": "What does Bernadette suffer from?",
                "option_a": "A heart condition",
                "option_b": "Agoraphobia, a fear of leaving the apartment",
                "option_c": "Arthritis",
                "option_d": "Blindness",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What word does Heidi find that helps her discover her past?",
                "option_a": "Soof",
                "option_b": "Liberty",
                "option_c": "Hill",
                "option_d": "Home",
                "correct_answer": "a",
                "question_order": 6
            },
            {
                "question_text": "Where does Heidi go to find out about her past?",
                "option_a": "New York",
                "option_b": "Liberty, New York",
                "option_c": "Chicago",
                "option_d": "Hilltop, New York",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "How does Heidi travel to find her past?",
                "option_a": "By train",
                "option_b": "By bus",
                "option_c": "By car",
                "option_d": "By plane",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What does Heidi discover about her father?",
                "option_a": "He is dead",
                "option_b": "He is a man named Elias who knew her mother at a home for the mentally disabled",
                "option_c": "He abandoned her",
                "option_d": "He is a stranger",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What does Heidi learn about her mother's past?",
                "option_a": "That her mother was a famous person",
                "option_b": "That her mother was abused and Heidi was the result of that abuse",
                "option_c": "That her mother was adopted",
                "option_d": "That her mother had another child",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Ella Enchanted",
        "questions": [
            {
                "question_text": "What is the curse placed on Ella at birth?",
                "option_a": "She will die young",
                "option_b": "She must be obedient to every command given to her",
                "option_c": "She will fall asleep forever",
                "option_d": "She cannot speak",
                "correct_answer": "b",
                "question_order": 1
            },
            {
                "question_text": "Who places the curse on Ella?",
                "option_a": "A fairy named Lucinda",
                "option_b": "An evil witch",
                "option_c": "A sorcerer",
                "option_d": "Her stepmother",
                "correct_answer": "a",
                "question_order": 2
            },
            {
                "question_text": "Who is Ella's fairy godmother?",
                "option_a": "Lucinda",
                "option_b": "Mandy, her cook and house fairy",
                "option_c": "Her aunt",
                "option_d": "A stranger",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "Who is the prince that Ella falls in love with?",
                "option_a": "Prince Charmont",
                "option_b": "Prince Arthur",
                "option_c": "Prince Henry",
                "option_d": "Prince William",
                "correct_answer": "a",
                "question_order": 4
            },
            {
                "question_text": "Why does Ella go to finishing school?",
                "option_a": "Her father sends her",
                "option_b": "Her stepmother orders her to go",
                "option_c": "She wants to learn",
                "option_d": "The prince sends her",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "Who are Ella's wicked stepsisters?",
                "option_a": "Hattie and Olive",
                "option_b": "Margaret and Olive",
                "option_c": "Hattie and Rose",
                "option_d": "Olive and Daisy",
                "correct_answer": "a",
                "question_order": 6
            },
            {
                "question_text": "What language can Ella speak that is important to the story?",
                "option_a": "Elvish",
                "option_b": "Gnomish",
                "option_c": "Ogre",
                "option_d": "All of the above",
                "correct_answer": "d",
                "question_order": 7
            },
            {
                "question_text": "What does Ella do to try to break her curse?",
                "option_a": "She searches for Lucinda",
                "option_b": "She goes on a quest to find Lucinda to undo the curse",
                "option_c": "She drinks a potion",
                "option_d": "She goes to a wizard",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "How does Ella finally break the curse?",
                "option_a": "Lucinda undoes it",
                "option_b": "When the prince proposes, she says no out of love for him, breaking the curse through her own will",
                "option_c": "A wizard lifts it",
                "option_d": "Her fairy godmother breaks it",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "Who is Char?",
                "option_a": "Ella's brother",
                "option_b": "Prince Charmont, Ella's love interest",
                "option_c": "Ella's father",
                "option_d": "A fairy",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "The Two Princesses of Bamarre",
        "questions": [
            {
                "question_text": "Who are the two princesses of Bamarre?",
                "option_a": "Addie and Meryl",
                "option_b": "Addie and Meredith",
                "option_c": "Anna and Meryl",
                "option_d": "Addie and Mary",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "Which princess is brave and adventurous?",
                "option_a": "Addie",
                "option_b": "Meryl",
                "option_c": "Both",
                "option_d": "Neither",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "Which princess is shy and fearful?",
                "option_a": "Addie",
                "option_b": "Meryl",
                "option_c": "Both",
                "option_d": "Neither",
                "correct_answer": "a",
                "question_order": 3
            },
            {
                "question_text": "What illness strikes Meryl?",
                "option_a": "A cold",
                "option_b": "The Gray Death, a deadly and incurable disease",
                "option_c": "A fever",
                "option_d": "A curse",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "What must Addie do to save her sister?",
                "option_a": "Find a doctor",
                "option_b": "Go on a quest to find the cure for the Gray Death",
                "option_c": "Ask the king for help",
                "option_d": "Pray",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What does Addie take with her on her quest?",
                "option_a": "A sword",
                "option_b": "Seven-league boots, a cloak of invisibility, and a map",
                "option_c": "A magic wand",
                "option_d": "Nothing",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What creatures does Addie encounter on her quest?",
                "option_a": "Dragons",
                "option_b": "Ogres, dragons, and specters",
                "option_c": "Witches",
                "option_d": "Trolls",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "Who is Rhys?",
                "option_a": "A dragon",
                "option_b": "A sorcerer who helps Addie",
                "option_c": "A prince",
                "option_d": "A knight",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What is the cure for the Gray Death?",
                "option_a": "A magic potion",
                "option_b": "A drop of dragon's blood, or a cure made from the flowers that grow where dragons are slain",
                "option_c": "A special herb",
                "option_d": "A fairy's blessing",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What does Addie discover about herself during her quest?",
                "option_a": "That she is not brave",
                "option_b": "That she has courage within her, proving that even the fearful can be heroes",
                "option_c": "That she does not love her sister",
                "option_d": "That she is a witch",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "A Wind in the Door",
        "questions": [
            {
                "question_text": "Who is the main character of A Wind in the Door?",
                "option_a": "Meg Murry",
                "option_b": "Charles Wallace",
                "option_c": "Calvin O'Keefe",
                "option_d": "Sandy Murry",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What is wrong with Charles Wallace?",
                "option_a": "He has a broken leg",
                "option_b": "He is suffering from a mysterious illness caused by creatures called Echthroi",
                "option_c": "He has a fever",
                "option_d": "He is cursed",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "What must Meg do to save Charles Wallace?",
                "option_a": "Find a doctor",
                "option_b": "Travel inside Charles Wallace's cells to fight the Echthroi",
                "option_c": "Find a magical cure",
                "option_d": "Go to another planet",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "Who is the cherubim who helps Meg?",
                "option_a": "Proginoskes",
                "option_b": "Blajeny",
                "option_c": "Mr. Jenkins",
                "option_d": "Calvin",
                "correct_answer": "a",
                "question_order": 4
            },
            {
                "question_text": "What are the Echthroi?",
                "option_a": "Aliens",
                "option_b": "Evil beings that seek to destroy the universe by X-ing things out",
                "option_c": "Bacteria",
                "option_d": "Viruses",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "Who is the teacher who helps Meg on her journey?",
                "option_a": "Mr. Jenkins",
                "option_b": "Blajeny, a Teacher from the stars",
                "option_c": "Mrs. Whatsit",
                "option_d": "Calvin",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "What must Meg do inside Charles Wallace?",
                "option_a": "Fight the Echthroi",
                "option_b": "Name the things inside him correctly, as naming is powerful",
                "option_c": "Find the Echthroi",
                "option_d": "Destroy the Echthroi",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "What is the concept of 'kything' in the story?",
                "option_a": "A type of communication without words",
                "option_b": "A form of teleportation",
                "option_c": "A magical spell",
                "option_d": "A type of healing",
                "correct_answer": "a",
                "question_order": 8
            },
            {
                "question_text": "Who is Calvin O'Keefe in relation to Meg?",
                "option_a": "Her brother",
                "option_b": "Her friend and love interest",
                "option_c": "Her teacher",
                "option_d": "Her cousin",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What is the overarching theme of A Wind in the Door?",
                "option_a": "The power of love and naming",
                "option_b": "The importance of science",
                "option_c": "The danger of technology",
                "option_d": "The value of friendship",
                "correct_answer": "a",
                "question_order": 10
            }
        ]
    },
    {
        "title": "A Swiftly Tilting Planet",
        "questions": [
            {
                "question_text": "Who is the main character of A Swiftly Tilting Planet?",
                "option_a": "Charles Wallace Murry",
                "option_b": "Meg Murry",
                "option_c": "Calvin O'Keefe",
                "option_d": "Sandy Murry",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "What threatens the world in this story?",
                "option_a": "A natural disaster",
                "option_b": "A nuclear threat from a dictator named Mad Dog Branzillo",
                "option_c": "An alien invasion",
                "option_d": "A plague",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "How does Charles Wallace travel through time?",
                "option_a": "In a time machine",
                "option_b": "Through a unicorn named Gaudior",
                "option_c": "Through a portal",
                "option_d": "In a dream",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "What must Charles Wallace do to save the world?",
                "option_a": "Defeat Branzillo",
                "option_b": "Change the past by influencing historical events through 'going within' people",
                "option_c": "Find a weapon",
                "option_d": "Warn the president",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "Who is the unicorn that helps Charles Wallace?",
                "option_a": "Gaudior",
                "option_b": "Proginoskes",
                "option_c": "Blajeny",
                "option_d": "Mr. Jenkins",
                "correct_answer": "a",
                "question_order": 5
            },
            {
                "question_text": "What is the concept of 'going within' in the story?",
                "option_a": "Entering someone's body",
                "option_b": "Charles Wallace enters the consciousness of people in the past to influence their decisions",
                "option_c": "Time travel",
                "option_d": "Mind reading",
                "correct_answer": "b",
                "question_order": 6
            },
            {
                "question_text": "Who is Mad Dog Branzillo?",
                "option_a": "A dictator in South America who threatens nuclear war",
                "option_b": "A criminal",
                "option_c": "A general",
                "option_d": "A scientist",
                "correct_answer": "a",
                "question_order": 7
            },
            {
                "question_text": "What is the significance of the rune 'I conjure thee by the day and the night'?",
                "option_a": "It is a spell to time travel",
                "option_b": "It is a rune used by Mrs. Murry to help Charles Wallace, passed down through generations",
                "option_c": "It is a curse",
                "option_d": "It is a prayer",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "What is the ultimate goal of Charles Wallace's journey?",
                "option_a": "To become a hero",
                "option_b": "To change the timeline so that Branzillo becomes a good leader instead of a dictator",
                "option_c": "To find his father",
                "option_d": "To save Meg",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "Who recites the rune at the beginning of the story?",
                "option_a": "Meg",
                "option_b": "Mrs. Murry",
                "option_c": "Charles Wallace",
                "option_d": "Calvin",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    },
    {
        "title": "Many Waters",
        "questions": [
            {
                "question_text": "Who are the main characters of Many Waters?",
                "option_a": "Sandy and Dennys Murry",
                "option_b": "Meg and Charles Wallace",
                "option_c": "Calvin and Meg",
                "option_d": "Sandy and Calvin",
                "correct_answer": "a",
                "question_order": 1
            },
            {
                "question_text": "How do Sandy and Dennys travel back in time?",
                "option_a": "In a time machine",
                "option_b": "They accidentally type something into their father's computer experiment",
                "option_c": "Through a portal",
                "option_d": "In a dream",
                "correct_answer": "b",
                "question_order": 2
            },
            {
                "question_text": "What time period do they travel to?",
                "option_a": "Ancient Egypt",
                "option_b": "The time of Noah and the biblical flood",
                "option_c": "The Middle Ages",
                "option_d": "Prehistoric times",
                "correct_answer": "b",
                "question_order": 3
            },
            {
                "question_text": "What is the environment like where Sandy and Dennys arrive?",
                "option_a": "A lush forest",
                "option_b": "A desert where it has not rained for many years",
                "option_c": "A tropical island",
                "option_d": "A frozen tundra",
                "correct_answer": "b",
                "question_order": 4
            },
            {
                "question_text": "Who is Noah in the story?",
                "option_a": "A king",
                "option_b": "A patriarch who is building an ark before the flood comes",
                "option_c": "A farmer",
                "option_d": "A prophet",
                "correct_answer": "b",
                "question_order": 5
            },
            {
                "question_text": "What are the seraphim and nephilim in the story?",
                "option_a": "Angels and fallen angels who interact with humans",
                "option_b": "Aliens",
                "option_c": "Mythical creatures",
                "option_d": "Tribes",
                "correct_answer": "a",
                "question_order": 6
            },
            {
                "question_text": "What is the relationship between Sandy and Dennys?",
                "option_a": "They are enemies",
                "option_b": "They are twins",
                "option_c": "They are cousins",
                "option_d": "They are friends",
                "correct_answer": "b",
                "question_order": 7
            },
            {
                "question_text": "What must happen for Sandy and Dennys to return home?",
                "option_a": "They must complete a quest",
                "option_b": "They must survive until the flood comes and be on the ark",
                "option_c": "They must find a portal",
                "option_d": "They must defeat a villain",
                "correct_answer": "b",
                "question_order": 8
            },
            {
                "question_text": "Who is Yalith in the story?",
                "option_a": "Noah's wife",
                "option_b": "Noah's daughter who befriends the twins",
                "option_c": "A seraph",
                "option_d": "A nephilim",
                "correct_answer": "b",
                "question_order": 9
            },
            {
                "question_text": "What is the overarching theme of Many Waters?",
                "option_a": "The power of science",
                "option_b": "Love, sacrifice, and faith, as the twins learn about love and the biblical flood",
                "option_c": "The danger of technology",
                "option_d": "The importance of family",
                "correct_answer": "b",
                "question_order": 10
            }
        ]
    }
]

with open("/home/user/workspace/bookquiz/questions_batch_2.json", "w") as f:
    json.dump(questions, f, indent=2)

print(f"Wrote {len(questions)} books with {sum(len(b['questions']) for b in questions)} questions total")
