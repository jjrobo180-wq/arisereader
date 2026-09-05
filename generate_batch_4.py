#!/usr/bin/env python3
"""Generate quiz questions for batch 4 books."""
import json

questions_data = []

# ============================================================
# 1. Speak by Laurie Halse Anderson
# ============================================================
speak_questions = [
    {"question_order": 1, "question_text": "What is the name of the protagonist in Speak?", "option_a": "Rachel", "option_b": "Heather", "option_c": "Melinda Sordino", "option_d": "Nicky", "correct_answer": "c"},
    {"question_order": 2, "question_text": "What event causes Melinda to stop speaking?", "option_a": "A car accident", "option_b": "An assault at a summer party", "option_c": "Her parents' divorce", "option_d": "A fight with her best friend", "correct_answer": "b"},
    {"question_order": 3, "question_text": "Which class does Melinda find refuge in and use as a form of self-expression?", "option_a": "Art class", "option_b": "Music class", "option_c": "Drama class", "option_d": "Creative writing", "correct_answer": "a"},
    {"question_order": 4, "question_text": "What tree does Melinda repeatedly draw and sculpt as a symbol of her emotional state?", "option_a": "An oak tree", "option_b": "A pine tree", "option_c": "A cherry tree", "option_d": "A willow tree", "correct_answer": "a"},
    {"question_order": 5, "question_text": "Who is the senior boy who assaulted Melinda at the summer party?", "option_a": "Andy Evans", "option_b": "David Petrakis", "option_c": "Kyle Rodgers", "option_d": "Eric", "correct_answer": "a"},
    {"question_order": 6, "question_text": "What does Melinda call the boy who assaulted her throughout the novel?", "option_a": "The Beast", "option_b": "IT", "option_c": "The Monster", "option_d": "Him", "correct_answer": "b"},
    {"question_order": 7, "question_text": "Who is Melinda's lab partner and one of the few people who treats her kindly?", "option_a": "Rachel", "option_b": "Heather", "option_c": "David Petrakis", "option_d": "Ivy", "correct_answer": "c"},
    {"question_order": 8, "question_text": "What does Melinda do to help herself find her voice at the end of the novel?", "option_a": "Writes a letter to the school", "option_b": "Confronts Andy Evans and fights back", "option_c": "Calls the police", "option_d": "Runs away from home", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What is the name of the school mascot that changes during the novel?", "option_a": "The Hornets", "option_b": "The Trojans", "option_c": "The Merryweather Bees", "option_d": "The Bears", "correct_answer": "c"},
    {"question_order": 10, "question_text": "Who does Melinda's former best friend Rachel start dating?", "option_a": "David Petrakis", "option_b": "Andy Evans", "option_c": "Kyle Rodgers", "option_d": "Greta-Ingrid", "correct_answer": "b"},
]
questions_data.append({"title": "Speak", "questions": speak_questions})

# ============================================================
# 2. Twisted by Laurie Halse Anderson
# ============================================================
twisted_questions = [
    {"question_order": 1, "question_text": "What is the name of the main character in Twisted?", "option_a": "Tyler Miller", "option_b": "Chip Matthews", "option_c": "Parker", "option_d": "Evan", "correct_answer": "a"},
    {"question_order": 2, "question_text": "What did Tyler do that got him in trouble with the law before the story begins?", "option_a": "Stole a car", "option_b": "Spray-painted graffiti on school property", "option_c": "Got into a fight", "option_d": "Hacked the school's computer", "correct_answer": "b"},
    {"question_order": 3, "question_text": "What summer activity does Tyler do to build up his physique?", "option_a": "Football camp", "option_b": "Swimming", "option_c": "Landscaping and yard work", "option_d": "Weightlifting class", "correct_answer": "c"},
    {"question_order": 4, "question_text": "Who is the popular girl that Tyler has a crush on?", "option_a": "Bethany Milbury", "option_b": "Yoda", "option_c": "Parker", "option_d": "Hannah", "correct_answer": "a"},
    {"question_order": 5, "question_text": "What is the name of Tyler's friend who gives him the nickname 'Mouse'?", "option_a": "Chip", "option_b": "Adam Don", "option_c": "Yoda", "option_d": "Parker", "correct_answer": "c"},
    {"question_order": 6, "question_text": "What false accusation is Tyler facing at school?", "option_a": "Stealing from the school", "option_b": "Sexually assaulting a girl", "option_c": "Cheating on tests", "option_d": "Vandalizing the principal's office", "correct_answer": "b"},
    {"question_order": 7, "question_text": "What is Tyler's father's personality like?", "option_a": "Warm and supportive", "option_b": "Abusive and controlling", "option_c": "Absent and neglectful", "option_d": "Funny and laid-back", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What does Tyler consider doing when the pressure becomes overwhelming?", "option_a": "Running away", "option_b": "Dropping out of school", "option_c": "Suicide", "option_d": "Joining the military", "correct_answer": "c"},
    {"question_order": 9, "question_text": "What does Tyler ultimately decide to do about his situation?", "option_a": "Run away from home", "option_b": "Take legal action and speak the truth", "option_c": "Transfer schools", "option_d": "Join the military", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What does Tyler learn about social expectations and masculinity?", "option_a": "That being popular is all that matters", "option_b": "That real strength comes from honesty, not violence", "option_c": "That he should conform to what others expect", "option_d": "That revenge is the best response", "correct_answer": "b"},
]
questions_data.append({"title": "Twisted", "questions": twisted_questions})

# ============================================================
# 3. Wintergirls by Laurie Halse Anderson
# ============================================================
wintergirls_questions = [
    {"question_order": 1, "question_text": "What is the name of the protagonist in Wintergirls?", "option_a": "Cassie", "option_b": "Lia", "option_c": "Emma", "option_d": "Chloe", "correct_answer": "b"},
    {"question_order": 2, "question_text": "What eating disorder does Lia struggle with?", "option_a": "Binge eating", "option_b": "Anorexia nervosa", "option_c": "Bulimia", "option_d": "Compulsive overeating", "correct_answer": "b"},
    {"question_order": 3, "question_text": "What happened to Lia's best friend Cassie?", "option_a": "She moved away", "option_b": "She died alone in a motel room", "option_c": "She was hospitalized", "option_d": "She went missing", "correct_answer": "b"},
    {"question_order": 4, "question_text": "What does Lia use to cope with her emotions and guilt?", "option_a": "Exercise", "option_b": "Cutting herself", "option_c": "Journaling", "option_d": "Talking to friends", "correct_answer": "b"},
    {"question_order": 5, "question_text": "How many times does Lia call Cassie's phone after her death?", "option_a": "Once", "option_b": "Five times", "option_c": "Thirty-three times", "option_d": "One hundred times", "correct_answer": "c"},
    {"question_order": 6, "question_text": "Who is Lia's stepsister who cares about her?", "option_a": "Emma", "option_b": "Chloe", "option_c": "Jennifer", "option_d": "Sarah", "correct_answer": "a"},
    {"question_order": 7, "question_text": "What does Lia's ghostly vision of Cassie try to get her to do?", "option_a": "Seek help", "option_b": "Eat more", "option_c": "Starve herself to death", "option_d": "Call her mother", "correct_answer": "c"},
    {"question_order": 8, "question_text": "What is Lia's goal weight that she is constantly striving for?", "option_a": "100 pounds", "option_b": "85 pounds", "option_c": "90 pounds", "option_d": "95 pounds", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What does Lia's mother do for a living?", "option_a": "A doctor", "option_b": "A lawyer", "option_c": "A teacher", "option_d": "A nurse", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What realization does Lia come to by the end of the novel?", "option_a": "That she needs to keep losing weight", "option_b": "That she must choose life and seek recovery", "option_c": "That Cassie's ghost was real", "option_d": "That her parents are to blame", "correct_answer": "b"},
]
questions_data.append({"title": "Wintergirls", "questions": wintergirls_questions})

# ============================================================
# 4. The House of the Scorpion by Nancy Farmer
# ============================================================
scorpion_questions = [
    {"question_order": 1, "question_text": "What is the name of the clone protagonist in The House of the Scorpion?", "option_a": "Mateo", "option_b": "Matt", "option_c": "Celia", "option_d": "Tam Lin", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Who is the powerful drug lord that Matt is a clone of?", "option_a": "El Patron", "option_b": "El Jefe", "option_c": "Don Eduardo", "option_d": "El Diablo", "correct_answer": "a"},
    {"question_order": 3, "question_text": "What is the legal status of clones in this dystopian society?", "option_a": "They are treated as equal citizens", "option_b": "They are considered livestock and harvested for organs", "option_c": "They are enslaved as soldiers", "option_d": "They are exiled", "correct_answer": "b"},
    {"question_order": 4, "question_text": "What is special about Matt's brain compared to other clones?", "option_a": "It is damaged", "option_b": "It was left intact rather than destroyed at birth", "option_c": "It has a computer chip", "option_d": "It is extra large", "correct_answer": "b"},
    {"question_order": 5, "question_text": "Who is the woman who raises Matt and shows him love and care?", "option_a": "Maria", "option_b": "Rosa", "option_c": "Celia", "option_d": "Esperanza", "correct_answer": "c"},
    {"question_order": 6, "question_text": "Who is the bodyguard/father figure who teaches Matt about life and nature?", "option_a": "Tom", "option_b": "Tam Lin", "option_c": "Felipe", "option_d": "Chacho", "correct_answer": "b"},
    {"question_order": 7, "question_text": "Where is El Patron's estate located?", "option_a": "In the United States", "option_b": "In Opium, a country between the US and Mexico", "option_c": "In Mexico", "option_d": "In Colombia", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What does Matt discover about his purpose as El Patron's clone?", "option_a": "He is meant to inherit the empire", "option_b": "He was created to provide donor organs for El Patron", "option_c": "He was created to be a soldier", "option_d": "He was created to replace El Patron publicly", "correct_answer": "b"},
    {"question_order": 9, "question_text": "Where does Matt escape to after El Patron's death?", "option_a": "The United States", "option_b": "Mexico", "option_c": "Aztlán", "option_d": "Colombia", "correct_answer": "c"},
    {"question_order": 10, "question_text": "What does Matt do at the end of the novel?", "option_a": "Returns to Opium to take over El Patron's empire", "option_b": "Destroys the cloning facilities", "option_c": "Escapes to the United States", "option_d": "Becomes a farmer", "correct_answer": "a"},
]
questions_data.append({"title": "The House of the Scorpion", "questions": scorpion_questions})

# ============================================================
# 5. The Sea of Trolls by Nancy Farmer
# ============================================================
sea_trolls_questions = [
    {"question_order": 1, "question_text": "What is the name of the young bard protagonist in The Sea of Trolls?", "option_a": "Jack", "option_b": "Eric", "option_c": "Thorgil", "option_d": "Olaf", "correct_answer": "a"},
    {"question_order": 2, "question_text": "Who trains Jack as a bard?", "option_a": "The Bard", "option_b": "Brother Aiden", "option_c": "Lucy", "option_d": "Father Swein", "correct_answer": "a"},
    {"question_order": 3, "question_text": "What historical setting is the novel based in?", "option_a": "Medieval France", "option_b": "Anglo-Saxon England", "option_c": "Ancient Rome", "option_d": "Viking-age Scandinavia", "correct_answer": "b"},
    {"question_order": 4, "question_text": "Who captures Jack and his sister Lucy?", "option_a": "The Berserkers", "option_b": "The Normans", "option_c": "The Romans", "option_d": "The Picts", "correct_answer": "a"},
    {"question_order": 5, "question_text": "What is the name of the Viking leader who takes Jack captive?", "option_a": "Olaf One-Brow", "option_b": "Thorgil", "option_c": "Ragnar", "option_d": "Erik", "correct_answer": "a"},
    {"question_order": 6, "question_text": "Who is the shield maiden who becomes Jack's companion?", "option_a": "Freya", "option_b": "Thorgil", "option_c": "Lucy", "option_d": "Gretel", "correct_answer": "b"},
    {"question_order": 7, "question_text": "What must Jack and Thorgil do to save Lucy from the trolls?", "option_a": "Fight the troll king", "option_b": "Find Mimir's Well and drink from it", "option_c": "Steal a magical sword", "option_d": "Complete a series of riddles", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What do Jack and Thorgil find at Mimir's Well?", "option_a": "A golden treasure", "option_b": "A troll king", "option_c": "The life force and wisdom of the well", "option_d": "A magical sword", "correct_answer": "c"},
    {"question_order": 9, "question_text": "What Norse mythological figure is referenced in the story?", "option_a": "Odin", "option_b": "Thor", "option_c": "Loki", "option_d": "All of the above", "correct_answer": "d"},
    {"question_order": 10, "question_text": "What is the relationship between Jack and Lucy?", "option_a": "They are friends", "option_b": "They are siblings", "option_c": "They are cousins", "option_d": "They are strangers", "correct_answer": "b"},
]
questions_data.append({"title": "The Sea of Trolls", "questions": sea_trolls_questions})

# ============================================================
# 6. The Land of the Silver Apples by Nancy Farmer
# ============================================================
silver_apples_questions = [
    {"question_order": 1, "question_text": "What is the name of the protagonist in The Land of the Silver Apples?", "option_a": "Jack", "option_b": "Thorgil", "option_c": "Pega", "option_d": "Lucy", "correct_answer": "a"},
    {"question_order": 2, "question_text": "Who has been kidnapped, prompting Jack's quest?", "option_a": "Lucy", "option_b": "Thorgil", "option_c": "Pega", "option_d": "The Bard", "correct_answer": "a"},
    {"question_order": 3, "question_text": "What land does Jack travel to in search of Lucy?", "option_a": "The Land of the Silver Apples", "option_b": "Jotunheim", "option_c": "Avalon", "option_d": "Elfland", "correct_answer": "d"},
    {"question_order": 4, "question_text": "What creatures rule the land Jack enters?", "option_a": "Trolls", "option_b": "Elves", "option_c": "Dragons", "option_d": "Giants", "correct_answer": "b"},
    {"question_order": 5, "question_text": "Who accompanies Jack on his quest?", "option_a": "Thorgil", "option_b": "Pega", "option_c": "The Bard", "option_d": "All of the above", "correct_answer": "d"},
    {"question_order": 6, "question_text": "What is Pega's special ability?", "option_a": "She can heal", "option_b": "She can see the future", "option_c": "She can talk to animals", "option_d": "She can breathe underwater", "correct_answer": "a"},
    {"question_order": 7, "question_text": "What must Jack do to free Lucy?", "option_a": "Fight the elf king", "option_b": "Play his harp for the elves", "option_c": "Solve a riddle", "option_d": "Steal the silver apples", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What happens to Thorgil in the story?", "option_a": "She becomes an elf", "option_b": "She is captured by trolls", "option_c": "She is transformed into a different creature", "option_d": "She becomes queen", "correct_answer": "c"},
    {"question_order": 9, "question_text": "What do the silver apples represent?", "option_a": "Wealth and power", "option_b": "Immortality", "option_c": "Knowledge and healing", "option_d": "Love and friendship", "correct_answer": "c"},
    {"question_order": 10, "question_text": "What does Jack learn about the elves?", "option_a": "They are kind and generous", "option_b": "They are cruel and beautiful but lack empathy", "option_c": "They are cowardly", "option_d": "They are simple-minded", "correct_answer": "b"},
]
questions_data.append({"title": "The Land of the Silver Apples", "questions": silver_apples_questions})

# ============================================================
# 7. The Islands of the Blessed by Nancy Farmer
# ============================================================
islands_questions = [
    {"question_order": 1, "question_text": "Who is the main protagonist of The Islands of the Blessed?", "option_a": "Jack", "option_b": "Thorgil", "option_c": "Pega", "option_d": "The Bard", "correct_answer": "a"},
    {"question_order": 2, "question_text": "What threat do Jack and his companions face in this novel?", "option_a": "Norman invaders", "option_b": "Viking raiders", "option_c": "Roman soldiers", "option_d": "Dragons", "correct_answer": "a"},
    {"question_order": 3, "question_text": "What quest must the characters undertake?", "option_a": "To find a lost treasure", "option_b": "To retrieve stolen items and save their land", "option_c": "To defeat a dragon", "option_d": "To find the Holy Grail", "correct_answer": "b"},
    {"question_order": 4, "question_text": "Who is the Bard's true identity revealed to be?", "option_a": "A Norse god", "option_b": "A former king", "option_c": "A dragon in disguise", "option_d": "A fallen angel", "correct_answer": "c"},
    {"question_order": 5, "question_text": "What is Thorgil's character arc throughout the series?", "option_a": "She becomes more violent", "option_b": "She learns compassion and humanity", "option_c": "She becomes queen", "option_d": "She loses her memory", "correct_answer": "b"},
    {"question_order": 6, "question_text": "What mythical creatures appear in the novel?", "option_a": "Trolls and elves", "option_b": "Dragons and kelpies", "option_c": "Unicorns", "option_d": "Mermaids", "correct_answer": "b"},
    {"question_order": 7, "question_text": "Where do Jack and his companions travel?", "option_a": "To Rome", "option_b": "To the Islands of the Blessed", "option_c": "To Jotunheim", "option_d": "To Avalon", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What does Jack use as his primary skill/tool?", "option_a": "A sword", "option_b": "His bardic abilities and harp", "option_c": "Magic spells", "option_d": "Archery", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What does the Bard sacrifice to help the group?", "option_a": "His memory", "option_b": "His immortality", "option_c": "His life force", "option_d": "His powers", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What is the overall theme of the Sea of Trolls trilogy?", "option_a": "War and conquest", "option_b": "Friendship, sacrifice, and the power of stories", "option_c": "Revenge and justice", "option_d": "Survival of the fittest", "correct_answer": "b"},
]
questions_data.append({"title": "The Islands of the Blessed", "questions": islands_questions})

# ============================================================
# 8. A Girl Named Disaster by Nancy Farmer
# ============================================================
disaster_questions = [
    {"question_order": 1, "question_text": "What is the name of the young protagonist in A Girl Named Disaster?", "option_a": "Nhamo", "option_b": "Chipo", "option_c": "Tambudzai", "option_d": "Netsai", "correct_answer": "a"},
    {"question_order": 2, "question_text": "In what country does the story begin?", "option_a": "Zimbabwe", "option_b": "Mozambique", "option_c": "Zambia", "option_d": "Tanzania", "correct_answer": "b"},
    {"question_order": 3, "question_text": "What is Nhamo forced to do by her family?", "option_a": "Work in the fields", "option_b": "Marry a cruel man as a third wife", "option_c": "Leave school", "option_d": "Become a servant", "correct_answer": "b"},
    {"question_order": 4, "question_text": "How does Nhamo escape her situation?", "option_a": "She runs to the city", "option_b": "She travels down the river in a boat", "option_c": "She hides in the mountains", "option_d": "She joins a caravan", "correct_answer": "b"},
    {"question_order": 5, "question_text": "What river does Nhamo travel down?", "option_a": "The Zambezi River", "option_b": "The Congo River", "option_c": "The Limpopo River", "option_d": "The Nile", "correct_answer": "a"},
    {"question_order": 6, "question_text": "What does Nhamo rely on for guidance during her journey?", "option_a": "Her grandmother's teachings and spirit stories", "option_b": "A map", "option_c": "A radio", "option_d": "A compass", "correct_answer": "a"},
    {"question_order": 7, "question_text": "What does Nhamo encounter that poses a danger during her river journey?", "option_a": "Pirates", "option_b": "Crocodiles and leopards", "option_c": "Hostile soldiers", "option_d": "A waterfall", "correct_answer": "b"},
    {"question_order": 8, "question_text": "Where does Nhamo eventually arrive at the end of her journey?", "option_a": "A city in South Africa", "option_b": "Zimbabwe, where she finds help", "option_c": "A refugee camp", "option_d": "A mission station in Zimbabwe", "correct_answer": "d"},
    {"question_order": 9, "question_text": "What language does Nhamo speak?", "option_a": "Swahili", "option_b": "Shona", "option_c": "Zulu", "option_d": "Amharic", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What does Nhamo's name mean in her language?", "option_a": "Strength", "option_b": "Disaster", "option_c": "River", "option_d": "Hope", "correct_answer": "b"},
]
questions_data.append({"title": "A Girl Named Disaster", "questions": disaster_questions})

# ============================================================
# 9. The Ear the Eye and the Arm by Nancy Farmer
# ============================================================
ear_eye_arm_questions = [
    {"question_order": 1, "question_text": "In what country and time period is The Ear, the Eye, and the Arm set?", "option_a": "Future Kenya", "option_b": "Future Zimbabwe", "option_c": "Future South Africa", "option_d": "Present-day Nigeria", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Who are the three detectives with unusual abilities?", "option_a": "The Ear, the Eye, and the Arm", "option_b": "The Nose, the Mouth, and the Hand", "option_c": "The Mind, the Body, and the Soul", "option_d": "The Head, the Heart, and the Hand", "correct_answer": "a"},
    {"question_order": 3, "question_text": "What are the Ear, the Eye, and the Arm searching for?", "option_a": "A stolen treasure", "option_b": "Three missing children", "option_c": "A murderer", "option_d": "A lost city", "correct_answer": "b"},
    {"question_order": 4, "question_text": "Who are the three missing children?", "option_a": "Tendai, Rita, and Kuda", "option_b": "Tendai, Rita, and Nokoma", "option_c": "Tendai, Rita, and Chipo", "option_d": "Tendai, Rita, and Nhamo", "correct_answer": "a"},
    {"question_order": 5, "question_text": "Whose children are the missing kids?", "option_a": "A wealthy general", "option_b": "The president", "option_c": "A famous scientist", "option_d": "A traditional chief", "correct_answer": "a"},
    {"question_order": 6, "question_text": "What is the Ear's special ability?", "option_a": "Super hearing", "option_b": "He can read minds", "option_c": "He can see through walls", "option_d": "He can fly", "correct_answer": "a"},
    {"question_order": 7, "question_text": "What is the Eye's special ability?", "option_a": "He can see through walls", "option_b": "He can see the future", "option_c": "He can see great distances", "option_d": "He can see in the dark", "correct_answer": "c"},
    {"question_order": 8, "question_text": "What is the Arm's special ability?", "option_a": "Super strength", "option_b": "He can read thoughts and emotions", "option_c": "He can stretch his limbs", "option_d": "He can become invisible", "correct_answer": "b"},
    {"question_order": 9, "question_text": "Where do the children first end up after running away?", "option_a": "In the dangerous areas of the city", "option_b": "In a secret government facility", "option_c": "In the wilderness", "option_d": "In a neighboring country", "correct_answer": "a"},
    {"question_order": 10, "question_text": "What is the overarching theme of the novel?", "option_a": "The dangers of technology", "option_b": "The importance of family and cultural identity", "option_c": "The power of money", "option_d": "The futility of war", "correct_answer": "b"},
]
questions_data.append({"title": "The Ear the Eye and the Arm", "questions": ear_eye_arm_questions})

# ============================================================
# 10. The Graveyard Book by Neil Gaiman
# ============================================================
graveyard_questions = [
    {"question_order": 1, "question_text": "What is the name of the boy raised by ghosts in The Graveyard Book?", "option_a": "Nobody Owens", "option_b": "Jack Frost", "option_c": "Silas", "option_d": "Bod", "correct_answer": "d"},
    {"question_order": 2, "question_text": "What is Bod's full name given to him by the ghosts?", "option_a": "Nobody Owens", "option_b": "Bodhi Owens", "option_c": "Body Owens", "option_d": "Norman Owens", "correct_answer": "a"},
    {"question_order": 3, "question_text": "Who is the mysterious guardian who takes care of Bod?", "option_a": "Mr. Owens", "option_b": "Silas", "option_c": "Miss Lupescu", "option_d": "The Lady on the Grey", "correct_answer": "b"},
    {"question_order": 4, "question_text": "Who killed Bod's family when he was a baby?", "option_a": "A group of thieves", "option_b": "A man named Jack", "option_c": "A ghost", "option_d": "A vampire", "correct_answer": "b"},
    {"question_order": 5, "question_text": "What organization does Jack belong to?", "option_a": "The Jacks of All Trades", "option_b": "The Honour Guard", "option_c": "The Night Watch", "option_d": "The Dead Men", "correct_answer": "a"},
    {"question_order": 6, "question_text": "What ability does Bod learn from the ghosts?", "option_a": "Flying", "option_b": "Fading (becoming invisible)", "option_c": "Reading minds", "option_d": "Teleportation", "correct_answer": "b"},
    {"question_order": 7, "question_text": "Who is the girl who becomes Bod's friend from the living world?", "option_a": "Scarlett", "option_b": "Liza", "option_c": "Mo", "option_d": "Abigail", "correct_answer": "a"},
    {"question_order": 8, "question_text": "What is the Sleer that guards the treasure in the graveyard?", "option_a": "A ghost", "option_b": "A serpent-like creature", "option_c": "A demon", "option_d": "A gargoyle", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What does Bod ultimately do at the end of the novel?", "option_a": "Becomes a ghost permanently", "option_b": "Leaves the graveyard to live in the world of the living", "option_c": "Becomes a guardian of the graveyard", "option_d": "Joins the Jacks", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What does Silas reveal himself to be?", "option_a": "A ghost", "option_b": "A vampire", "option_c": "An angel", "option_d": "A wizard", "correct_answer": "b"},
]
questions_data.append({"title": "The Graveyard Book", "questions": graveyard_questions})

# ============================================================
# 11. Coraline by Neil Gaiman
# ============================================================
coraline_questions = [
    {"question_order": 1, "question_text": "What is the name of the young girl protagonist in Coraline?", "option_a": "Caroline", "option_b": "Coraline", "option_c": "Corinne", "option_d": "Carrie", "correct_answer": "b"},
    {"question_order": 2, "question_text": "What does Coraline discover in her new home?", "option_a": "A secret garden", "option_b": "A small locked door leading to another world", "option_c": "A hidden room", "option_d": "A magical book", "correct_answer": "b"},
    {"question_order": 3, "question_text": "Who is the main antagonist in the parallel world?", "option_a": "The Other Father", "option_b": "The Other Mother", "option_c": "The Other Cat", "option_d": "The Old Lady", "correct_answer": "b"},
    {"question_order": 4, "question_text": "What is distinctive about the Other Mother?", "option_a": "She has black button eyes", "option_b": "She has no mouth", "option_c": "She has wings", "option_d": "She is made of glass", "correct_answer": "a"},
    {"question_order": 5, "question_text": "What does the Other Mother want from Coraline?", "option_a": "Her money", "option_b": "To stay forever and let her sew buttons on her eyes", "option_c": "To play games", "option_d": "To find a treasure", "correct_answer": "b"},
    {"question_order": 6, "question_text": "Who helps Coraline in the parallel world?", "option_a": "A talking dog", "option_b": "A talking cat", "option_c": "A ghost child", "option_d": "The Other Father", "correct_answer": "b"},
    {"question_order": 7, "question_text": "What must Coraline do to save herself?", "option_a": "Find a way home", "option_b": "Find the souls of the ghost children and her parents", "option_c": "Defeat the Other Mother in a fight", "option_d": "Destroy the parallel world", "correct_answer": "b"},
    {"question_order": 8, "question_text": "How many ghost children's souls does Coraline need to find?", "option_a": "One", "option_b": "Two", "option_c": "Three", "option_d": "Five", "correct_answer": "c"},
    {"question_order": 9, "question_text": "What is the game Coraline plays with the Other Mother?", "option_a": "A riddle contest", "option_b": "A hide-and-seek for the souls and her parents", "option_c": "A chess match", "option_d": "A race", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What does Coraline do with the key at the end of the story?", "option_a": "Keeps it as a souvenir", "option_b": "Throws it into a well to be rid of it", "option_c": "Locks the door forever", "option_d": "Gives it to the cat", "correct_answer": "b"},
]
questions_data.append({"title": "Coraline", "questions": coraline_questions})

# ============================================================
# 12. The Ocean at the End of the Lane by Neil Gaiman
# ============================================================
ocean_lane_questions = [
    {"question_order": 1, "question_text": "What prompts the narrator to return to his childhood home?", "option_a": "A letter from an old friend", "option_b": "A funeral", "option_c": "A dream", "option_d": "Selling his parents' house", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Who is the girl who lives at the end of the lane?", "option_a": "Lettie Hempstock", "option_b": "Old Mrs. Hempstock", "option_c": "Ginnie Hempstock", "option_d": "Ursula Monkton", "correct_answer": "a"},
    {"question_order": 3, "question_text": "What do the Hempstock women claim the pond behind their house is?", "option_a": "A swimming pool", "option_b": "An ocean", "option_c": "A well", "option_d": "A lake", "correct_answer": "b"},
    {"question_order": 4, "question_text": "What does the opal miner do that triggers the supernatural events?", "option_a": "He digs up something ancient", "option_b": "He commits suicide in the narrator's car", "option_c": "He steals from the Hempstocks", "option_d": "He opens a portal", "correct_answer": "b"},
    {"question_order": 5, "question_text": "Who is the supernatural entity that arrives and causes trouble?", "option_a": "Ursula Monkton", "option_b": "The Hunger Birds", "option_c": "The Flea", "option_d": "The Skarthatch", "correct_answer": "a"},
    {"question_order": 6, "question_text": "What does Ursula Monkton become to the narrator's family?", "option_a": "A neighbor", "option_b": "The new nanny/housekeeper", "option_c": "A teacher", "option_d": "A relative", "correct_answer": "b"},
    {"question_order": 7, "question_text": "What do the hunger birds do?", "option_a": "They protect the narrator", "option_b": "They clean up the world of supernatural remnants", "option_c": "They eat crops", "option_d": "They guide lost souls", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What sacrifice does Lettie make to protect the narrator?", "option_a": "She gives up her powers", "option_b": "She lets herself be taken by the hunger birds", "option_c": "She gives up her memories", "option_d": "She gives up her life", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What does the narrator forget about his childhood?", "option_a": "Everything", "option_b": "The supernatural events, until he visits the pond again", "option_c": "His family", "option_d": "Lettie's name", "correct_answer": "b"},
    {"question_order": 10, "question_text": "Who is the narrator as an adult?", "option_a": "A writer", "option_b": "An artist", "option_c": "A scientist", "option_d": "A teacher", "correct_answer": "a"},
]
questions_data.append({"title": "The Ocean at the End of the Lane", "questions": ocean_lane_questions})

# ============================================================
# 13. Fortunately, the Milk by Neil Gaiman
# ============================================================
milk_questions = [
    {"question_order": 1, "question_text": "What does the father go out to buy in Fortunately, the Milk?", "option_a": "Bread", "option_b": "Milk", "option_c": "Eggs", "option_d": "Cereal", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Why is the father's errand taking so long?", "option_a": "He got lost", "option_b": "He had an extraordinary adventure", "option_c": "He met a friend", "option_d": "He fell asleep", "correct_answer": "b"},
    {"question_order": 3, "question_text": "What does the father encounter that starts his adventure?", "option_a": "A dinosaur", "option_b": "An alien spaceship", "option_c": "A time machine", "option_d": "A pirate ship", "correct_answer": "b"},
    {"question_order": 4, "question_text": "Who are the aliens that abduct the father?", "option_a": "The Globefish", "option_b": "The Splodons", "option_c": "The Mogons", "option_d": "The Volcrons", "correct_answer": "c"},
    {"question_order": 5, "question_text": "What do the aliens want from Earth?", "option_a": "Water", "option_b": "To conquer it", "option_c": "To steal its resources", "option_d": "To make friends", "correct_answer": "a"},
    {"question_order": 6, "question_text": "What does the father travel through during his adventure?", "option_a": "Space only", "option_b": "Time and space", "option_c": "Different dimensions", "option_d": "Underground tunnels", "correct_answer": "b"},
    {"question_order": 7, "question_text": "What prehistoric creature does the father encounter?", "option_a": "A T. rex", "option_b": "A triceratops", "option_c": "A stegosaurus", "option_d": "A pterodactyl", "correct_answer": "a"},
    {"question_order": 8, "question_text": "Who does the father meet that helps him on his adventure?", "option_a": "A talking dinosaur", "option_b": "A professor", "option_c": "A fairy", "option_d": "A pirate", "correct_answer": "a"},
    {"question_order": 9, "question_text": "What does the father bring back at the end of his adventure?", "option_a": "Just the milk", "option_b": "Milk and souvenirs", "option_c": "A magical artifact", "option_d": "Nothing", "correct_answer": "a"},
    {"question_order": 10, "question_text": "What is the tone of the story?", "option_a": "Dark and scary", "option_b": "Humorous and whimsical", "option_c": "Sad and tragic", "option_d": "Serious and dramatic", "correct_answer": "b"},
]
questions_data.append({"title": "Fortunately the Milk", "questions": milk_questions})

# ============================================================
# 14. Stardust by Neil Gaiman
# ============================================================
stardust_questions = [
    {"question_order": 1, "question_text": "What is the name of the young man who ventures into Faerie in Stardust?", "option_a": "Tristran Thorn", "option_b": "Tristan Thorn", "option_c": "Septimus", "option_d": "Dunstan", "correct_answer": "a"},
    {"question_order": 2, "question_text": "What does Tristran promise to retrieve for Victoria, the woman he loves?", "option_a": "A fallen star", "option_b": "A golden crown", "option_c": "A magical sword", "option_d": "A rare flower", "correct_answer": "a"},
    {"question_order": 3, "question_text": "What does Tristran find when he reaches the fallen star?", "option_a": "A glowing rock", "option_b": "A woman, the star in human form", "option_c": "A small creature", "option_d": "A magical gem", "correct_answer": "b"},
    {"question_order": 4, "question_text": "What is the fallen star's name?", "option_a": "Yvaine", "option_b": "Semele", "option_c": "Una", "option_d": "Dycha", "correct_answer": "a"},
    {"question_order": 5, "question_text": "Who are the seven lords seeking the star?", "option_a": "The Lords of Stormhold", "option_b": "The Lords of the Highlands", "option_c": "The Brothers Grimm", "option_d": "The Fairy Kings", "correct_answer": "a"},
    {"question_order": 6, "question_text": "Why do the lords want the star?", "option_a": "To use its power", "option_b": "To bring it to their father the king", "option_c": "For its beauty", "option_d": "To sell it", "correct_answer": "b"},
    {"question_order": 7, "question_text": "Who are the witches pursuing the star?", "option_a": "The Lilim", "option_b": "The Fates", "option_c": "The Sorceresses", "option_d": "The Coven", "correct_answer": "a"},
    {"question_order": 8, "question_text": "Why do the Lilim want the star?", "option_a": "To gain eternal youth", "option_b": "To gain power", "option_c": "To destroy Faerie", "option_d": "To find a lost sister", "correct_answer": "a"},
    {"question_order": 9, "question_text": "What does Tristran discover about his parentage?", "option_a": "He is a fairy prince", "option_b": "He is a descendant of a fairy and a human", "option_c": "He is a star himself", "option_d": "He is the son of a king", "correct_answer": "b"},
    {"question_order": 10, "question_text": "Who does Tristran ultimately fall in love with?", "option_a": "Victoria", "option_b": "Yvaine", "option_c": "Una", "option_d": "Semele", "correct_answer": "b"},
]
questions_data.append({"title": "Stardust", "questions": stardust_questions})

# ============================================================
# 15. The Princess Bride by William Goldman
# ============================================================
princess_bride_questions = [
    {"question_order": 1, "question_text": "What is the name of the farm boy who loves Buttercup in The Princess Bride?", "option_a": "Westley", "option_b": "Inigo", "option_c": "Fezzik", "option_d": "Humperdinck", "correct_answer": "a"},
    {"question_order": 2, "question_text": "What does Westley always say to Buttercup when she asks him to do things?", "option_a": "As you wish", "option_b": "Of course", "option_c": "Right away", "option_d": "At once", "correct_answer": "a"},
    {"question_order": 3, "question_text": "Who is the swordsman seeking revenge for his father's death?", "option_a": "Fezzik", "option_b": "Vizzini", "option_c": "Inigo Montoya", "option_d": "Count Rugen", "correct_answer": "c"},
    {"question_order": 4, "question_text": "How many fingers does Inigo Montoya have on his right hand?", "option_a": "Five", "option_b": "Four", "option_c": "Six", "option_d": "Three", "correct_answer": "c"},
    {"question_order": 5, "question_text": "Who is the giant with a heart of gold?", "option_a": "Fezzik", "option_b": "Westley", "option_c": "Vizzini", "option_d": "Humperdinck", "correct_answer": "a"},
    {"question_order": 6, "question_text": "What is the name of the prince who plans to marry Buttercup?", "option_a": "Prince Humperdinck", "option_b": "Prince Valiant", "option_c": "Prince Charming", "option_d": "Prince Arthur", "correct_answer": "a"},
    {"question_order": 7, "question_text": "Who killed Inigo Montoya's father?", "option_a": "Prince Humperdinck", "option_b": "Count Rugen", "option_c": "Vizzini", "option_d": "Westley", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What is the famous line Inigo says to Count Rugen?", "option_a": "My name is Inigo Montoya, you killed my father, prepare to die", "option_b": "Hello, my name is Inigo Montoya", "option_c": "I will have my revenge", "option_d": "You will pay for what you did", "correct_answer": "a"},
    {"question_order": 9, "question_text": "What is the title of the book Goldman claims to be abridging?", "option_a": "The Princess Bride by S. Morgenstern", "option_b": "A True Love Story", "option_c": "The Grand Tale of Buttercup", "option_d": "The Good Parts Version", "correct_answer": "a"},
    {"question_order": 10, "question_text": "What is the magical miracle cure that revives Westley?", "option_a": "A magic potion", "option_b": "A miracle pill", "option_c": "True love's kiss", "option_d": "A spell", "correct_answer": "b"},
]
questions_data.append({"title": "The Princess Bride", "questions": princess_bride_questions})

# ============================================================
# 16. Ender's Game by Orson Scott Card
# ============================================================
enders_game_questions = [
    {"question_order": 1, "question_text": "What is the full name of the protagonist in Ender's Game?", "option_a": "Andrew 'Ender' Wiggin", "option_b": "Peter Wiggin", "option_c": "Ender Wiggin", "option_d": "Andrew Wiggin", "correct_answer": "a"},
    {"question_order": 2, "question_text": "Where is Ender sent for military training?", "option_a": "A military academy on Earth", "option_b": "Battle School, a space station", "option_c": "A training camp in space", "option_d": "A naval academy", "correct_answer": "b"},
    {"question_order": 3, "question_text": "What alien species is humanity at war with?", "option_a": "The Formics (Buggers)", "option_b": "The Martians", "option_c": "The Xenos", "option_d": "The Dracs", "correct_answer": "a"},
    {"question_order": 4, "question_text": "Who is Ender's older brother who is jealous and cruel?", "option_a": "Peter", "option_b": "Valentine", "option_c": "Stilson", "option_d": "Bonzo", "correct_answer": "a"},
    {"question_order": 5, "question_text": "Who is Ender's loving older sister?", "option_a": "Petra", "option_b": "Valentine", "option_c": "Rosa", "option_d": "Alai", "correct_answer": "b"},
    {"question_order": 6, "question_text": "What game does Ender play that becomes a psychological test?", "option_a": "The Giant's Game", "option_b": "The Mind Game", "option_c": "The Fantasy Game", "option_d": "The Battle Game", "correct_answer": "c"},
    {"question_order": 7, "question_text": "Who is Ender's first friend at Battle School?", "option_a": "Bean", "option_b": "Alai", "option_c": "Petra", "option_d": "Dink", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What army does Ender eventually command?", "option_a": "Dragon Army", "option_b": "Rat Army", "option_c": "Salamander Army", "option_d": "Phoenix Army", "correct_answer": "a"},
    {"question_order": 9, "question_text": "What does Ender discover about the final battle simulation?", "option_a": "It was a real battle against the Formics", "option_b": "It was just a test", "option_c": "It was a dream", "option_d": "It was a trap", "correct_answer": "a"},
    {"question_order": 10, "question_text": "What does Ender do after the war ends?", "option_a": "He returns to Earth", "option_b": "He becomes a military leader", "option_c": "He travels to find a new home for the Formic queen egg", "option_d": "He retires", "correct_answer": "c"},
]
questions_data.append({"title": "Ender's Game", "questions": enders_game_questions})

# ============================================================
# 17. Ender's Shadow by Orson Scott Card
# ============================================================
enders_shadow_questions = [
    {"question_order": 1, "question_text": "What is the real name of the protagonist known as 'Bean'?", "option_a": "Julian Delphiki", "option_b": "Bean Wiggin", "option_c": "Nikolai Delphiki", "option_d": "Julian Pik", "correct_answer": "a"},
    {"question_order": 2, "question_text": "Where does Bean grow up before being recruited for Battle School?", "option_a": "In an orphanage", "option_b": "On the streets of Rotterdam", "option_c": "In a military camp", "option_d": "In a foster home", "correct_answer": "b"},
    {"question_order": 3, "question_text": "Who discovers Bean's extraordinary intelligence?", "option_a": "Colonel Graff", "option_b": "Sister Carlotta", "option_c": "Mazer Rackham", "option_d": "Petra Arkanian", "correct_answer": "b"},
    {"question_order": 4, "question_text": "What is unusual about Bean's physical characteristics?", "option_a": "He is extremely tall", "option_b": "He is extremely small for his age", "option_c": "He has unusual eyes", "option_d": "He has a scar", "correct_answer": "b"},
    {"question_order": 5, "question_text": "What is Bean's genetic secret?", "option_a": "He is a clone", "option_b": "He was genetically engineered with enhanced intelligence but will not stop growing", "option_c": "He is an alien hybrid", "option_d": "He has a terminal illness", "correct_answer": "b"},
    {"question_order": 6, "question_text": "Who is the tactical genius that Bean works alongside at Battle School?", "option_a": "Ender Wiggin", "option_b": "Petra Arkanian", "option_c": "Dink Meeker", "option_d": "Bonzo Madrid", "correct_answer": "a"},
    {"question_order": 7, "question_text": "What role does Bean play in Ender's final battle against the Formics?", "option_a": "He leads the fleet", "option_b": "He serves as Ender's tactical backup and second-in-command", "option_c": "He stays behind", "option_d": "He is the pilot", "correct_answer": "b"},
    {"question_order": 8, "question_text": "Who is the bully that Bean outwits in Rotterdam?", "option_a": "Bonzo", "option_b": "Achilles", "option_c": "Stilson", "option_d": "Bernard", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What is Sister Carlotta's role in Bean's life?", "option_a": "She is his teacher", "option_b": "She is his protector and mentor who discovers his potential", "option_c": "She is his aunt", "option_d": "She is a military officer", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What does Bean ultimately discover about his origins?", "option_a": "He was born in a lab", "option_b": "He was an illegal genetic experiment", "option_c": "He was stolen from his parents", "option_d": "He is a clone of Ender", "correct_answer": "b"},
]
questions_data.append({"title": "Ender's Shadow", "questions": enders_shadow_questions})

# ============================================================
# 18. The Hobbit by J.R.R. Tolkien
# ============================================================
hobbit_questions = [
    {"question_order": 1, "question_text": "What is the name of the hobbit protagonist in The Hobbit?", "option_a": "Frodo Baggins", "option_b": "Bilbo Baggins", "option_c": "Samwise Gamgee", "option_d": "Merry Brandybuck", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Who is the wizard who recruits Bilbo for the adventure?", "option_a": "Saruman", "option_b": "Gandalf", "option_c": "Radagast", "option_d": "Elrond", "correct_answer": "b"},
    {"question_order": 3, "question_text": "How many dwarves accompany Bilbo on his adventure?", "option_a": "Seven", "option_b": "Ten", "option_c": "Thirteen", "option_d": "Fifteen", "correct_answer": "c"},
    {"question_order": 4, "question_text": "Who is the leader of the dwarves?", "option_a": "Thorin Oakenshield", "option_b": "Balin", "option_c": "Dwalin", "option_d": "Gimli", "correct_answer": "a"},
    {"question_order": 5, "question_text": "What treasure are the dwarves trying to reclaim?", "option_a": "A magical sword", "option_b": "The Arkenstone", "option_c": "A golden crown", "option_d": "A map", "correct_answer": "b"},
    {"question_order": 6, "question_text": "What dragon guards the treasure in the Lonely Mountain?", "option_a": "Smaug", "option_b": "Glaurung", "option_c": "Ancalagon", "option_d": "Scatha", "correct_answer": "a"},
    {"question_order": 7, "question_text": "What creature does Bilbo encounter underground and play a riddle game with?", "option_a": "A troll", "option_b": "Gollum", "option_c": "A goblin", "option_d": "A spider", "correct_answer": "b"},
    {"question_order": 8, "question_text": "What does Bilbo find in Gollum's cave?", "option_a": "A sword", "option_b": "A magic ring", "option_c": "A map", "option_d": "Gold", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What does Bilbo call his sword?", "option_a": "Glamdring", "option_b": "Sting", "option_c": "Orcrist", "option_d": "Narsil", "correct_answer": "b"},
    {"question_order": 10, "question_text": "Who kills the dragon Smaug?", "option_a": "Bilbo", "option_b": "Thorin", "option_c": "Bard the Bowman", "option_d": "Gandalf", "correct_answer": "c"},
]
questions_data.append({"title": "The Hobbit", "questions": hobbit_questions})

# ============================================================
# 19. The Fellowship of the Ring by J.R.R. Tolkien
# ============================================================
fellowship_questions = [
    {"question_order": 1, "question_text": "What is the name of the hobbit who inherits the One Ring?", "option_a": "Bilbo Baggins", "option_b": "Frodo Baggins", "option_c": "Samwise Gamgee", "option_d": "Pippin Took", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Who created the One Ring?", "option_a": "Saruman", "option_b": "Gandalf", "option_c": "Sauron", "option_d": "Elrond", "correct_answer": "c"},
    {"question_order": 3, "question_text": "Where must the Ring be destroyed?", "option_a": "In Rivendell", "option_b": "In Mount Doom in Mordor", "option_c": "In the Shire", "option_d": "In Moria", "correct_answer": "b"},
    {"question_order": 4, "question_text": "How many members are in the Fellowship of the Ring?", "option_a": "Seven", "option_b": "Eight", "option_c": "Nine", "option_d": "Ten", "correct_answer": "c"},
    {"question_order": 5, "question_text": "Who is the elf member of the Fellowship?", "option_a": "Legolas", "option_b": "Arwen", "option_c": "Elrond", "option_d": "Haldir", "correct_answer": "a"},
    {"question_order": 6, "question_text": "Who is the dwarf member of the Fellowship?", "option_a": "Thorin", "option_b": "Gimli", "option_c": "Balin", "option_d": "Dwalin", "correct_answer": "b"},
    {"question_order": 7, "question_text": "Who is the human ranger also known as Strider?", "option_a": "Boromir", "option_b": "Faramir", "option_c": "Aragorn", "option_d": "Eomer", "correct_answer": "c"},
    {"question_order": 8, "question_text": "In which location does the Fellowship break apart?", "option_a": "Moria", "option_b": "Amon Hen", "option_c": "Parth Galen", "option_d": "Isengard", "correct_answer": "c"},
    {"question_order": 9, "question_text": "Who tries to take the Ring from Frodo and then dies fighting orcs?", "option_a": "Aragorn", "option_b": "Boromir", "option_c": "Legolas", "option_d": "Gimli", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What creature does Gandalf fight in Moria that causes him to fall?", "option_a": "A troll", "option_b": "A Balrog", "option_c": "A dragon", "option_d": "A Nazgul", "correct_answer": "b"},
]
questions_data.append({"title": "The Fellowship of the Ring", "questions": fellowship_questions})

# ============================================================
# 20. The Two Towers by J.R.R. Tolkien
# ============================================================
two_towers_questions = [
    {"question_order": 1, "question_text": "What is the title of the first book within The Two Towers?", "option_a": "The Treason of Isengard", "option_b": "The Departure of Boromir", "option_c": "The Riders of Rohan", "option_d": "The Ring Goes South", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Who captures Merry and Pippin?", "option_a": "Orcs of Saruman", "option_b": "Nazgul", "option_c": "Trolls", "option_d": "Spiders", "correct_answer": "a"},
    {"question_order": 3, "question_text": "Who do Aragorn, Legolas, and Gimli meet in Rohan?", "option_a": "Theoden", "option_b": "Eomer and the Riders of Rohan", "option_c": "Faramir", "option_d": "Treebeard", "correct_answer": "b"},
    {"question_order": 4, "question_text": "What is the name of the kingdom of horse-lords?", "option_a": "Gondor", "option_b": "Rohan", "option_c": "Arnor", "option_d": "Rivendell", "correct_answer": "b"},
    {"question_order": 5, "question_text": "Who is the king of Rohan who is under Saruman's influence?", "option_a": "Theoden", "option_b": "Eomer", "option_c": "Eowyn", "option_d": "Wormtongue", "correct_answer": "a"},
    {"question_order": 6, "question_text": "Who is the evil wizard who has aligned himself with Sauron?", "option_a": "Radagast", "option_b": "Saruman", "option_c": "Palantir", "option_d": "Gandalf", "correct_answer": "b"},
    {"question_order": 7, "question_text": "What are the tree-like creatures called?", "option_a": "Huorns", "option_b": "Ents", "option_c": "Treants", "option_d": "Oaks", "correct_answer": "b"},
    {"question_order": 8, "question_text": "Who is the leader of the Ents?", "option_a": "Treebeard", "option_b": "Quickbeam", "option_c": "Fangorn", "option_d": "Old Man Willow", "correct_answer": "a"},
    {"question_order": 9, "question_text": "Who guides Frodo and Sam through the Dead Marshes?", "option_a": "Aragorn", "option_b": "Gollum", "option_c": "Faramir", "option_d": "Boromir", "correct_answer": "b"},
    {"question_order": 10, "question_text": "What does Frodo offer Gollum to help them?", "option_a": "Money", "option_b": "A promise and his trust", "option_c": "Food", "option_d": "The Ring", "correct_answer": "b"},
]
questions_data.append({"title": "The Two Towers", "questions": two_towers_questions})

# ============================================================
# 21. The Return of the King by J.R.R. Tolkien
# ============================================================
return_king_questions = [
    {"question_order": 1, "question_text": "What does Denethor, steward of Gondor, do to himself?", "option_a": "He surrenders to Sauron", "option_b": "He tries to burn himself and his son Faramir alive", "option_c": "He flees the city", "option_d": "He joins the enemy", "correct_answer": "b"},
    {"question_order": 2, "question_text": "Who slays the Witch-king of Angmar (the Lord of the Nazgul)?", "option_a": "Aragorn", "option_b": "Eowyn", "option_c": "Gandalf", "option_d": "Theoden", "correct_answer": "b"},
    {"question_order": 3, "question_text": "What does Eowyn say to the Witch-king before killing him?", "option_a": "I am no man", "option_b": "You shall fall", "option_c": "My sword is ready", "option_d": "I am death", "correct_answer": "a"},
    {"question_order": 4, "question_text": "Who leads the Army of the Dead to victory?", "option_a": "Aragorn", "option_b": "Gandalf", "option_c": "Legolas", "option_d": "Eomer", "correct_answer": "a"},
    {"question_order": 5, "question_text": "What happens to Gollum at Mount Doom?", "option_a": "He repents", "option_b": "He bites off Frodo's finger and falls into the lava with the Ring", "option_c": "He is killed by Sam", "option_d": "He escapes", "correct_answer": "b"},
    {"question_order": 6, "question_text": "Who carries Frodo up Mount Doom after he collapses?", "option_a": "Gollum", "option_b": "Sam", "option_c": "Aragorn", "option_d": "Gandalf", "correct_answer": "b"},
    {"question_order": 7, "question_text": "What happens to the Eagles at the final battle?", "option_a": "They fight the Nazgul", "option_b": "They rescue Frodo and Sam from the erupting Mount Doom", "option_c": "They carry messages", "option_d": "They attack Mordor", "correct_answer": "b"},
    {"question_order": 8, "question_text": "Who becomes king of Gondor after the fall of Sauron?", "option_a": "Faramir", "option_b": "Aragorn", "option_c": "Eomer", "option_d": "Gandalf", "correct_answer": "b"},
    {"question_order": 9, "question_text": "What does Frodo struggle with after returning to the Shire?", "option_a": "He cannot find his home", "option_b": "He is wounded and scarred, both physically and emotionally", "option_c": "He has lost his memory", "option_d": "He is angry at the Shire", "correct_answer": "b"},
    {"question_order": 10, "question_text": "Where does Frodo go at the end of the novel?", "option_a": "He stays in the Shire", "option_b": "He sails to the Undying Lands with the Elves", "option_c": "He becomes mayor of the Shire", "option_d": "He travels to Rohan", "correct_answer": "b"},
]
questions_data.append({"title": "The Return of the King", "questions": return_king_questions})

# Write to file
output_path = "/home/user/workspace/bookquiz/questions_batch_4.json"
with open(output_path, "w") as f:
    json.dump(questions_data, f, indent=2)

print(f"Written {len(questions_data)} books with questions to {output_path}")

# Verify answer distribution
for book in questions_data:
    answers = [q["correct_answer"] for q in book["questions"]]
    print(f"{book['title']}: a={answers.count('a')}, b={answers.count('b')}, c={answers.count('c')}, d={answers.count('d')}")
