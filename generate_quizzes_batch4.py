import json

quizzes = [
    {
        "title": "Runaway Ralph",
        "author": "Beverly Cleary",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What kind of animal is Ralph?",
                "options": ["A hamster", "A mouse", "A guinea pig", "A rabbit"],
                "correct": "B"
            },
            {
                "question": "Where does Ralph live at the beginning of the book?",
                "options": ["In a barn", "At the Mountain View Inn", "In a city apartment", "At a summer camp"],
                "correct": "B"
            },
            {
                "question": "Why does Ralph decide to run away?",
                "options": ["He is angry at his mother", "He wants adventure and freedom from his many relatives", "He is being chased by a cat", "He wants to find his father"],
                "correct": "B"
            },
            {
                "question": "Where does Ralph go when he runs away?",
                "options": ["To Happy Acres Summer Camp", "To the city", "To the woods", "To a neighboring inn"],
                "correct": "A"
            },
            {
                "question": "What is the name of the motorcycle Ralph rides?",
                "options": ["His red motorcycle has no name", "Lightning", "Thunderbolt", "Speedy"],
                "correct": "A"
            },
            {
                "question": "Who catches Ralph in a butterfly net at the camp?",
                "options": ["A camper named Garf", "The camp director", "A dog named Buddy", "An older boy named Brad"],
                "correct": "A"
            },
            {
                "question": "What does Ralph have to do at the camp after being caught?",
                "options": ["Clean the cabins", "Perform in a maze for the campers", "Wash dishes", "Row boats"],
                "correct": "B"
            },
            {
                "question": "How does Ralph escape from the camp?",
                "options": ["He rides his motorcycle out the gate", "He is carried away by a dog in a doggy bag", "He climbs a tree and jumps over the fence", "He hides in a delivery truck"],
                "correct": "B"
            },
            {
                "question": "Who takes care of Ralph's motorcycle while he is away from the inn?",
                "options": ["His mother", "A boy named Ryan", "The innkeeper", "His cousin"],
                "correct": "B"
            },
            {
                "question": "What does Ralph realize by the end of the story?",
                "options": ["That he never wants to go home", "That home and family are important to him", "That he wants to live at the camp forever", "That he should become a circus mouse"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "Dear Mr. Henshaw",
        "author": "Beverly Cleary",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "Who is the main character of the story?",
                "options": ["Leigh Botts", "Barry Henshaw", "Scott Botts", "Kevin Henshaw"],
                "correct": "A"
            },
            {
                "question": "Who is Mr. Henshaw?",
                "options": ["Leigh's teacher", "Leigh's favorite author", "Leigh's neighbor", "Leigh's father"],
                "correct": "B"
            },
            {
                "question": "Why does Leigh write to Mr. Henshaw?",
                "options": ["For a school assignment", "Because he has questions about the author's books", "Because he wants to become a writer", "Because his mother told him to"],
                "correct": "B"
            },
            {
                "question": "What problem is Leigh dealing with at school?",
                "options": ["He is failing math", "Someone keeps stealing the good food from his lunch", "He is being bullied", "He has no friends"],
                "correct": "B"
            },
            {
                "question": "Why is Leigh living with only his mother?",
                "options": ["His parents are divorced", "His father died", "His father is in the army", "His father travels for work"],
                "correct": "A"
            },
            {
                "question": "Where does Leigh's father work?",
                "options": ["As a truck driver", "As a postman", "As a mechanic", "As a baker"],
                "correct": "A"
            },
            {
                "question": "What does Mr. Henshaw suggest Leigh do to become a better writer?",
                "options": ["Read more books", "Keep a diary and write every day", "Take a writing class", "Write letters to authors"],
                "correct": "B"
            },
            {
                "question": "What is the name of Leigh's dog?",
                "options": ["He does not have a dog", "Bandit", "Spot", "Rex"],
                "correct": "A"
            },
            {
                "question": "What does Leigh's father give him that is very special?",
                "options": ["A new bicycle", "A denim jacket with Levi's on the pocket", "A typewriter", "A puppy"],
                "correct": "B"
            },
            {
                "question": "How does Leigh finally solve the lunch theft problem?",
                "options": ["He tells the teacher", "He rigs his lunch box with a alarm", "He catches the thief himself", "He starts eating in the classroom"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "Stuart Little",
        "author": "E.B. White",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What is unusual about Stuart Little?",
                "options": ["He is very tall", "He looks and acts like a mouse but is born to a human family", "He can fly", "He can talk to animals"],
                "correct": "B"
            },
            {
                "question": "Where does the Little family live?",
                "options": ["In Boston", "In New York City", "In Philadelphia", "In Chicago"],
                "correct": "B"
            },
            {
                "question": "What is the name of the bird that Stuart befriends?",
                "options": ["Margalo", "Serena", "Snowbell", "Melody"],
                "correct": "A"
            },
            {
                "question": "What is the name of the Little family cat?",
                "options": ["Snowbell", "Whiskers", "Angora", "Shadow"],
                "correct": "A"
            },
            {
                "question": "What does Stuart do in the sailboat race in Central Park?",
                "options": ["He is a spectator", "He sails the boat called the Wasp", "He falls in the water", "He wins a trophy"],
                "correct": "B"
            },
            {
                "question": "Why does Stuart leave home?",
                "options": ["To find Margalo who has disappeared", "To seek his fortune", "To visit relatives", "To go to school"],
                "correct": "A"
            },
            {
                "question": "What job does Stuart take during his journey?",
                "options": ["He becomes a substitute teacher", "He works at a post office", "He drives a bus", "He works in a store"],
                "correct": "A"
            },
            {
                "question": "How does Stuart travel on his journey?",
                "options": ["By car", "In a small toy car that he can drive", "By train", "On foot"],
                "correct": "B"
            },
            {
                "question": "Who does Stuart meet that he develops a crush on?",
                "options": ["A girl named Harriet Ames", "A girl named Margaret", "A girl named Sarah", "A girl named Emily"],
                "correct": "A"
            },
            {
                "question": "How does the book end?",
                "options": ["Stuart finds Margalo", "Stuart gives up his search", "Stuart is still traveling north, hopeful", "Stuart returns home"],
                "correct": "C"
            }
        ]
    },
    {
        "title": "The Trumpet of the Swan",
        "author": "E.B. White",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What is the name of the main character swan?",
                "options": ["Louis", "Sam", "Ferdinand", "Serena"],
                "correct": "A"
            },
            {
                "question": "What problem does Louis have?",
                "options": ["He cannot swim", "He was born without a voice", "He cannot fly", "He is blind"],
                "correct": "B"
            },
            {
                "question": "What instrument does Louis learn to play?",
                "options": ["A flute", "A trumpet", "A harmonica", "A drum"],
                "correct": "B"
            },
            {
                "question": "How does Louis get his trumpet?",
                "options": ["He finds it in the woods", "His father steals it from a music store", "A boy gives it to him", "He buys it with saved money"],
                "correct": "B"
            },
            {
                "question": "What is the name of the boy who befriends Louis?",
                "options": ["Sam Beaver", "Billy Anderson", "Tommy Turner", "Johnny Walker"],
                "correct": "A"
            },
            {
                "question": "Where do Louis and his family live?",
                "options": ["In a pond in Montana", "On a lake in Canada", "In a swamp in Louisiana", "On a river in Maine"],
                "correct": "B"
            },
            {
                "question": "What is the name of the female swan Louis loves?",
                "options": ["Serena", "Isabella", "Penelope", "Charlotte"],
                "correct": "A"
            },
            {
                "question": "Where does Louis go to earn money to pay for the trumpet?",
                "options": ["To Boston and Philadelphia", "To New York City", "To Chicago and Detroit", "To San Francisco"],
                "correct": "A"
            },
            {
                "question": "What does Louis do at the zoo in Philadelphia?",
                "options": ["He performs trumpet concerts", "He leads the swans", "He teaches other animals", "He guards the entrance"],
                "correct": "A"
            },
            {
                "question": "How does the story end for Louis?",
                "options": ["He becomes a circus performer", "He returns the trumpet", "He wins Serena's love and returns to Montana", "He stays at the zoo"],
                "correct": "C"
            }
        ]
    },
    {
        "title": "A Bear Called Paddington",
        "author": "Michael Bond",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "Where is Paddington Bear from?",
                "options": ["Darkest Peru", "Brazil", "Mexico", "India"],
                "correct": "A"
            },
            {
                "question": "Where does the Brown family find Paddington?",
                "options": ["At a bus stop", "At Paddington Station", "In a park", "At a zoo"],
                "correct": "B"
            },
            {
                "question": "What is Paddington wearing when the Browns find him?",
                "options": ["A red hat and blue coat", "A blue duffle coat and a bush hat", "A yellow raincoat", "A green sweater"],
                "correct": "B"
            },
            {
                "question": "What is Paddington's favorite food?",
                "options": ["Honey", "Marmalade sandwiches", "Fish and chips", "Peanut butter"],
                "correct": "B"
            },
            {
                "question": "Who is the Browns' housekeeper?",
                "options": ["Mrs. Bird", "Mrs. Smith", "Mrs. Cook", "Mrs. Brown"],
                "correct": "A"
            },
            {
                "question": "What does Paddington always keep under his hat?",
                "options": ["A sandwich", "A marmalade jar", "A map", "A key"],
                "correct": "A"
            },
            {
                "question": "What happens when Paddington tries to take a bath?",
                "options": ["He gets stuck in the tub", "He overflows the bath and floods the bathroom", "He falls asleep", "He drinks all the bath water"],
                "correct": "B"
            },
            {
                "question": "What does Paddington do at the department store?",
                "options": ["He works as a store clerk", "He gets lost in the store", "He causes chaos on an escalator", "He shoplifts marmalade"],
                "correct": "C"
            },
            {
                "question": "What is the name of the Browns' neighbor who is often annoyed by Paddington?",
                "options": ["Mr. Curry", "Mr. Gruber", "Mr. Brown's cousin", "Mr. Henson"],
                "correct": "A"
            },
            {
                "question": "What does Paddington's Aunt Lucy do before he leaves Peru?",
                "options": ["She gives him marmalade", "She sends him to England to live with people who can care for him", "She gives him a hat", "She writes him a letter"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "Paddington Helps Out",
        "author": "Michael Bond",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What does Paddington try to do throughout the book?",
                "options": ["Go back to Peru", "Help people but usually causes more problems", "Find a new home", "Learn to cook"],
                "correct": "B"
            },
            {
                "question": "What happens when Paddington tries to help with laundry?",
                "options": ["He shrinks all the clothes", "He mixes up everyone's clothes", "He puts too much soap in the machine and causes a flood of bubbles", "He loses all the socks"],
                "correct": "C"
            },
            {
                "question": "What does Paddington try to do at the hair salon?",
                "options": ["Give someone a haircut", "Sweep the floor", "Wash hair", "Sell products"],
                "correct": "A"
            },
            {
                "question": "What does Paddington do when he tries to help Mr. Curry?",
                "options": ["He accidentally destroys Mr. Curry's garden", "He fixes Mr. Curry's roof", "He cleans Mr. Curry's house", "He cooks Mr. Curry dinner"],
                "correct": "A"
            },
            {
                "question": "What does Paddington attempt to do in the kitchen?",
                "options": ["Bake a cake", "Make marmalade", "Cook dinner for the Browns", "Clean the dishes"],
                "correct": "C"
            },
            {
                "question": "Who is Mr. Gruber?",
                "options": ["A shop owner who is a friend of Paddington", "A neighbor", "A postman", "A teacher"],
                "correct": "A"
            },
            {
                "question": "What does Paddington do when he tries to help with shopping?",
                "options": ["He buys the wrong items", "He gets lost in the market", "He causes a commotion with a shopping cart", "He spends all the money"],
                "correct": "C"
            },
            {
                "question": "What does Paddington do at the theater?",
                "options": ["He performs on stage", "He causes a disturbance from the audience", "He falls asleep", "He sells tickets"],
                "correct": "B"
            },
            {
                "question": "What does Paddington try to paint?",
                "options": ["A fence", "A room in the Brown house", "A picture", "Mr. Curry's house"],
                "correct": "B"
            },
            {
                "question": "How do the Browns usually feel about Paddington despite his mishaps?",
                "options": ["Annoyed and frustrated", "They love him and forgive his mistakes", "They want him to leave", "They are indifferent"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "My Father's Dragon",
        "author": "Ruth Stiles Gannett",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What is the name of the main character?",
                "options": ["Elmer Elevator", "Sam Beaver", "Timmy Turner", "Bobby Brown"],
                "correct": "A"
            },
            {
                "question": "Where does Elmer go to rescue a baby dragon?",
                "options": ["Wild Island", "Treasure Island", "Dragon Island", "Mystery Island"],
                "correct": "A"
            },
            {
                "question": "How old is Elmer?",
                "options": ["He is nine years old", "He is seven years old", "He is twelve years old", "He is five years old"],
                "correct": "A"
            },
            {
                "question": "What items does Elmer pack for his journey?",
                "options": ["A sword and shield", "Chewing gum, lollipops, rubber bands, and other everyday items", "A map and compass", "Food and water"],
                "correct": "B"
            },
            {
                "question": "How does Elmer get to the island?",
                "options": ["He flies on a bird", "He rides on a boat", "He swims", "He walks across a bridge"],
                "correct": "A"
            },
            {
                "question": "Why is the baby dragon held captive?",
                "options": ["Because he can fly and the animals use him for transportation", "Because he has treasure", "Because he is dangerous", "Because he lost a bet"],
                "correct": "A"
            },
            {
                "question": "What does Elmer use to distract the animals on the island?",
                "options": ["The items he packed in his knapsack", "Magic spells", "Food", "Money"],
                "correct": "A"
            },
            {
                "question": "What does Elmer use chewing gum for?",
                "options": ["To stick to a wall", "To give to a rhinoceros who is bothered by a tusk", "To blow bubbles as a distraction", "To fix something broken"],
                "correct": "B"
            },
            {
                "question": "What does Elmer use the lollipops for?",
                "options": ["To bribe a guard", "To feed the animals", "To distract a lion who has tangled mane", "To give to the dragon"],
                "correct": "C"
            },
            {
                "question": "How does Elmer and the dragon escape from Wild Island?",
                "options": ["They fly away on the dragon's back", "They swim across the river", "They sneak past the animals at night", "They build a boat"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "Elmer and the Dragon",
        "author": "Ruth Stiles Gannett",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What is the name of the baby dragon?",
                "options": ["Elmer", "Boris", "Sparky", "The dragon has no name"],
                "correct": "B"
            },
            {
                "question": "Where do Elmer and the dragon go after escaping Wild Island?",
                "options": ["Back to Elmer's home", "To Feather Island", "To another island", "To a city"],
                "correct": "B"
            },
            {
                "question": "Why do they stop at Feather Island?",
                "options": ["The dragon is tired and needs to rest", "A storm blows them there", "They see a light", "They get lost"],
                "correct": "A"
            },
            {
                "question": "Who do they meet on Feather Island?",
                "options": ["A family of canaries", "A group of lost explorers", "A king and his court", "Other dragons"],
                "correct": "A"
            },
            {
                "question": "What is the problem with the canaries on Feather Island?",
                "options": ["They cannot fly", "They are running out of seeds and getting thinner", "They are afraid of the dark", "They cannot sing"],
                "correct": "B"
            },
            {
                "question": "What is the king of the canaries' name?",
                "options": ["King Canary", "King Dan", "Kuzart", "King Feather"],
                "correct": "C"
            },
            {
                "question": "Why are the canaries getting thinner?",
                "options": ["They are sick", "An old king decreed that they must wait until every canary is present before eating", "There is a famine", "They are on a diet"],
                "correct": "B"
            },
            {
                "question": "How does Elmer solve the canaries' problem?",
                "options": ["He finds new food", "He tricks the king into changing the law", "He discovers that three canaries are hiding so they can eat more", "He builds a new island"],
                "correct": "C"
            },
            {
                "question": "What happens after the three canaries are discovered?",
                "options": ["They are punished", "All the canaries can now eat together", "The king abdicates", "They leave the island"],
                "correct": "B"
            },
            {
                "question": "Where does Elmer decide to go at the end of the story?",
                "options": ["He decides to stay on Feather Island", "He goes back home to Nevergreen City", "He goes to Blueland with the dragon", "He explores another island"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "The Dragons of Blueland",
        "author": "Ruth Stiles Gannett",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "Who is the main dragon character in this book?",
                "options": ["Boris", "Elmer", "Sparky", "Smaug"],
                "correct": "A"
            },
            {
                "question": "Where does Boris the dragon go in this book?",
                "options": ["To Wild Island", "Back to his home in Blueland", "To Feather Island", "To Elmer's house"],
                "correct": "B"
            },
            {
                "question": "What does Boris discover when he returns to Blueland?",
                "options": ["His home is destroyed", "His family is trapped in a cave", "His family has left", "His family is angry with him"],
                "correct": "B"
            },
            {
                "question": "Why is Boris's family trapped?",
                "options": ["A rockslide blocked the cave entrance", "Men are hunting them and have trapped them", "They are too fat to get out", "The cave flooded"],
                "correct": "B"
            },
            {
                "question": "Who does Boris go to for help?",
                "options": ["Elmer Elevator", "The king of the canaries", "Other dragons", "A wizard"],
                "correct": "A"
            },
            {
                "question": "Where does Elmer live?",
                "options": ["In Nevergreen City", "In a small town", "On a farm", "In the countryside"],
                "correct": "A"
            },
            {
                "question": "How do Elmer and his father help the dragons?",
                "options": ["They dig them out", "They talk to the men and convince them to leave", "They use magic", "They fly the dragons out one by one"],
                "correct": "B"
            },
            {
                "question": "What do the men hunting dragons want?",
                "options": ["Dragon scales", "Dragon blood", "To capture the dragons and put them in a zoo", "Treasure"],
                "correct": "C"
            },
            {
                "question": "What is the name of the region where the dragons live?",
                "options": ["Blueland", "Greenland", "Dragonland", "Wild Island"],
                "correct": "A"
            },
            {
                "question": "How does the story end?",
                "options": ["The dragons are freed and Boris stays with his family", "Boris goes back to live with Elmer", "The dragons move to a new home", "Elmer becomes a dragon keeper"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "The Hundred Dresses",
        "author": "Eleanor Estes",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "Who is the girl who claims to have one hundred dresses?",
                "options": ["Wanda Petronski", "Maddie Reeves", "Cecile Drake", "Peggy Madison"],
                "correct": "A"
            },
            {
                "question": "Where does Wanda live?",
                "options": ["In a mansion", "On Boggins Heights, a poor part of town", "In the city", "On a farm"],
                "correct": "B"
            },
            {
                "question": "Who is the most popular girl who leads the teasing of Wanda?",
                "options": ["Peggy", "Maddie", "Cecile", "Betsy"],
                "correct": "A"
            },
            {
                "question": "Why do the girls tease Wanda about the dresses?",
                "options": ["She always wears the same blue dress to school", "She brags about her clothes", "She wears ugly dresses", "She says she has a hundred dresses but they never see them"],
                "correct": "D"
            },
            {
                "question": "Who is the narrator's friend that feels guilty about the teasing but stays silent?",
                "options": ["Maddie", "Peggy", "Cecile", "Betsy"],
                "correct": "A"
            },
            {
                "question": "What happens when the girls go to see if Wanda has really drawn the dresses?",
                "options": ["Wanda has moved away", "Wanda refuses to show them", "Wanda's dresses are real", "Wanda is sick"],
                "correct": "A"
            },
            {
                "question": "What did Wanda actually have one hundred of?",
                "options": ["Real dresses", "Drawings of dresses", "Sisters", "Dolls"],
                "correct": "B"
            },
            {
                "question": "How do the drawings of dresses get displayed?",
                "options": ["They are framed in the school hallway", "They are hung in the classroom", "Wanda sends them as entries in a contest", "They are in a book"],
                "correct": "C"
            },
            {
                "question": "What does Wanda do at the end of the story?",
                "options": ["She comes back to school", "She writes a letter saying Peggy and Maddie can keep certain drawings", "She sends new drawings", "She visits the school"],
                "correct": "B"
            },
            {
                "question": "What lesson do Peggy and Maddie learn?",
                "options": ["That they should be kinder to others", "That they should never tease anyone", "That standing by silently while someone is teased is wrong", "That Wanda was a better person than they thought"],
                "correct": "C"
            }
        ]
    },
    {
        "title": "Ginger Pye",
        "author": "Eleanor Estes",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What kind of animal is Ginger?",
                "options": ["A cat", "A dog", "A rabbit", "A hamster"],
                "correct": "B"
            },
            {
                "question": "How do the Pye children get the money to buy Ginger?",
                "options": ["They save their allowances", "Their father gives them the money", "Sam works for it", "They find the money"],
                "correct": "C"
            },
            {
                "question": "Who is the main character who tells most of the story?",
                "options": ["Sam", "Jerry", "Rachel", "Benny"],
                "correct": "C"
            },
            {
                "question": "What color is Ginger?",
                "options": ["Black", "Brown", "White", "A mix of brown, white, and black"],
                "correct": "D"
            },
            {
                "question": "What happens to Ginger?",
                "options": ["He runs away", "He is stolen", "He gets lost", "He is given away"],
                "correct": "B"
            },
            {
                "question": "Who do the children suspect stole Ginger?",
                "options": ["A neighbor", "A stranger in a yellow hat", "A classmate", "A dog catcher"],
                "correct": "B"
            },
            {
                "question": "What do the children do to try to find Ginger?",
                "options": ["They put up posters and search the neighborhood", "They call the police", "They hire a detective", "They give up hope"],
                "correct": "A"
            },
            {
                "question": "What is the name of the Pye family's uncle who is a scientist?",
                "options": ["Uncle Benny", "Uncle Jake", "Uncle Max", "Uncle Henry"],
                "correct": "A"
            },
            {
                "question": "Where is Ginger eventually found?",
                "options": ["In the woods", "At a neighbor's house", "At the high school", "In another town"],
                "correct": "C"
            },
            {
                "question": "Who had taken Ginger?",
                "options": ["A stranger", "A boy who wanted a dog", "A neighbor who was angry at the Pyes", "No one knows"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "The Moffats",
        "author": "Eleanor Estes",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "How many Moffat children are there?",
                "options": ["Three", "Four", "Five", "Two"],
                "correct": "B"
            },
            {
                "question": "What color is the Moffats' house?",
                "options": ["Blue", "Yellow", "Green", "White"],
                "correct": "B"
            },
            {
                "question": "What is the name of the oldest Moffat child?",
                "options": ["Sylvie", "Joey", "Jane", "Rufus"],
                "correct": "A"
            },
            {
                "question": "Who is the youngest Moffat child?",
                "options": ["Rufus", "Joey", "Jane", "Sylvie"],
                "correct": "A"
            },
            {
                "question": "What does Rufus do when he is worried about being late for school?",
                "options": ["He runs very fast", "He cuts through yards", "He counts steps and measures distances", "He takes a shortcut"],
                "correct": "C"
            },
            {
                "question": "Who does Jane idolize and try to copy?",
                "options": ["Her mother", "The oldest girl in town", "Sylvie", "A movie star"],
                "correct": "B"
            },
            {
                "question": "What does Joey do to earn money?",
                "options": ["He mows lawns", "He has a newspaper route", "He does odd jobs", "He helps at a store"],
                "correct": "C"
            },
            {
                "question": "What do the Moffats do for fun?",
                "options": ["They go to the movies", "They play in the street", "They have adventures in their town", "They read books"],
                "correct": "C"
            },
            {
                "question": "What is the name of the street the Moffats live on?",
                "options": ["New Sunnyside Street", "Maple Street", "Main Street", "Oak Avenue"],
                "correct": "A"
            },
            {
                "question": "Who takes care of the Moffat children?",
                "options": ["Their mother and a caretaker named Catherine", "Just their mother", "Their grandparents", "Their aunt"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "The Little Prince",
        "author": "Antoine de Saint-Exupery",
        "ageGroup": "8-10",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Where does the narrator crash his plane?",
                "options": ["In the desert", "In the mountains", "In the ocean", "In the jungle"],
                "correct": "A"
            },
            {
                "question": "What is the name of the little prince's home planet?",
                "options": ["Asteroid B-612", "Earth", "Mars", "Asteroid 42"],
                "correct": "A"
            },
            {
                "question": "What does the little prince love most on his planet?",
                "options": ["His rose", "His baobab trees", "His volcanoes", "His sheep"],
                "correct": "A"
            },
            {
                "question": "Why does the little prince leave his planet?",
                "options": ["He is bored", "He and his rose had a misunderstanding and he needed to explore", "He was banished", "His planet was dying"],
                "correct": "B"
            },
            {
                "question": "How many planets does the little prince visit before Earth?",
                "options": ["Three", "Five", "Six", "Seven"],
                "correct": "C"
            },
            {
                "question": "Who does the little prince meet on Earth who teaches him about taming?",
                "options": ["A fox", "A snake", "A rose garden", "A pilot"],
                "correct": "A"
            },
            {
                "question": "What is the fox's secret that he shares with the little prince?",
                "options": ["It is only with the heart that one can see rightly", "Love is the most important thing", "What is essential is invisible to the eye", "Both A and C"],
                "correct": "D"
            },
            {
                "question": "What does the little prince discover on Earth that makes him sad about his rose?",
                "options": ["A garden with thousands of roses just like his", "That roses are common", "That his rose is not special", "That roses don't live long"],
                "correct": "A"
            },
            {
                "question": "How does the little prince return to his planet?",
                "options": ["He flies back on a bird", "He lets a snake bite him", "He builds a rocket", "He walks back"],
                "correct": "B"
            },
            {
                "question": "What does the drawing of the boa constrictor look like to adults?",
                "options": ["A snake", "A hat", "An elephant", "A mountain"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "Pinocchio",
        "author": "Carlo Collodi",
        "ageGroup": "8-10",
        "pointsValue": 10,
        "questions": [
            {
                "question": "What kind of puppet is Pinocchio made from?",
                "options": ["A wooden puppet", "A cloth puppet", "A clay puppet", "A metal puppet"],
                "correct": "A"
            },
            {
                "question": "Who carves Pinocchio?",
                "options": ["Geppetto", "Figaro", "Mastro Cherry", "The Blue Fairy"],
                "correct": "A"
            },
            {
                "question": "What happens to Pinocchio's nose when he lies?",
                "options": ["It turns red", "It grows longer", "It falls off", "Nothing happens"],
                "correct": "B"
            },
            {
                "question": "Who is the talking cricket that gives Pinocchio advice?",
                "options": ["Jiminy Cricket", "The Talking Cricket", "Grillo Parlante", "The Green Cricket"],
                "correct": "B"
            },
            {
                "question": "What does Pinocchio do with the coins the Blue Fairy gives him for his father?",
                "options": ["He buys food", "He gives them to a fox and cat who promise to multiply them", "He saves them", "He loses them"],
                "correct": "B"
            },
            {
                "question": "What are the names of the fox and cat who trick Pinocchio?",
                "options": ["Fox and Cat", "Volpe and Gatto", "The Fox and the Cat have no specific names", "Honest John and Gideon"],
                "correct": "C"
            },
            {
                "question": "What happens when Pinocchio goes to the Land of Toys?",
                "options": ["He has a great time", "He turns into a donkey", "He gets lost", "He meets other puppets"],
                "correct": "B"
            },
            {
                "question": "Who turns Pinocchio into a real boy?",
                "options": ["The Blue Fairy", "Geppetto", "The Talking Cricket", "A wizard"],
                "correct": "A"
            },
            {
                "question": "What must Pinocchio do to become a real boy?",
                "options": ["Prove himself brave, truthful, and unselfish", "Find a magical object", "Defeat a dragon", "Complete three tasks"],
                "correct": "A"
            },
            {
                "question": "What does Pinocchio do to help his father when Geppetto is in the shark's belly?",
                "options": ["He rescues him", "He brings food", "He asks the Fairy for help", "He dives into the sea"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "The Reluctant Dragon",
        "author": "Kenneth Grahame",
        "ageGroup": "8-10",
        "pointsValue": 8,
        "questions": [
            {
                "question": "What kind of dragon does the boy discover?",
                "options": ["A fierce dragon", "A lazy dragon who likes poetry and has no interest in fighting", "A baby dragon", "A fire-breathing dragon"],
                "correct": "B"
            },
            {
                "question": "Who finds the dragon?",
                "options": ["A young boy", "A knight", "A shepherd", "A farmer"],
                "correct": "A"
            },
            {
                "question": "Where does the dragon live?",
                "options": ["In a cave on the Downs", "In a castle", "In a forest", "In a mountain"],
                "correct": "A"
            },
            {
                "question": "What does the dragon spend his time doing?",
                "options": ["Sleeping and writing poetry", "Hoarding treasure", "Eating sheep", "Flying around"],
                "correct": "A"
            },
            {
                "question": "Who is sent to deal with the dragon?",
                "options": ["St. George", "A knight", "The king's army", "The villagers"],
                "correct": "A"
            },
            {
                "question": "Why do the villagers want St. George to fight the dragon?",
                "options": ["The dragon has been eating their sheep", "They think the dragon is dangerous", "The dragon has been attacking the village", "They want entertainment"],
                "correct": "B"
            },
            {
                "question": "How does the boy help the situation?",
                "options": ["He tells St. George the dragon is peaceful", "He arranges a mock battle between St. George and the dragon", "He hides the dragon", "He fights St. George"],
                "correct": "B"
            },
            {
                "question": "What happens during the battle between St. George and the dragon?",
                "options": ["It is a real, bloody fight", "It is a staged performance that looks exciting but no one is hurt", "The dragon wins", "St. George wins"],
                "correct": "B"
            },
            {
                "question": "What does St. George do after the battle?",
                "options": ["He kills the dragon", "He invites the dragon to dinner", "He leaves town", "He becomes the dragon's friend"],
                "correct": "B"
            },
            {
                "question": "What lesson does the story teach?",
                "options": ["That not all dragons are dangerous", "That fighting is wrong", "That appearances can be deceiving", "That friends can solve problems peacefully"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "At the Back of the North Wind",
        "author": "George MacDonald",
        "ageGroup": "8-10",
        "pointsValue": 10,
        "questions": [
            {
                "question": "What is the name of the main character?",
                "options": ["Diamond", "Samuel", "Oliver", "Joseph"],
                "correct": "A"
            },
            {
                "question": "Who is the North Wind in the story?",
                "options": ["A magical woman who takes Diamond on journeys", "A fierce storm", "A fairy", "An angel"],
                "correct": "A"
            },
            {
                "question": "Where does Diamond live?",
                "options": ["In a stable with his parents", "In a house", "On a farm", "In the city"],
                "correct": "A"
            },
            {
                "question": "What does Diamond's father do for a living?",
                "options": ["He is a coachman", "He is a farmer", "He is a stable worker", "He is a blacksmith"],
                "correct": "C"
            },
            {
                "question": "What does the North Wind show Diamond?",
                "options": ["Different places and times", "The future", "The past", "Other worlds"],
                "correct": "A"
            },
            {
                "question": "What happens at the 'back of the North Wind'?",
                "options": ["It is a peaceful place with no suffering", "It is a cold place", "It is a dark place", "It is a magical land"],
                "correct": "A"
            },
            {
                "question": "Who is the old woman that Diamond meets?",
                "options": ["Mrs. Raymond", "Mrs. Crumb", "Mrs. Smith", "Mrs. North"],
                "correct": "A"
            },
            {
                "question": "What does Diamond do that makes him special?",
                "options": ["He has a beautiful singing voice", "He can talk to animals", "He can fly", "He can heal people"],
                "correct": "A"
            },
            {
                "question": "What happens to Diamond at the end of the story?",
                "options": ["He dies and goes to the back of the North Wind", "He grows up and forgets", "He moves away", "He becomes a coachman"],
                "correct": "A"
            },
            {
                "question": "What is the central theme of the book?",
                "options": ["The struggle between good and evil", "The power of innocence and faith", "The importance of family", "The beauty of nature"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "The Book of Three",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Who is the main character of the story?",
                "options": ["Taran", "Gwydion", "Gurgi", "Fflewddur"],
                "correct": "A"
            },
            {
                "question": "What is Taran's title at Caer Dallben?",
                "options": ["Assistant Pig-Keeper", "Stable boy", "Warrior", "Apprentice wizard"],
                "correct": "A"
            },
            {
                "question": "What is the name of the pig Taran must find?",
                "options": ["Hen Wen", "Grumbler", "Princess", "Snowball"],
                "correct": "A"
            },
            {
                "question": "Why is Hen Wen important?",
                "options": ["She is a prize pig", "She is an oracular pig who can see the future", "She is the last of her kind", "She can talk"],
                "correct": "B"
            },
            {
                "question": "Who is the evil Horned King?",
                "options": ["A warlord who serves Arawn", "A mythical creature", "A king of another land", "A sorcerer"],
                "correct": "A"
            },
            {
                "question": "Who is the princess that Taran meets?",
                "options": ["Eilonwy", "Megan", "Arianrhod", "Blodeuwedd"],
                "correct": "A"
            },
            {
                "question": "What is special about Eilonwy?",
                "options": ["She has magical powers", "She is a princess of a royal house with enchantress heritage", "She can fly", "She can talk to animals"],
                "correct": "B"
            },
            {
                "question": "Who is Fflewddur Fflam?",
                "options": ["A bard who tells tall tales", "A warrior", "A king", "A wizard"],
                "correct": "A"
            },
            {
                "question": "What is special about Fflewddur's harp?",
                "options": ["It is magical", "Its strings break when he tells a lie", "It plays itself", "It can charm animals"],
                "correct": "B"
            },
            {
                "question": "Who is Gurgi?",
                "options": ["A hairy creature who joins Taran", "A dwarf", "A talking animal", "A spirit"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "The Black Cauldron",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "What is the Black Cauldron used for?",
                "options": ["To brew potions", "To create undead warriors called Cauldron-born", "To cook food", "To see the future"],
                "correct": "B"
            },
            {
                "question": "Who commands the Cauldron-born?",
                "options": ["Arawn", "The Horned King", "Achren", "Gwydion"],
                "correct": "A"
            },
            {
                "question": "Where must Taran and his companions go to find the Cauldron?",
                "options": ["To Marshes of Morva", "To Annuvin", "To Caer Dathyl", "To Spiral Castle"],
                "correct": "A"
            },
            {
                "question": "Who are the three witches who possess the Cauldron?",
                "options": ["Orddu, Orwen, and Orgoch", "The Weird Sisters", "The Morrigu", "Achren and her sisters"],
                "correct": "A"
            },
            {
                "question": "What must Taran give up to obtain the Cauldron?",
                "options": ["His most prized possession", "His sword", "His freedom", "The brooch of his dreams"],
                "correct": "D"
            },
            {
                "question": "What is the only way the Cauldron can be destroyed?",
                "options": ["By throwing it into a volcano", "By a living person willingly climbing into it", "By magic", "By breaking it with a special weapon"],
                "correct": "B"
            },
            {
                "question": "Who sacrifices himself to destroy the Cauldron?",
                "options": ["Gurgi", "Taran", "Fflewddur", "Gwydion"],
                "correct": "C"
            },
            {
                "question": "What is the name of the prince who joins the quest?",
                "options": ["Ellidyr", "Gwydion", "Coll", "Dallben"],
                "correct": "A"
            },
            {
                "question": "What does Ellidyr do during the quest?",
                "options": ["He betrays the group", "He sacrifices himself to redeem his honor", "He becomes a hero", "He runs away"],
                "correct": "B"
            },
            {
                "question": "What does Taran learn about himself in this book?",
                "options": ["That he is destined to be a king", "That honor and sacrifice are more important than glory", "That he has magical powers", "That he is royalty"],
                "correct": "B"
            }
        ]
    },
    {
        "title": "The Castle of Llyr",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Where is Eilonwy sent to be educated?",
                "options": ["To the Isle of Mona", "To Caer Dallben", "To a convent", "To Annuvin"],
                "correct": "A"
            },
            {
                "question": "Why is Eilonwy being sent away?",
                "options": ["To learn to be a proper princess", "For her safety", "To learn magic", "To meet a prince"],
                "correct": "A"
            },
            {
                "question": "Who kidnaps Eilonwy?",
                "options": ["Achren", "Arawn", "The Horned King", "Mag"],
                "correct": "A"
            },
            {
                "question": "What does Achren want from Eilonwy?",
                "options": ["Her magical powers", "To use Eilonwy's heritage to regain her own power", "To ransom her", "To make her a servant"],
                "correct": "B"
            },
            {
                "question": "Who accompanies Taran on the rescue mission?",
                "options": ["Gurgi, Fflewddur, and Prince Rhun", "Gwydion and Dallben", "Coll and Gurgi", "Fflewddur alone"],
                "correct": "A"
            },
            {
                "question": "Who is Prince Rhun?",
                "options": ["The prince of Mona who is clumsy but kind", "A warrior", "A rival for Eilonwy's affection", "A prince of another land"],
                "correct": "A"
            },
            {
                "question": "Where does Achren take Eilonwy?",
                "options": ["To the Castle of Llyr", "To Annuvin", "To Spiral Castle", "To a mountain"],
                "correct": "A"
            },
            {
                "question": "What is the special item Taran finds in the castle?",
                "options": ["A magical sword", "Eilonwy's golden bauble", "A treasure chest", "A magical book"],
                "correct": "B"
            },
            {
                "question": "What happens to Achren at the end of the story?",
                "options": ["She is killed", "She escapes", "She is imprisoned", "She repents"],
                "correct": "B"
            },
            {
                "question": "What does Eilonwy give up at the end?",
                "options": ["Her magical powers", "Her royal title", "Her memories", "Her golden bauble"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "Taran Wanderer",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Why does Taran leave Caer Dallben?",
                "options": ["To seek his parentage and identity", "To go on a quest", "To find treasure", "To escape"],
                "correct": "A"
            },
            {
                "question": "What does Taran hope to discover?",
                "options": ["Who his parents were", "A magical weapon", "A lost kingdom", "His true destiny"],
                "correct": "A"
            },
            {
                "question": "Who accompanies Taran on part of his journey?",
                "options": ["Gurgi", "Fflewddur", "Coll", "Eilonwy"],
                "correct": "A"
            },
            {
                "question": "What craft does Taran learn from Annlaw Clay-Shaper?",
                "options": ["Pottery", "Blacksmithing", "Weaving", "Woodworking"],
                "correct": "A"
            },
            {
                "question": "What craft does Taran learn from Dwyvach Weaver-Song?",
                "options": ["Weaving", "Pottery", "Smithing", "Farming"],
                "correct": "A"
            },
            {
                "question": "What does Taran learn from Llonio?",
                "options": ["How to catch fish and gather food", "How to fight", "How to farm", "How to navigate"],
                "correct": "A"
            },
            {
                "question": "Who is Dorath?",
                "options": ["A mercenary who steals from Taran", "A farmer who helps Taran", "A lord who befriends Taran", "A thief"],
                "correct": "A"
            },
            {
                "question": "What does Taran lose during his journey?",
                "options": ["His sword", "His money", "His pride", "His way"],
                "correct": "A"
            },
            {
                "question": "What does Taran realize about his parentage?",
                "options": ["He may never know who his parents were", "He is a prince", "He is a commoner", "He is the son of a king"],
                "correct": "A"
            },
            {
                "question": "What lesson does Taran learn by the end of his journey?",
                "options": ["That a person's worth is not determined by birth", "That he must become a warrior", "That he should return home", "That magic is not important"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "The High King",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "What is the main conflict in this final book?",
                "options": ["Taran must unite Prydain against Arawn", "Taran must find a magical sword", "Taran must rescue Eilonwy", "Taran must defeat a dragon"],
                "correct": "A"
            },
            {
                "question": "What is the name of Arawn's domain?",
                "options": ["Annuvin", "Caer Dathyl", "Spiral Castle", "Caer Dallben"],
                "correct": "A"
            },
            {
                "question": "What weapon does Taran use in the final battle?",
                "options": ["Dyrnwyn, the black sword", "A magical bow", "A spear", "A regular sword"],
                "correct": "A"
            },
            {
                "question": "What happens to Dyrnwyn when Taran draws it?",
                "options": ["It bursts into flame", "It glows blue", "It becomes heavy", "It sings"],
                "correct": "A"
            },
            {
                "question": "Who dies in the final battle?",
                "options": ["Gwydion is wounded and Coll sacrifices himself", "Taran dies", "Eilonwy dies", "Gurgi dies"],
                "correct": "A"
            },
            {
                "question": "How does Taran defeat Arawn?",
                "options": ["He uses Dyrnwyn to destroy him", "He tricks Arawn", "He uses magic", "Another character defeats Arawn"],
                "correct": "A"
            },
            {
                "question": "What title does Taran receive at the end?",
                "options": ["High King of Prydain", "King of Caer Dallben", "Lord of Annuvin", "Chieftain of the Companions"],
                "correct": "A"
            },
            {
                "question": "What must the companions do to ensure Arawn never returns?",
                "options": ["Destroy Annuvin", "Seal the Cauldron", "Submerge Dyrnwyn in the lake", "Cast a spell"],
                "correct": "C"
            },
            {
                "question": "What happens to the magical beings of Prydain at the end?",
                "options": ["They leave for the Summer Country", "They become mortal", "They disappear", "They stay in Prydain"],
                "correct": "A"
            },
            {
                "question": "Who does Taran marry at the end?",
                "options": ["Eilonwy", "Achren", "Megan", "No one"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "Westmark",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Who is the main character of Westmark?",
                "options": ["Theo", "Taran", "Florian", "Mickle"],
                "correct": "A"
            },
            {
                "question": "What is Theo's profession at the beginning of the book?",
                "options": ["He is a printer's apprentice", "He is a soldier", "He is a thief", "He is a student"],
                "correct": "A"
            },
            {
                "question": "Why does Theo flee his home?",
                "options": ["He believes he has killed someone in self-defense", "He is accused of theft", "He is being drafted", "He hates his master"],
                "correct": "A"
            },
            {
                "question": "Who does Theo join after fleeing?",
                "options": ["A group of traveling performers led by Florian", "A band of thieves", "The army", "A monastery"],
                "correct": "A"
            },
            {
                "question": "Who is Mickle?",
                "options": ["A street urchin who is actually the princess", "A servant girl", "A performer", "A thief"],
                "correct": "A"
            },
            {
                "question": "What is the name of the kingdom?",
                "options": ["Westmark", "Florin", "Kernember", "Augusta"],
                "correct": "A"
            },
            {
                "question": "Who is the evil minister of Westmark?",
                "options": ["Cabbarus", "Florian", "Augustus", "Lasombra"],
                "correct": "A"
            },
            {
                "question": "What does Cabbarus want?",
                "options": ["To seize the throne", "To control the king", "To start a war", "To find the princess"],
                "correct": "A"
            },
            {
                "question": "What is the relationship between Theo and Dr. Torrens?",
                "options": ["Torrens is a doctor who helps Theo", "Torrens is Theo's father", "Torrens is a villain", "Torrens is a friend"],
                "correct": "A"
            },
            {
                "question": "What happens at the end of the book?",
                "options": ["Mickle is revealed as the true princess and Theo becomes a hero", "Theo becomes king", "Cabbarus wins", "Theo is captured"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "The Kestrel",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Which kingdom is at war in this book?",
                "options": ["Westmark and neighboring Kernember", "Westmark and Florin", "Two unnamed kingdoms", "Kernember and Augusta"],
                "correct": "A"
            },
            {
                "question": "Where does Theo go in this book?",
                "options": ["To the neighboring kingdom of Kernember", "To the battlefield", "To the palace", "To the countryside"],
                "correct": "A"
            },
            {
                "question": "Who is the leader of Kernember?",
                "options": ["Queen Caroline", "King Augustine", "Queen Augusta", "King Lasombra"],
                "correct": "A"
            },
            {
                "question": "What is Theo's role in the war?",
                "options": ["He becomes a soldier and then a commander", "He is a spy", "He is a messenger", "He is a medic"],
                "correct": "A"
            },
            {
                "question": "What happens to Theo during the war?",
                "options": ["He becomes a berserk warrior known as the Kestrel", "He is wounded", "He is captured", "He becomes a hero"],
                "correct": "A"
            },
            {
                "question": "Who is Florian?",
                "options": ["A revolutionary leader", "A soldier", "A king", "A musician"],
                "correct": "A"
            },
            {
                "question": "What does Theo struggle with during the war?",
                "options": ["The violence and his own growing ruthlessness", "Fear of battle", "Missing home", "His loyalty"],
                "correct": "A"
            },
            {
                "question": "What is the significance of the title 'The Kestrel'?",
                "options": ["It is Theo's nickname when he becomes a fierce warrior", "It is a bird of prey", "It is a symbol of war", "It is a regiment name"],
                "correct": "A"
            },
            {
                "question": "What does Theo learn about war?",
                "options": ["That it changes people and can make them cruel", "That war is necessary", "That war is glorious", "That he is a natural warrior"],
                "correct": "A"
            },
            {
                "question": "How does the war end?",
                "options": ["With a peace treaty", "With Westmark's victory", "With Kernember's victory", "With a stalemate"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "The Beggar Queen",
        "author": "Lloyd Alexander",
        "ageGroup": "10-12",
        "pointsValue": 10,
        "questions": [
            {
                "question": "Who is the ruler of Westmark in this book?",
                "options": ["Mickle, now queen", "Theo", "Florian", "Cabbarus"],
                "correct": "A"
            },
            {
                "question": "What is Mickle's real name?",
                "options": ["Augusta", "Caroline", "Maria", "Isabella"],
                "correct": "A"
            },
            {
                "question": "What threatens the stability of Westmark?",
                "options": ["A revolution and conspiracy", "An invasion", "A plague", "A famine"],
                "correct": "A"
            },
            {
                "question": "Who is behind the conspiracy?",
                "options": ["Cabbarus", "Florian", "A group of nobles", "Foreign agents"],
                "correct": "A"
            },
            {
                "question": "What happens to Mickle?",
                "options": ["She is overthrown and goes into hiding", "She is killed", "She surrenders", "She fights back"],
                "correct": "A"
            },
            {
                "question": "What must Theo do?",
                "options": ["Find Mickle and restore her to power", "Fight the revolutionaries", "Flee the country", "Become king"],
                "correct": "A"
            },
            {
                "question": "Who is Justin?",
                "options": ["A revolutionary who becomes Mickle's ally", "A soldier", "A beggar", "A nobleman"],
                "correct": "A"
            },
            {
                "question": "What is the theme of the book?",
                "options": ["Justice and the struggle between monarchy and revolution", "War and peace", "Love and duty", "Power and corruption"],
                "correct": "A"
            },
            {
                "question": "What does Mickle learn as queen?",
                "options": ["That ruling is difficult and requires compromise", "That she is not fit to rule", "That she needs an army", "That she must be cruel"],
                "correct": "A"
            },
            {
                "question": "How does the trilogy end?",
                "options": ["Mickle is restored and Theo chooses his own path", "Theo becomes king", "Mickle abdicates", "The revolution succeeds"],
                "correct": "A"
            }
        ]
    },
    {
        "title": "Amelia Bedelia",
        "author": "Peggy Parish",
        "ageGroup": "6-8",
        "pointsValue": 5,
        "questions": [
            {
                "question": "What is Amelia Bedelia's job?",
                "options": ["She is a housekeeper", "She is a cook", "She is a maid", "She is a nanny"],
                "correct": "A"
            },
            {
                "question": "What is Amelia Bedelia's defining characteristic?",
                "options": ["She takes everything literally", "She is very clumsy", "She is always late", "She cannot read"],
                "correct": "A"
            },
            {
                "question": "Who hires Amelia Bedelia?",
                "options": ["Mr. and Mrs. Rogers", "Mr. and Mrs. Smith", "Mr. and Mrs. Brown", "Mr. and Mrs. Jones"],
                "correct": "A"
            },
            {
                "question": "What happens when Amelia is told to 'draw the drapes'?",
                "options": ["She closes the curtains", "She draws a picture of the drapes", "She opens the curtains", "She removes the drapes"],
                "correct": "B"
            },
            {
                "question": "What does Amelia do when told to 'dust the furniture'?",
                "options": ["She cleans the furniture", "She puts dust on the furniture", "She polishes the furniture", "She moves the furniture"],
                "correct": "B"
            },
            {
                "question": "What does Amelia do when told to 'change the towels'?",
                "options": ["She washes them", "She changes them to different towels", "She cuts them into different shapes", "She folds them"],
                "correct": "C"
            },
            {
                "question": "What does Amelia do when told to 'put out the lights'?",
                "options": ["She turns off the lights", "She hangs the lights outside", "She takes the light bulbs out and puts them in the yard", "She breaks the lights"],
                "correct": "C"
            },
            {
                "question": "What does Amelia do when told to 'dress the chicken'?",
                "options": ["She cooks it", "She puts clothes on the chicken", "She seasons it", "She cleans it"],
                "correct": "B"
            },
            {
                "question": "What does Amelia do when told to 'trim the fat'?",
                "options": ["She cuts off the fat", "She decorates the fat with ribbons", "She throws away the fat", "She weighs the fat"],
                "correct": "B"
            },
            {
                "question": "How do the Rogerses feel about Amelia Bedelia at the end?",
                "options": ["They fire her", "They keep her because her lemon meringue pie is delicious", "They send her to school", "They replace her"],
                "correct": "B"
            }
        ]
    }
]

# Verify all books have exactly 10 questions
for i, book in enumerate(quizzes):
    assert len(book["questions"]) == 10, f"Book {i+1} '{book['title']}' has {len(book['questions'])} questions, expected 10"

# Verify correct answer distribution
for i, book in enumerate(quizzes):
    answers = [q["correct"] for q in book["questions"]]
    print(f"Book {i+1}: {book['title']} - A:{answers.count('A')}, B:{answers.count('B')}, C:{answers.count('C')}, D:{answers.count('D')}")

print(f"\nTotal books: {len(quizzes)}")
print(f"Total questions: {sum(len(b['questions']) for b in quizzes)}")

# Save to file
with open("/home/user/workspace/bookquiz/quizzes_batch_4.json", "w") as f:
    json.dump(quizzes, f, indent=2)

print("\nSaved to /home/user/workspace/bookquiz/quizzes_batch_4.json")
