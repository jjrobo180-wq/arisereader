#!/usr/bin/env python3
"""Generate quiz questions for batch 3 books."""

import json

questions_data = [
  {
    "title": "Al Capone Does My Shirts",
    "questions": [
      {"question_text": "Where does Moose Flanagan live with his family?", "option_a": "In San Francisco, California", "option_b": "On Alcatraz Island", "option_c": "In Sacramento, California", "option_d": "On a farm in Oregon", "correct_answer": "b", "question_order": 1},
      {"question_text": "What is the name of Moose's older sister who has autism?", "option_a": "Natalie", "option_b": "Patty", "option_c": "Susan", "option_d": "Margaret", "correct_answer": "a", "question_order": 2},
      {"question_text": "Why does Moose's family move to Alcatraz Island?", "option_a": "His father got a job as an electrician", "option_b": "His father got a job as a prison guard", "option_c": "His mother wanted to live near the ocean", "option_d": "His parents wanted to homeschool the children", "correct_answer": "b", "question_order": 3},
      {"question_text": "What special program does Moose's family hope Natalie will be accepted into?", "option_a": "The Esther P. Marinoff School", "option_b": "The Bay Area Academy", "option_c": "The Alcatraz Learning Center", "option_d": "The San Francisco Institute", "correct_answer": "a", "question_order": 4},
      {"question_text": "Who is the warden's daughter that Moose interacts with on the island?", "option_a": "Annie", "option_b": "Janet", "option_c": "Piper", "option_d": "Theresa", "correct_answer": "c", "question_order": 5},
      {"question_text": "What scheme does Piper involve Moose in regarding the convicts?", "option_a": "Smuggling contraband into the cells", "option_b": "A laundry service where convicts wash clothes", "option_c": "A letter-writing service with the prisoners", "option_d": "Selling snacks made by the inmates", "correct_answer": "b", "question_order": 6},
      {"question_text": "What does Moose discover Natalie doing that shows her connection with a convict?", "option_a": "Sneaking food to the cells", "option_b": "Playing baseball with the prisoners", "option_c": "Having conversations with convict 105", "option_d": "Doing math homework given by an inmate", "correct_answer": "c", "question_order": 7},
      {"question_text": "What does Moose's mother do for work on the island?", "option_a": "She is the school teacher", "option_b": "She gives piano lessons", "option_c": "She works as a nurse", "option_d": "She runs the island store", "correct_answer": "b", "question_order": 8},
      {"question_text": "Who helps Moose with Natalie by suggesting they accept her as she is?", "option_a": "The warden", "option_b": "Mrs. Kelly, the therapist", "option_c": "Al Capone", "option_d": "Mr. Purdy, the school principal", "correct_answer": "c", "question_order": 9},
      {"question_text": "What does the note in Moose's laundry at the end of the book say?", "option_a": "'Your sister is welcome at the school'", "option_b": "'Tell your mother thanks'", "option_c": "'Done'", "option_d": "'Your father is a good man'", "correct_answer": "c", "question_order": 10}
    ]
  },
  {
    "title": "Al Capone Shines My Shoes",
    "questions": [
      {"question_text": "What is the first sign that Al Capone has done Moose a favor?", "option_a": "A note left in Moose's shirt pocket", "option_b": "A phone call to the warden's office", "option_c": "A gift left at the Flanagan door", "option_d": "A message delivered by a fellow inmate", "correct_answer": "a", "question_order": 1},
      {"question_text": "What does Moose need to do in return for Capone's favor?", "option_a": "Shine Capone's shoes", "option_b": "Smuggle a letter off the island", "option_c": "Find a lost object for Capone", "option_d": "Deliver a package to Capone's wife", "correct_answer": "b", "question_order": 2},
      {"question_text": "Who does Moose ask for help regarding the contraband situation?", "option_a": "His father", "option_b": "His friend Jimmy", "option_c": "Piper", "option_d": "His mother", "correct_answer": "a", "question_order": 3},
      {"question_text": "What new job does Moose's father get during the story?", "option_b": "Prison warden", "option_c": "Deputy warden", "option_d": "Electrician", "option_a": "Laundry supervisor", "correct_answer": "c", "question_order": 4},
      {"question_text": "What is the name of the boy who causes trouble on the island?", "option_a": "Darrell", "option_b": "Jimmy", "option_c": "Pete", "option_d": "Annie", "correct_answer": "a", "question_order": 5},
      {"question_text": "How does Moose's sister Natalie communicate more in this book?", "option_a": "She starts speaking in full sentences", "option_b": "She begins writing notes", "option_c": "She learns sign language", "option_d": "She uses a picture board", "correct_answer": "b", "question_order": 6},
      {"question_text": "What does Moose discover about the convict who helped Natalie?", "option_a": "He has been transferred to another prison", "option_b": "He is being released early", "option_c": "He wants to meet Natalie again", "option_d": "He has been punished for helping her", "correct_answer": "a", "question_order": 7},
      {"question_text": "What event happens at the end of the book that affects Moose's family?", "option_a": "The family decides to leave Alcatraz", "option_b": "Moose's father is promoted again", "option_c": "Natalie is accepted to a new school", "option_d": "The family moves to San Francisco", "correct_answer": "a", "question_order": 8},
      {"question_text": "What does Moose find in his laundry that confirms Capone's involvement?", "option_a": "A note reading 'Your turn'", "option_b": "A note reading 'Done'", "option_c": "A note with a drawing of shoes", "option_d": "A note reading 'Thank you'", "correct_answer": "a", "question_order": 9},
      {"question_text": "Who is the girl that Moose has a crush on throughout the story?", "option_a": "Annie", "option_b": "Piper", "option_c": "Theresa", "option_d": "Janet", "correct_answer": "a", "question_order": 10}
    ]
  },
  {
    "title": "Patina",
    "questions": [
      {"question_text": "Why does Patina (Patty) live with her aunt and uncle instead of her mother?", "option_a": "Her mother passed away", "option_b": "Her mother lost her legs to diabetes", "option_c": "Her mother moved to another state", "option_d": "Her parents divorced", "correct_answer": "b", "question_order": 1},
      {"question_text": "What event does Patina run in track?", "option_a": "The 100-meter dash", "option_b": "The 800-meter relay", "option_c": "The mile", "option_d": "The hurdles", "correct_answer": "b", "question_order": 2},
      {"question_text": "Who is Patina's younger sister that she looks after?", "option_a": "Maddy", "option_b": "Jordan", "option_c": "Emily", "option_d": "Riley", "correct_answer": "a", "question_order": 3},
      {"question_text": "What private school does Patina attend?", "option_a": "Chester Academy", "option_b": "Catholic Charities School", "option_c": "Charity School", "option_d": "St. Mary's Prep", "correct_answer": "c", "question_order": 4},
      {"question_text": "Why does Patina feel different from her schoolmates?", "option_a": "She is the only girl on the track team", "option_b": "She is one of the few Black students", "option_c": "She is older than her classmates", "option_d": "She wears a uniform from a thrift store", "correct_answer": "b", "question_order": 5},
      {"question_text": "Who is Patina's track coach?", "option_a": "Coach Whit", "option_b": "Coach Carter", "option_c": "Coach Jones", "option_d": "Coach Brown", "correct_answer": "a", "question_order": 6},
      {"question_text": "What does Patina have to do with her sister Maddy's hair?", "option_a": "She braids it every morning", "option_b": "She takes her to a salon", "option_c": "She cuts it short", "option_d": "She washes it for her", "correct_answer": "a", "question_order": 7},
      {"question_text": "What does Patina learn about accepting help from others?", "option_a": "She should never accept help", "option_b": "She should only accept help from family", "option_c": "Accepting help is a sign of weakness", "option_d": "Accepting help does not mean she is weak", "correct_answer": "d", "question_order": 8},
      {"question_text": "Who are the two girls Patina runs with in the relay?", "option_a": "Lu and Sunny", "option_b": "Jessica and Tasha", "option_c": "Emily and Courtney", "option_d": "Riley and Jordan", "correct_answer": "b", "question_order": 9},
      {"question_text": "What does Patina's aunt Emily do for a living?", "option_a": "She is a teacher", "option_b": "She is a nurse", "option_c": "She works at a bank", "option_d": "She runs a salon", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Sunny",
    "questions": [
      {"question_text": "What event does Sunny run in track?", "option_a": "The 100-meter dash", "option_b": "The mile", "option_c": "The 400-meter relay", "option_d": "The hurdles", "correct_answer": "b", "question_order": 1},
      {"question_text": "Who was Sunny's mother and what happened to her?", "option_a": "She was a nurse who died in a car accident", "option_b": "She was a teacher who moved away", "option_c": "She died giving birth to Sunny", "option_d": "She was a runner who died of illness", "correct_answer": "a", "question_order": 2},
      {"question_text": "Who raises Sunny after his mother's death?", "option_a": "His grandmother, Dizzy", "option_b": "His father alone", "option_c": "His aunt and uncle", "option_d": "His older sister", "correct_answer": "a", "question_order": 3},
      {"question_text": "What does Sunny do instead of running the mile in a meet?", "option_a": "He quits the team", "option_b": "He runs the wrong way on the track", "option_c": "He walks instead of running", "option_d": "He stops in the middle of the race", "correct_answer": "d", "question_order": 4},
      {"question_text": "What alternative does Coach suggest for Sunny?", "option_a": "He becomes the team manager", "option_b": "He tries the discus", "option_c": "He switches to sprinting", "option_d": "He becomes a shot put thrower", "correct_answer": "b", "question_order": 5},
      {"question_text": "Who is Sunny's coach?", "option_a": "Coach Whit", "option_b": "Coach Brown", "option_c": "Coach Carter", "option_d": "Coach Jones", "correct_answer": "a", "question_order": 6},
      {"question_text": "What does Sunny's grandmother Dizzy do that embarrasses him?", "option_a": "She shows up to meets in flamboyant outfits", "option_b": "She yells too loudly at his races", "option_c": "She brings strange snacks", "option_d": "She dances in the stands", "correct_answer": "a", "question_order": 7},
      {"question_text": "What is Sunny's full real name?", "option_a": "Sunny Lancaster", "option_b": "Sunny Parker", "option_c": "Sunny Johnson", "option_d": "Sunny Reynolds", "correct_answer": "a", "question_order": 8},
      {"question_text": "What does Sunny's father want him to do?", "option_a": "Quit track and focus on academics", "option_b": "Run the mile like his mother did", "option_c": "Become a basketball player", "option_d": "Join the military like his father", "correct_answer": "b", "question_order": 9},
      {"question_text": "What does Sunny realize about himself by the end of the book?", "option_a": "He wants to be a sprinter, not a distance runner", "option_b": "He wants to quit track altogether", "option_c": "He wants to run the mile to honor his mother", "option_d": "He wants to focus on his studies instead", "correct_answer": "a", "question_order": 10}
    ]
  },
  {
    "title": "Lu",
    "questions": [
      {"question_text": "What physical characteristic does Lu have from birth?", "option_a": "He is deaf in one ear", "option_b": "He was born with albinism", "option_c": "He has a club foot", "option_d": "He wears glasses", "correct_answer": "b", "question_order": 1},
      {"question_text": "What position does Lu hold on the track team?", "option_a": "Team captain", "option_b": "Assistant coach", "option_c": "Team manager", "option_d": "Lead sprinter", "correct_answer": "a", "question_order": 2},
      {"question_text": "What event does Lu typically run in track?", "option_a": "The mile", "option_b": "The hurdles", "option_c": "The 400-meter sprint", "option_d": "The 100-meter dash", "correct_answer": "c", "question_order": 3},
      {"question_text": "What major life event is Lu's mother expecting?", "option_a": "She is getting a new job", "option_b": "She is having another baby", "option_c": "She is moving to a new city", "option_d": "She is retiring", "correct_answer": "b", "question_order": 4},
      {"question_text": "How does Lu feel about the new baby?", "option_a": "He is excited to be a big brother", "option_b": "He is worried about being replaced", "option_c": "He is indifferent", "option_d": "He is angry about the change", "correct_answer": "b", "question_order": 5},
      {"question_text": "What does Lu discover about his father?", "option_a": "His father was a track star in college", "option_b": "His father used to be a gang member", "option_c": "His father had another family", "option_d": "His father is losing his hearing", "correct_answer": "b", "question_order": 6},
      {"question_text": "What happens to Lu's confidence during the season?", "option_a": "He becomes overconfident and arrogant", "option_b": "He struggles with fear of losing his identity", "option_c": "He loses interest in track", "option_d": "He decides to switch sports", "correct_answer": "b", "question_order": 7},
      {"question_text": "What does Lu do to honor his team at the championship?", "option_a": "He paints his hair team colors", "option_b": "He gives a motivational speech", "option_c": "He runs with his teammates' names on his shoes", "option_d": "He lets another runner take his place", "correct_answer": "a", "question_order": 8},
      {"question_text": "What does the new baby turn out to be?", "option_a": "A boy", "option_b": "A girl", "option_c": "Twins", "option_d": "The baby does not survive", "correct_answer": "b", "question_order": 9},
      {"question_text": "What does Lu learn by the end of the book?", "option_a": "That he should quit track", "option_b": "That being different makes him special", "option_c": "That he needs to be more like others", "option_d": "That winning is all that matters", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Look Both Ways",
    "questions": [
      {"question_text": "How many separate stories are in the book?", "option_a": "Five", "option_b": "Ten", "option_c": "Seven", "option_d": "Twelve", "correct_answer": "b", "question_order": 1},
      {"question_text": "What connects all the stories in the book?", "option_a": "They all take place at the same school", "option_b": "They are all about kids walking home from school", "option_c": "They all feature the same narrator", "option_d": "They all happen on the same street", "correct_answer": "b", "question_order": 2},
      {"question_text": "What is the name of the boy who carries a heavy backpack in one story?", "option_a": "Terry", "option_b": "Caleb", "option_c": "Simeon", "option_d": "Phillip", "correct_answer": "c", "question_order": 3},
      {"question_text": "What does the boy with the heavy backpack discover about what he's carrying?", "option_a": "It's full of books he doesn't need", "option_b": "It contains his mother's belongings", "option_c": "It's full of stolen items", "option_d": "He realizes he's been carrying emotional weight", "correct_answer": "d", "question_order": 4},
      {"question_text": "What do the kids do with the school bus in one of the stories?", "option_a": "They paint it", "option_b": "They try to push it", "option_c": "They ride it to the wrong stop", "option_d": "They hide behind it", "correct_answer": "b", "question_order": 5},
      {"question_text": "What is the theme that connects all the stories?", "option_a": "The importance of friendship", "option_b": "The journey of growing up", "option_c": "The challenges of schoolwork", "option_d": "The power of imagination", "correct_answer": "b", "question_order": 6},
      {"question_text": "Who is the boy who sells candy at school?", "option_a": "Bryson", "option_b": "Tristan", "option_c": "John John", "option_d": "Asbury", "correct_answer": "c", "question_order": 7},
      {"question_text": "What happens in the story about the girl who is afraid of dogs?", "option_a": "She gets bitten by a dog", "option_b": "She confronts her fear and befriends a dog", "option_c": "She runs away from a dog", "option_d": "She learns to fight dogs", "correct_answer": "b", "question_order": 8},
      {"question_text": "What does the story about the two friends fighting reveal?", "option_a": "That they make up quickly", "option_b": "That childhood conflicts are about deeper issues", "option_c": "That they never speak again", "option_d": "That adults intervene and solve it", "correct_answer": "b", "question_order": 9},
      {"question_text": "What literary format does the book use?", "option_a": "A single narrative novel", "option_b": "Connected short stories", "option_c": "A graphic novel", "option_d": "A verse novel", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "The Crossover",
    "questions": [
      {"question_text": "Who are the twin brothers who are the main characters?", "option_a": "Josh and Jordan Bell", "option_b": "Marcus and Malik Bell", "option_c": "Josh and Jason Bell", "option_d": "Jordan and Jerome Bell", "correct_answer": "a", "question_order": 1},
      {"question_text": "What sport do the twin brothers excel at?", "option_a": "Football", "option_b": "Soccer", "option_c": "Basketball", "option_d": "Track", "correct_answer": "c", "question_order": 2},
      {"question_text": "What nickname does Josh go by?", "option_a": "Filthy McNasty", "option_b": "Filthy", "option_c": "Crossover", "option_d": "JB", "correct_answer": "a", "question_order": 3},
      {"question_text": "What does Josh do to Jordan's hair that causes a major conflict?", "option_a": "Cuts it off while he's sleeping", "option_b": "Dyes it a different color", "option_c": "Shaves it off", "option_d": "Cuts off his lucky dreadlocks", "correct_answer": "d", "question_order": 4},
      {"question_text": "Who is the girl that Jordan becomes interested in?", "option_a": "Alexis", "option_b": "Miss Sweet Tea", "option_c": "Vanessa", "option_d": "Maya", "correct_answer": "b", "question_order": 5},
      {"question_text": "What health issue does the boys' father face?", "option_a": "He has a heart attack", "option_b": "He has a stroke", "option_c": "He is diagnosed with cancer", "option_d": "He has hypertension and a heart condition", "correct_answer": "d", "question_order": 6},
      {"question_text": "What does their father do for a living?", "option_a": "He is a teacher", "option_b": "He is a basketball coach", "option_c": "He works at a factory", "option_d": "He is a retired basketball player", "correct_answer": "b", "question_order": 7},
      {"question_text": "What literary format is the book written in?", "option_a": "Prose", "option_b": "Verse/poetry", "option_c": "Graphic novel", "option_d": "Epistolary", "correct_answer": "b", "question_order": 8},
      {"question_text": "What happens to Josh during the championship game?", "option_a": "He scores the winning basket", "option_b": "He is suspended from the team", "option_c": "He fouls out", "option_d": "He gets injured", "correct_answer": "b", "question_order": 9},
      {"question_text": "What happens to the father by the end of the book?", "option_a": "He recovers fully", "option_b": "He passes away", "option_c": "He goes to rehab", "option_d": "He moves away", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Booked",
    "questions": [
      {"question_text": "What is the name of the main character?", "option_a": "Nick Hall", "option_b": "Josh Bell", "option_c": "Marcus Hall", "option_d": "Caleb Hall", "correct_answer": "a", "question_order": 1},
      {"question_text": "What sport does Nick love?", "option_a": "Basketball", "option_b": "Soccer", "option_c": "Football", "option_d": "Baseball", "correct_answer": "b", "question_order": 2},
      {"question_text": "Who teaches Nick about the power of words and poetry?", "option_a": "His teacher, Mrs. Hardwick", "option_b": "His librarian, Mr. MacDonald", "option_c": "His father", "option_d": "His soccer coach", "correct_answer": "b", "question_order": 3},
      {"question_text": "What does Nick's father force him to read?", "option_a": "The dictionary", "option_b": "Shakespeare", "option_c": "The encyclopedia", "option_d": "The newspaper", "correct_answer": "a", "question_order": 4},
      {"question_text": "Who is the girl that Nick likes?", "option_a": "April", "option_b": "Emily", "option_c": "Coby", "option_d": "Maya", "correct_answer": "a", "question_order": 5},
      {"question_text": "What medical issue does Nick face?", "option_a": "He breaks his leg", "option_b": "He is diagnosed with asthma", "option_c": "He has appendicitis", "option_d": "He gets a concussion", "correct_answer": "c", "question_order": 6},
      {"question_text": "What is the name of Nick's best friend?", "option_a": "Coby", "option_b": "Dean", "option_c": "Will", "option_d": "Jay", "correct_answer": "a", "question_order": 7},
      {"question_text": "What does Nick's parents' relationship go through?", "option_a": "They renew their vows", "option_b": "They separate", "option_c": "They move to a new city", "option_d": "They have another child", "correct_answer": "b", "question_order": 8},
      {"question_text": "What does Nick discover about words and poetry?", "option_a": "That they are boring", "option_b": "That they can express feelings he couldn't say", "option_c": "That they are only for school", "option_d": "That they are too difficult to understand", "correct_answer": "b", "question_order": 9},
      {"question_text": "What literary format is the book written in?", "option_a": "Prose", "option_b": "Verse/poetry", "option_c": "Graphic novel", "option_d": "Diary entries", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Rebound",
    "questions": [
      {"question_text": "Who is the main character of this prequel?", "option_a": "Chuck Bell", "option_b": "Josh Bell", "option_c": "Jordan Bell", "option_d": "Marcus Bell", "correct_answer": "a", "question_order": 1},
      {"question_text": "What is Chuck Bell the father of in the Crossover series?", "option_a": "Josh and Jordan", "option_b": "Nick and Coby", "option_c": "Marcus and Malik", "option_d": "Caleb and Jason", "correct_answer": "a", "question_order": 2},
      {"question_text": "What tragedy happens to Chuck at the beginning of the book?", "option_a": "He loses his home", "option_b": "His father passes away", "option_c": "He is injured in a game", "option_d": "He fails out of school", "correct_answer": "b", "question_order": 3},
      {"question_text": "Where does Chuck's mother send him for the summer?", "option_a": "To basketball camp", "option_b": "To his grandparents' home", "option_c": "To his father's parents in the South", "option_d": "To a military school", "correct_answer": "c", "question_order": 4},
      {"question_text": "What does Chuck initially love more than basketball?", "option_a": "Music", "option_b": "Soccer", "option_c": "Comic books", "option_d": "Video games", "correct_answer": "a", "question_order": 5},
      {"question_text": "Who introduces Chuck to basketball?", "option_a": "His grandfather", "option_b": "His cousin, Scott", "option_c": "His uncle", "option_d": "A neighbor named John", "correct_answer": "b", "question_order": 6},
      {"question_text": "What does Chuck's grandfather do for him?", "option_a": "Teaches him basketball moves", "option_b": "Gives him a basketball", "option_c": "Tells him stories about his father", "option_d": "All of the above", "correct_answer": "d", "question_order": 7},
      {"question_text": "How does Chuck's attitude toward basketball change?", "option_a": "He grows to love the game", "option_b": "He decides it's not for him", "option_c": "He only plays to please his grandfather", "option_d": "He quits after one try", "correct_answer": "a", "question_order": 8},
      {"question_text": "What does Chuck learn about his father through his grandparents?", "option_a": "His father was a troublemaker", "option_b": "His father was kind and loving", "option_c": "His father was a basketball star", "option_d": "His father wanted Chuck to play music", "correct_answer": "b", "question_order": 9},
      {"question_text": "What literary format is the book written in?", "option_a": "Prose", "option_b": "Verse/poetry", "option_c": "Graphic novel", "option_d": "Diary entries", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Out of My Heart",
    "questions": [
      {"question_text": "Who is the main character of this book?", "option_a": "Melody Brooks", "option_b": "Stella", "option_c": "Patty", "option_d": "Keisha", "correct_answer": "a", "question_order": 1},
      {"question_text": "What condition does Melody have?", "option_a": "Autism", "option_b": "Cerebral palsy", "option_c": "Down syndrome", "option_d": "Blindness", "correct_answer": "b", "question_order": 2},
      {"question_text": "Where does Melody go in this book?", "option_a": "To a new school", "option_b": "To summer camp", "option_c": "To a hospital", "option_d": "To live with relatives", "correct_answer": "b", "question_order": 3},
      {"question_text": "What is the name of the camp Melody attends?", "option_a": "Camp Green Lake", "option_b": "Camp Greenleaf", "option_c": "Camp Hopeful", "option_d": "Camp Sunshine", "correct_answer": "b", "question_order": 4},
      {"question_text": "What does Melody want to do at camp?", "option_a": "Learn to swim", "option_b": "Make new friends", "option_c": "Participate in activities like other kids", "option_d": "All of the above", "correct_answer": "d", "question_order": 5},
      {"question_text": "Who helps Melody at the camp?", "option_a": "A counselor named Trinity", "option_b": "Her mother", "option_c": "Her teacher", "option_d": "A camp director", "correct_answer": "a", "question_order": 6},
      {"question_text": "What does Melody discover about herself at camp?", "option_a": "That she can't do anything", "option_b": "That she is more capable than she thought", "option_c": "That she wants to go home", "option_d": "That she doesn't like camp", "correct_answer": "b", "question_order": 7},
      {"question_text": "What new experience does Melody have at camp?", "option_a": "She goes horseback riding", "option_b": "She swims in a pool", "option_c": "She climbs a rock wall", "option_d": "She rides a zip line", "correct_answer": "a", "question_order": 8},
      {"question_text": "What does Melody use to communicate?", "option_a": "Sign language", "option_b": "A speech-generating device", "option_c": "Picture cards", "option_d": "Written notes", "correct_answer": "b", "question_order": 9},
      {"question_text": "What is the main theme of the book?", "option_a": "Overcoming fear of the unknown", "option_b": "Finding independence and friendship", "option_c": "Learning to walk again", "option_d": "Going back to school", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Blended",
    "questions": [
      {"question_text": "What is the name of the main character?", "option_a": "Isabella", "option_b": "Melody", "option_c": "Stella", "option_d": "Patina", "correct_answer": "a", "question_order": 1},
      {"question_text": "What is unique about Isabella's racial identity?", "option_a": "She is adopted", "option_b": "She is biracial", "option_c": "She is multiracial", "option_d": "She is from another country", "correct_answer": "b", "question_order": 2},
      {"question_text": "What situation does Isabella navigate between her parents?", "option_a": "Living with one parent and visiting the other", "option_b": "Switching between her divorced parents' homes", "option_c": "Having parents in different countries", "option_d": "Having parents who don't speak to each other", "correct_answer": "b", "question_order": 3},
      {"question_text": "Who is Isabella's stepfather?", "option_a": "Frank", "option_b": "Dave", "option_c": "Mark", "option_d": "John", "correct_answer": "a", "question_order": 4},
      {"question_text": "What instrument does Isabella play?", "option_a": "The violin", "option_b": "The piano", "option_c": "The guitar", "option_d": "The flute", "correct_answer": "b", "question_order": 5},
      {"question_text": "What does Isabella struggle with regarding her identity?", "option_a": "She wants to change her name", "option_b": "She feels she doesn't fit in with either race", "option_c": "She wants to live with only one parent", "option_d": "She wishes she had a different appearance", "correct_answer": "b", "question_order": 6},
      {"question_text": "What happens at school that makes Isabella uncomfortable?", "option_a": "A friend makes a racially insensitive comment", "option_b": "She is bullied for her clothes", "option_c": "She fails a test", "option_d": "She is excluded from a group", "correct_answer": "a", "question_order": 7},
      {"question_text": "What does Isabella's father give her that is special?", "option_a": "A new phone", "option_b": "A set of keys", "option_c": "A musical instrument", "option_d": "A piece of jewelry", "correct_answer": "b", "question_order": 8},
      {"question_text": "What happens to Isabella's home during the story?", "option_a": "It is damaged in a storm", "option_b": "It is burglarized", "option_c": "It catches on fire", "option_d": "They have to move out", "correct_answer": "c", "question_order": 9},
      {"question_text": "What does Isabella learn by the end of the book?", "option_a": "That she must choose one racial identity", "option_b": "That she can embrace all parts of who she is", "option_c": "That she should live with her mother only", "option_d": "That she needs to change schools", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Stella by Starlight",
    "questions": [
      {"question_text": "What is the name of the main character?", "option_a": "Stella Mills", "option_b": "Stella Carter", "option_c": "Stella Brooks", "option_d": "Stella Johnson", "correct_answer": "a", "question_order": 1},
      {"question_text": "What time period does the story take place in?", "option_a": "During the Civil War", "option_b": "During the Great Depression", "option_c": "In 1932 North Carolina", "option_d": "In the 1950s", "correct_answer": "c", "question_order": 2},
      {"question_text": "What does Stella see one night that terrifies her?", "option_a": "A burning cross and Ku Klux Klan gathering", "option_b": "A house fire", "option_c": "A robbery", "option_d": "A fight between neighbors", "correct_answer": "a", "question_order": 3},
      {"question_text": "Who is Stella's younger brother?", "option_a": "Jojo", "option_b": "Tony", "option_c": "Marcus", "option_d": "Caleb", "correct_answer": "a", "question_order": 4},
      {"question_text": "What does Stella love to do but struggles with?", "option_a": "Reading", "option_b": "Writing", "option_c": "Math", "option_d": "Drawing", "correct_answer": "b", "question_order": 5},
      {"question_text": "Who is the teacher at Stella's school?", "option_a": "Mrs. Grayson", "option_b": "Mrs. Carter", "option_c": "Mrs. Johnson", "option_d": "Mrs. Williams", "correct_answer": "a", "question_order": 6},
      {"question_text": "What does Stella's father want to do that takes courage?", "option_a": "Move the family north", "option_b": "Register to vote", "option_c": "Confront the Klan", "option_d": "File a complaint with the police", "correct_answer": "b", "question_order": 7},
      {"question_text": "What happens at the school that affects the community?", "option_a": "The school is burned down", "option_b": "The school is flooded", "option_c": "The school loses its teacher", "option_d": "The school is closed", "correct_answer": "a", "question_order": 8},
      {"question_text": "Who helps rebuild the community school?", "option_a": "The white community", "option_b": "The Black community", "option_c": "The church", "option_d": "The government", "correct_answer": "b", "question_order": 9},
      {"question_text": "What does Stella discover about her own voice?", "option_a": "That she is a great singer", "option_b": "That she can express herself through writing", "option_c": "That she should speak up more", "option_d": "That she is a leader", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Copper Sun",
    "questions": [
      {"question_text": "What is the name of the main character?", "option_a": "Amari", "option_b": "Polly", "option_c": "Stella", "option_d": "Afi", "correct_answer": "a", "question_order": 1},
      {"question_text": "Where is Amari from originally?", "option_a": "Nigeria", "option_b": "Ghana", "option_c": "The Ashanti region of Africa", "option_d": "Kenya", "correct_answer": "c", "question_order": 2},
      {"question_text": "How old is Amari when she is captured?", "option_a": "12 years old", "option_b": "15 years old", "option_c": "18 years old", "option_d": "10 years old", "correct_answer": "b", "question_order": 3},
      {"question_text": "What happens to Amari's family?", "option_a": "They are separated and sold", "option_b": "They escape together", "option_c": "They are killed in a raid", "option_d": "They are reunited later", "correct_answer": "c", "question_order": 4},
      {"question_text": "Who is the white indentured servant that Amari befriends?", "option_a": "Polly", "option_b": "Mary", "option_c": "Sarah", "option_d": "Emily", "correct_answer": "a", "question_order": 5},
      {"question_text": "Where are Amari and Polly sent to work?", "option_a": "A plantation in South Carolina", "option_b": "A plantation in Georgia", "option_c": "A plantation in Virginia", "option_d": "A plantation in New York", "correct_answer": "a", "question_order": 6},
      {"question_text": "Who is the plantation owner's son that Amari is given to?", "option_a": "Clay", "option_b": "Jack", "option_c": "Edward", "option_d": "Robert", "correct_answer": "c", "question_order": 7},
      {"question_text": "What do Amari and Polly plan to do?", "option_a": "Start a rebellion", "option_b": "Escape to Florida", "option_c": "Escape to a Spanish colony", "option_d": "Escape to the North", "correct_answer": "c", "question_order": 8},
      {"question_text": "Who helps Amari and Polly escape?", "option_a": "A doctor named Dr. Hoskins", "option_b": "A fellow slave", "option_c": "A sailor", "option_d": "A priest", "correct_answer": "a", "question_order": 9},
      {"question_text": "What does Amari discover at the end of her journey?", "option_a": "That she is pregnant", "option_b": "That her family is alive", "option_c": "That she is free", "option_d": "That she can return home", "correct_answer": "a", "question_order": 10}
    ]
  },
  {
    "title": "Tears of a Tiger",
    "questions": [
      {"question_text": "What is the name of the main character?", "option_a": "Andy Jackson", "option_b": "Marcus Jackson", "option_c": "Robert Washington", "option_d": "Gerald Nickelby", "correct_answer": "a", "question_order": 1},
      {"question_text": "What tragedy occurs at the beginning of the book?", "option_a": "A car accident after a basketball game", "option_b": "A shooting at school", "option_c": "A house fire", "option_d": "A sports injury", "correct_answer": "a", "question_order": 2},
      {"question_text": "Who dies in the car accident?", "option_a": "Andy's best friend, Robert Washington", "option_b": "Andy's brother", "option_c": "Andy's teammate", "option_d": "Andy's girlfriend", "correct_answer": "a", "question_order": 3},
      {"question_text": "What caused the car accident?", "option_a": "Andy was driving drunk", "option_b": "The car had faulty brakes", "option_c": "Another driver hit them", "option_d": "Andy fell asleep at the wheel", "correct_answer": "a", "question_order": 4},
      {"question_text": "How does Andy cope with his guilt?", "option_a": "He starts drinking heavily", "option_b": "He talks to a psychologist", "option_c": "He joins a support group", "option_d": "He writes in a journal", "correct_answer": "b", "question_order": 5},
      {"question_text": "What sport does Andy play?", "option_a": "Football", "option_b": "Basketball", "option_c": "Soccer", "option_d": "Baseball", "correct_answer": "b", "question_order": 6},
      {"question_text": "Who is Andy's girlfriend?", "option_a": "Keisha Montgomery", "option_b": "Rhonda", "option_c": "Tyrone", "option_d": "B.J.", "correct_answer": "a", "question_order": 7},
      {"question_text": "What literary format does the book use?", "option_a": "Traditional prose narrative", "option_b": "Letters, journal entries, and conversations", "option_c": "Verse poetry", "option_d": "Newspaper articles only", "correct_answer": "b", "question_order": 8},
      {"question_text": "How does Andy's depression affect his relationships?", "option_a": "He becomes closer to his friends", "option_b": "He pushes people away", "option_c": "He becomes more popular", "option_d": "He doesn't change", "correct_answer": "b", "question_order": 9},
      {"question_text": "What happens to Andy at the end of the book?", "option_a": "He recovers and moves on", "option_b": "He takes his own life", "option_c": "He goes to rehab", "option_d": "He moves to a new city", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Forged by Fire",
    "questions": [
      {"question_text": "Who is the main character of the book?", "option_a": "Gerald Nickelby", "option_b": "Andy Jackson", "option_c": "Marcus Washington", "option_d": "Robert Nickelby", "correct_answer": "a", "question_order": 1},
      {"question_text": "What happened to Gerald when he was a young child?", "option_a": "He was abandoned by his mother", "option_b": "He was abused by his mother's boyfriend", "option_c": "He was in a house fire", "option_d": "All of the above", "correct_answer": "d", "question_order": 2},
      {"question_text": "Who takes Gerald in after his mother's abuse is discovered?", "option_a": "His aunt Queen", "option_b": "His grandmother", "option_c": "His father", "option_d": "The state", "correct_answer": "a", "question_order": 3},
      {"question_text": "What happens to Gerald's mother?", "option_a": "She goes to prison", "option_b": "She gets help and returns for Gerald", "option_c": "She disappears", "option_d": "She dies", "correct_answer": "b", "question_order": 4},
      {"question_text": "Who is Gerald's half-sister that he protects?", "option_a": "Angel", "option_b": "Keisha", "option_c": "Rhonda", "option_d": "Monique", "correct_answer": "a", "question_order": 5},
      {"question_text": "Who is the abusive stepfather in Gerald's life?", "option_a": "Jordan", "option_b": "Monroe", "option_c": "Andre", "option_d": "Terrell", "correct_answer": "b", "question_order": 6},
      {"question_text": "What does Gerald do to try to help Angel?", "option_a": "He reports the abuse to authorities", "option_b": "He physically confronts his stepfather", "option_c": "He runs away with her", "option_d": "He tells his mother", "correct_answer": "b", "question_order": 7},
      {"question_text": "What sport does Gerald play?", "option_a": "Basketball", "option_b": "Football", "option_c": "Track", "option_d": "Soccer", "correct_answer": "a", "question_order": 8},
      {"question_text": "What does Gerald's mother struggle with?", "option_a": "Drug addiction", "option_b": "Alcoholism", "option_c": "Gambling", "option_d": "Depression", "correct_answer": "a", "question_order": 9},
      {"question_text": "What is the main theme of the book?", "option_a": "The importance of sports", "option_b": "Overcoming abuse and protecting family", "option_c": "The dangers of drugs", "option_d": "Growing up in poverty", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Darkness Before Dawn",
    "questions": [
      {"question_text": "Who is the main character of the book?", "option_a": "Keisha Montgomery", "option_b": "Rhonda", "option_c": "Andy Jackson", "option_d": "Gerald Nickelby", "correct_answer": "a", "question_order": 1},
      {"question_text": "This book is the third in a trilogy that includes which other books?", "option_a": "Tears of a Tiger and Forged by Fire", "option_b": "Tears of a Tiger and Romiette and Julio", "option_c": "Forged by Fire and Copper Sun", "option_d": "Tears of a Tiger and Blended", "correct_answer": "a", "question_order": 2},
      {"question_text": "What grade is Keisha in during this book?", "option_a": "Junior year", "option_b": "Senior year", "option_c": "Sophomore year", "option_d": "Freshman year", "correct_answer": "b", "question_order": 3},
      {"question_text": "Who is the new student that Keisha is attracted to?", "option_a": "Jonathan Hathaway", "option_b": "Marcus Washington", "option_c": "Robert Nickelby", "option_d": "Andre Jackson", "correct_answer": "a", "question_order": 4},
      {"question_text": "What is Jonathan's father's job?", "option_a": "He is a teacher at Keisha's school", "option_b": "He is the principal", "option_c": "He is a pastor", "option_d": "He is a coach", "correct_answer": "a", "question_order": 5},
      {"question_text": "What does Keisha discover about Jonathan?", "option_a": "He is married", "option_b": "He is much older than he claims", "option_c": "He has a criminal record", "option_d": "He is actually a student at another school", "correct_answer": "b", "question_order": 6},
      {"question_text": "What happens between Keisha and Jonathan?", "option_a": "They date happily", "option_b": "Jonathan attacks Keisha", "option_c": "They break up amicably", "option_d": "Jonathan moves away", "correct_answer": "b", "question_order": 7},
      {"question_text": "Who helps Keisha deal with the aftermath?", "option_a": "Her friend Rhonda", "option_b": "Gerald", "option_c": "Her parents", "option_d": "All of the above", "correct_answer": "d", "question_order": 8},
      {"question_text": "What does Keisha do after the traumatic event?", "option_a": "She drops out of school", "option_b": "She finds strength to move forward", "option_c": "She moves to a new city", "option_d": "She becomes withdrawn permanently", "correct_answer": "b", "question_order": 9},
      {"question_text": "What does the title 'Darkness Before Dawn' symbolize?", "option_a": "The fear of the unknown", "option_b": "The worst moments come before healing and hope", "option_c": "The time of day the events occur", "option_d": "The name of a club", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Romiette and Julio",
    "questions": [
      {"question_text": "What classic story is this book a retelling of?", "option_a": "Romeo and Juliet", "option_b": "West Side Story", "option_c": "Othello", "option_d": "Antony and Cleopatra", "correct_answer": "a", "question_order": 1},
      {"question_text": "Who is the female main character?", "option_a": "Romiette Cappelle", "option_b": "Juliette Cappelle", "option_c": "Romea Cappelle", "option_d": "Romina Cappelle", "correct_answer": "a", "question_order": 2},
      {"question_text": "Where has Julio recently moved from?", "option_a": "Mexico", "option_b": "Cincinnati, Ohio", "option_c": "Texas", "option_d": "Puerto Rico", "correct_answer": "b", "question_order": 3},
      {"question_text": "How do Romiette and Julio first connect?", "option_a": "In a school class", "option_b": "In an online chat room", "option_c": "At a party", "option_d": "Through mutual friends", "correct_answer": "b", "question_order": 4},
      {"question_text": "What threatens Romiette and Julio's relationship?", "option_a": "Their parents disapprove", "option_b": "A local gang called the Devildogs", "option_c": "They go to different schools", "option_d": "Julio has to move again", "correct_answer": "b", "question_order": 5},
      {"question_text": "What is Romiette's ethnicity?", "option_a": "Latina", "option_b": "African American", "option_c": "White", "option_d": "Biracial", "correct_answer": "b", "question_order": 6},
      {"question_text": "What is Julio's ethnicity?", "option_a": "Latino", "option_b": "African American", "option_c": "White", "option_d": "Asian American", "correct_answer": "a", "question_order": 7},
      {"question_text": "What do Romiette and Julio plan to do to deal with the gang?", "option_a": "Fight them", "option_b": "Report them to police", "option_c": "Meet them to talk it out", "option_d": "Run away together", "correct_answer": "c", "question_order": 8},
      {"question_text": "What happens when Romiette and Julio meet the gang members?", "option_a": "They have a peaceful conversation", "option_b": "They are attacked and Romiette is thrown into water", "option_c": "They escape unharmed", "option_d": "The police arrive first", "correct_answer": "b", "question_order": 9},
      {"question_text": "How does the story end?", "option_a": "Both characters die", "option_b": "They are saved and their families come together", "option_c": "They break up", "option_d": "They run away together", "correct_answer": "b", "question_order": 10}
    ]
  },
  {
    "title": "Fever 1793",
    "questions": [
      {"question_text": "What is the name of the main character?", "option_a": "Matilda (Mattie) Cook", "option_b": "Eliza Cook", "option_c": "Lucille Cook", "option_d": "Polly Cook", "correct_answer": "a", "question_order": 1},
      {"question_text": "In what city does the story take place?", "option_a": "New York", "option_b": "Boston", "option_c": "Philadelphia", "option_d": "Baltimore", "correct_answer": "c", "question_order": 2},
      {"question_text": "What disease sweeps through the city?", "option_a": "Smallpox", "option_b": "Yellow fever", "option_c": "Cholera", "option_d": "Influenza", "correct_answer": "b", "question_order": 3},
      {"question_text": "In what year does the epidemic occur?", "option_a": "1776", "option_b": "1793", "option_c": "1801", "option_d": "1812", "correct_answer": "b", "question_order": 4},
      {"question_text": "Who runs the coffeehouse where Mattie lives?", "option_a": "Mattie and her mother", "option_b": "Mattie's mother and grandfather", "option_c": "Mattie's father", "option_d": "Mattie alone", "correct_answer": "b", "question_order": 5},
      {"question_text": "Who is the free Black woman who works at the coffeehouse?", "option_a": "Eliza", "option_b": "Polly", "option_c": "Lucille", "option_d": "Nell", "correct_answer": "a", "question_order": 6},
      {"question_text": "What happens to Mattie's mother?", "option_a": "She dies of yellow fever", "option_b": "She gets yellow fever but survives", "option_c": "She leaves the city", "option_d": "She is kidnapped", "correct_answer": "b", "question_order": 7},
      {"question_text": "What does Mattie's grandfather do for her when they are stranded?", "option_a": "He teaches her to survive", "option_b": "He finds food and water", "option_c": "He defends her from attackers", "option_d": "All of the above", "correct_answer": "d", "question_order": 8},
      {"question_text": "Who does Mattie find and care for after her grandfather's death?", "option_a": "A young girl named Nell", "option_b": "A baby named Eliza", "option_c": "An orphan named Polly", "option_d": "A boy named Joseph", "correct_answer": "a", "question_order": 9},
      {"question_text": "What does Mattie do by the end of the book?", "option_a": "She reopens the coffeehouse", "option_b": "She leaves Philadelphia", "option_c": "She becomes a nurse", "option_d": "She moves to the country", "correct_answer": "a", "question_order": 10}
    ]
  },
  {
    "title": "Chains",
    "questions": [
      {"question_text": "What is the name of the main character?", "option_a": "Isabel", "option_b": "Ruth", "option_c": "Curzon", "option_d": "Madam Lockton", "correct_answer": "a", "question_order": 1},
      {"question_text": "During what war does the story take place?", "option_a": "The Civil War", "option_b": "The Revolutionary War", "option_c": "The War of 1812", "option_d": "The French and Indian War", "correct_answer": "b", "question_order": 2},
      {"question_text": "In what city does most of the story take place?", "option_a": "Boston", "option_b": "Philadelphia", "option_c": "New York", "option_d": "Charleston", "correct_answer": "c", "question_order": 3},
      {"question_text": "Who is Isabel's younger sister?", "option_a": "Ruth", "option_b": "Curzon", "option_c": "Sarah", "option_d": "Becky", "correct_answer": "a", "question_order": 4},
      {"question_text": "What happens to Isabel and Ruth after their owner dies?", "option_a": "They are freed", "option_b": "They are sold to the Locktons", "option_c": "They escape", "option_d": "They are sent to an orphanage", "correct_answer": "b", "question_order": 5},
      {"question_text": "What is the name of the cruel woman who owns Isabel?", "option_a": "Madam Lockton", "option_b": "Mrs. Seymour", "option_c": "Lady Ashbury", "option_d": "Mrs. Finch", "correct_answer": "a", "question_order": 6},
      {"question_text": "What happens to Ruth during the story?", "option_a": "She runs away", "option_b": "She is sold away from Isabel", "option_c": "She gets sick", "option_d": "She is sent to school", "correct_answer": "b", "question_order": 7},
      {"question_text": "Who is the enslaved boy who befriends Isabel?", "option_a": "Curzon", "option_b": "Becky", "option_c": "Samuel", "option_d": "Morgan", "correct_answer": "a", "question_order": 8},
      {"question_text": "What does Isabel do to try to gain her freedom?", "option_a": "She runs away", "option_b": "She spies for the Patriots", "option_c": "She tries to earn money to buy freedom", "option_d": "She asks Madam Lockton", "correct_answer": "b", "question_order": 9},
      {"question_text": "What happens to Isabel at the end of the book?", "option_a": "She is freed", "option_b": "She escapes with Curzon", "option_c": "She is branded on the cheek", "option_d": "She is sold again", "correct_answer": "c", "question_order": 10}
    ]
  },
  {
    "title": "Forge",
    "questions": [
      {"question_text": "Who is the main character of this book?", "option_a": "Curzon", "option_b": "Isabel", "option_c": "Ruth", "option_d": "Bellingham", "correct_answer": "a", "question_order": 1},
      {"question_text": "This book is the sequel to which novel?", "option_a": "Chains", "option_b": "Fever 1793", "option_c": "Ashes", "option_d": "Copper Sun", "correct_answer": "a", "question_order": 2},
      {"question_text": "What does Curzon do to survive after escaping?", "option_a": "He joins the Patriot army", "option_b": "He works as a blacksmith", "option_c": "He becomes a sailor", "option_d": "He hides on a farm", "correct_answer": "a", "question_order": 3},
      {"question_text": "Where does Curzon enlist in the army?", "option_a": "Valley Forge", "option_b": "Saratoga", "option_c": "Yorktown", "option_d": "New York", "correct_answer": "a", "question_order": 4},
      {"question_text": "What does Curzon discover about his master, Bellingham?", "option_a": "He has died", "option_b": "He has joined the British army", "option_c": "He reclaims Curzon as his slave", "option_d": "He has freed Curzon", "correct_answer": "c", "question_order": 5},
      {"question_text": "Who is the woman Curzon reconnects with at the encampment?", "option_a": "Isabel", "option_b": "Ruth", "option_c": "Sarah", "option_d": "Becky", "correct_answer": "a", "question_order": 6},
      {"question_text": "What does Isabel do at the encampment?", "option_a": "She works as a laundress", "option_b": "She cooks for soldiers", "option_c": "She works as a seamstress", "option_d": "She tends to the wounded", "correct_answer": "c", "question_order": 7},
      {"question_text": "What does Curzon fight for despite being enslaved?", "option_a": "His freedom", "option_b": "The Patriot cause", "option_c": "Money", "option_d": "Both his freedom and the Patriot cause", "correct_answer": "d", "question_order": 8},
      {"question_text": "What harsh conditions do the soldiers face at Valley Forge?", "option_a": "Starvation and freezing cold", "option_b": "Disease outbreaks", "option_c": "Lack of supplies", "option_d": "All of the above", "correct_answer": "d", "question_order": 9},
      {"question_text": "What do Curzon and Isabel decide to do at the end of the book?", "option_a": "They escape together", "option_b": "They join the British", "option_c": "They give up", "option_d": "They stay at Valley Forge", "correct_answer": "a", "question_order": 10}
    ]
  },
  {
    "title": "Ashes",
    "questions": [
      {"question_text": "Who are the two main characters of this book?", "option_a": "Isabel and Curzon", "option_b": "Isabel and Ruth", "option_c": "Curzon and Bellingham", "option_d": "Isabel and Sarah", "correct_answer": "a", "question_order": 1},
      {"question_text": "This book is the conclusion of which trilogy?", "option_a": "Seeds of America", "option_b": "Crossover", "option_c": "Hazelwood High", "option_d": "Track series", "correct_answer": "a", "question_order": 2},
      {"question_text": "What year does the story take place?", "option_a": "1776", "option_b": "1781", "option_c": "1783", "option_d": "1793", "correct_answer": "b", "question_order": 3},
      {"question_text": "What does Isabel want most in this book?", "option_a": "To find her sister Ruth", "option_b": "To return to Africa", "option_c": "To join the British", "option_d": "To become a soldier", "correct_answer": "a", "question_order": 4},
      {"question_text": "Where does Isabel go to find Ruth?", "option_a": "To New York", "option_b": "To Charleston", "option_c": "To Virginia", "option_d": "To Philadelphia", "correct_answer": "b", "question_order": 5},
      {"question_text": "What major historical event occurs during the story?", "option_a": "The signing of the Declaration of Independence", "option_b": "The British surrender at Yorktown", "option_c": "The Boston Tea Party", "option_d": "The writing of the Constitution", "correct_answer": "b", "question_order": 6},
      {"question_text": "Who is the master who claims Curzon?", "option_a": "Bellingham", "option_b": "Lockton", "option_c": "Washington", "option_d": "Rochambeau", "correct_answer": "a", "question_order": 7},
      {"question_text": "What does Isabel find when she locates Ruth?", "option_a": "Ruth has died", "option_b": "Ruth does not recognize her", "option_c": "Ruth has been freed", "option_d": "Ruth has been adopted", "correct_answer": "b", "question_order": 8},
      {"question_text": "What does Curzon risk his life for?", "option_a": "His own freedom", "option_b": "Isabel's happiness", "option_c": "The Patriot cause", "option_d": "All of the above", "correct_answer": "d", "question_order": 9},
      {"question_text": "How does the trilogy end?", "option_a": "Isabel and Curzon gain their freedom", "option_b": "Isabel is reunited with Ruth permanently", "option_c": "They escape to Canada", "option_d": "Both A and B", "correct_answer": "d", "question_order": 10}
    ]
  }
]

# Verify we have exactly 21 books
assert len(questions_data) == 21, f"Expected 21 books, got {len(questions_data)}"

# Verify each book has exactly 10 questions
for book in questions_data:
    assert len(book["questions"]) == 10, f"Book '{book['title']}' has {len(book['questions'])} questions, expected 10"
    for i, q in enumerate(book["questions"]):
        assert q["question_order"] == i + 1, f"Question order mismatch in '{book['title']}'"
        assert q["correct_answer"] in ["a", "b", "c", "d"], f"Invalid correct_answer in '{book['title']}'"

# Check answer distribution across all questions
answer_dist = {"a": 0, "b": 0, "c": 0, "d": 0}
for book in questions_data:
    for q in book["questions"]:
        answer_dist[q["correct_answer"]] += 1

print(f"Total questions: {sum(answer_dist.values())}")
print(f"Answer distribution: {answer_dist}")

# Write to file
with open("/home/user/workspace/bookquiz/questions_batch_3.json", "w") as f:
    json.dump(questions_data, f, indent=2)

print(f"\nSuccessfully wrote {len(questions_data)} books with 10 questions each to questions_batch_3.json")
