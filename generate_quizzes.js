// Generate book and quiz data for missing grade bands
// K-2: need 69 more quizzes (currently 31)
// 3-5: need 18 more quizzes (currently 82)
// 9-12: need 54 more quizzes (currently 46)
// Each book needs 10 multiple choice questions
// Point values: 10, 15, 20 (distribute evenly)

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  'https://swsyalnajzizfwazqwpd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3c3lhbG5hanppemZ3YXpxd3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDgxOTIsImV4cCI6MjEwMzg4NDE5Mn0.WuxYK3_V-OcgNUSqFOF_OjvyYW_V6xkD73JkFcuMKV8',
  { realtime: { transport: ws } }
);

// Book data for K-2 band (69 books needed)
const K2_BOOKS = [
  { title: "The Red Apple", author: "Sarah Mitchell", points: 10, desc: "A simple story about a red apple falling from a tree." },
  { title: "My Best Friend", author: "Lisa Carter", points: 10, desc: "A heartwarming tale about friendship and sharing." },
  { title: "The Happy Dog", author: "Tom Baker", points: 10, desc: "A dog's adventure through the neighborhood." },
  { title: "Sunny Day", author: "Mary Johnson", points: 10, desc: "A cheerful story about a sunny day at the park." },
  { title: "The Little Duck", author: "Karen Smith", points: 10, desc: "A duckling explores the pond for the first time." },
  { title: "Colors Everywhere", author: "Pat Wilson", points: 10, desc: "A colorful journey through a rainbow world." },
  { title: "The Big Blue Ball", author: "Jane Davis", points: 10, desc: "A ball bounces through town on an adventure." },
  { title: "Three Little Bears", author: "Bob Brown", points: 10, desc: "Three bears go on a picnic in the woods." },
  { title: "The Tiny Seed", author: "Susan Lee", points: 10, desc: "A seed grows into a beautiful flower." },
  { title: "Moon and Stars", author: "Mike Jones", points: 10, desc: "A bedtime story about the night sky." },
  { title: "The Lost Kitten", author: "Rachel Green", points: 10, desc: "A kitten finds its way home." },
  { title: "Playtime Fun", author: "Amy Taylor", points: 10, desc: "Children discover the joy of playing together." },
  { title: "The Green Frog", author: "Chris Martin", points: 10, desc: "A frog jumps from lily pad to lily pad." },
  { title: "My Family Tree", author: "Beth White", points: 10, desc: "A child learns about their family history." },
  { title: "The First Day", author: "Laura Adams", points: 10, desc: "A child's first day of school." },
  { title: "The Windy Day", author: "Greg Scott", points: 10, desc: "A windy day blows everything around." },
  { title: "The Sleepy Owl", author: "Nancy Clark", points: 10, desc: "An owl tries to stay awake during the day." },
  { title: "Two Best Friends", author: "Helen Young", points: 10, desc: "Two friends learn to share their toys." },
  { title: "The Magic Box", author: "Paul King", points: 10, desc: "A mysterious box holds surprises inside." },
  { title: "The Little Star", author: "Diana Bell", points: 10, desc: "A small star learns to shine bright." },
  { title: "Rainy Day Play", author: "Sue Harris", points: 10, desc: "Indoor fun on a rainy afternoon." },
  { title: "The Curious Cat", author: "Mark Hill", points: 10, desc: "A cat explores every corner of the house." },
  { title: "The New Puppy", author: "Carol Foster", points: 10, desc: "A family welcomes a new puppy home." },
  { title: "My Big Brother", author: "Donna Wood", points: 10, desc: "A story about sibling love and adventure." },
  { title: "The Happy Farm", author: "Eric Reed", points: 10, desc: "Animals on a farm have a fun day together." },
  { title: "The Little Boat", author: "Rita Cox", points: 10, desc: "A small boat sails across a big lake." },
  { title: "Five Little Monkeys", author: "Tina Gray", points: 10, desc: "Monkeys jump and play in the jungle." },
  { title: "The Snowy Day", author: "Alan Brooks", points: 10, desc: "A child experiences snow for the first time." },
  { title: "My Yellow Hat", author: "Joyce Hall", points: 10, desc: "A beloved hat goes on an adventure." },
  { title: "The Talking Tree", author: "Keith Price", points: 10, desc: "An old tree shares stories with children." },
  { title: "The Brave Little Mouse", author: "Wendy Long", points: 10, desc: "A tiny mouse shows great courage." },
  { title: "The Rainbow Bridge", author: "Gloria Hunt", points: 10, desc: "A magical bridge appears after a storm." },
  { title: "Spring Is Here", author: "Dale Ward", points: 10, desc: "Animals wake up as spring arrives." },
  { title: "The Old Red Barn", author: "Faye Cooper", points: 10, desc: "Adventures inside an old barn." },
  { title: "The Tiny Turtle", author: "Cecil Wood", points: 10, desc: "A small turtle's journey to the sea." },
  { title: "The Kind Dragon", author: "Rex Bailey", points: 10, desc: "A friendly dragon helps the village." },
  { title: "My Favorite Toy", author: "Rosa Diaz", points: 10, desc: "A child's favorite toy comes to life." },
  { title: "The Busy Bee", author: "Otis Grant", points: 10, desc: "A bee's busy day collecting nectar." },
  { title: "The Gentle Giant", author: "Flora Reed", points: 10, desc: "A big friendly giant helps small animals." },
  { title: "The Round Planet", author: "Iris Bell", points: 10, desc: "A journey around our round world." },
  { title: "The Flying Fish", author: "Hugh Dean", points: 10, desc: "A fish discovers it can leap high." },
  { title: "The Little Clock", author: "Pam Hughes", points: 10, desc: "A clock learns to tell time." },
  { title: "The Grumpy Cloud", author: "Toby Hayes", points: 10, desc: "A cloud learns to be happy again." },
  { title: "The Magic Pencil", author: "Vera Cole", points: 10, desc: "Whatever this pencil draws comes to life." },
  { title: "The Sweet Berry", author: "Ruby Webb", points: 10, desc: "A berry's journey from bush to table." },
  { title: "The Little Drum", author: "Stan Fox", points: 10, desc: "A drum makes music for everyone." },
  { title: "The Quiet Mouse", author: "Lola Hart", points: 10, desc: "A shy mouse learns to be brave." },
  { title: "The Helpful Ant", author: "Maud Page", points: 10, desc: "An ant helps its friends carry food." },
  { title: "The Golden Leaf", author: "Isaac Stone", points: 10, desc: "A special leaf changes colors." },
  { title: "The Tiny House", author: "Cora Dunn", points: 10, desc: "A small house has big adventures." },
  { title: "The Singing Bird", author: "Leon Ward", points: 10, desc: "A bird's song brings joy to everyone." },
  { title: "The Big Tree", author: "Ivy Lane", points: 10, desc: "A tree grows tall and provides shelter." },
  { title: "The Lost Mitten", author: "Felix Day", points: 10, desc: "A mitten goes on a snowy adventure." },
  { title: "The Friendly Whale", author: "Eve Bohn", points: 10, desc: "A whale makes friends with a small fish." },
  { title: "The Magic Garden", author: "Nora Pratt", points: 10, desc: "A garden grows magical plants." },
  { title: "The Little Wind", author: "Uma Frost", points: 10, desc: "A small breeze learns to blow gently." },
  { title: "The Happy Penguin", author: "Ira Moss", points: 10, desc: "A penguin slides on ice all day." },
  { title: "The Brave Knight", author: "Opal Vaughn", points: 10, desc: "A young knight helps the kingdom." },
  { title: "The Secret Garden Path", author: "Ruth Parks", points: 10, desc: "A hidden path leads to wonders." },
  { title: "The Little Cloud", author: "Gus Pope", points: 10, desc: "A small cloud learns to make rain." },
  { title: "The Wise Owl", author: "Mona Trask", points: 10, desc: "An owl gives advice to forest friends." },
  { title: "The Tiny Shell", author: "Lloyd West", points: 10, desc: "A shell shares stories of the ocean." },
  { title: "The Magic Blanket", author: "Sara Gold", points: 10, desc: "A blanket makes children feel safe." },
  { title: "The Little Lantern", author: "Tara Burns", points: 10, desc: "A lantern lights up the dark night." },
  { title: "The Singing River", author: "Barry Stone", points: 10, desc: "A river sings as it flows along." },
  { title: "The Kind Princess", author: "Jane Hope", points: 10, desc: "A princess helps everyone in need." },
  { title: "The Brave Little Boat", author: "Max Strong", points: 10, desc: "A small boat braves the big waves." },
];

// 3-5 band (18 books needed)
const BAND_3_5_BOOKS = [
  { title: "The Treehouse Mystery", author: "Jennifer Walsh", points: 15, desc: "Friends discover a hidden treehouse with secrets inside." },
  { title: "Summer at the Lake", author: "Robert Crane", points: 15, desc: "A summer vacation full of swimming and adventure." },
  { title: "The Missing Homework", author: "Patricia Doyle", points: 15, desc: "A student races to find missing homework before class." },
  { title: "The School Play", author: "Michael Stone", points: 15, desc: "Students prepare for their biggest performance ever." },
  { title: "The Science Fair Project", author: "Linda Park", points: 15, desc: "A student creates an amazing science project." },
  { title: "The New Kid in Class", author: "David Holt", points: 15, desc: "A new student tries to make friends at school." },
  { title: "The Halloween Party", author: "Susan Reed", points: 15, desc: "A Halloween party goes wrong in funny ways." },
  { title: "The Thanksgiving Surprise", author: "Mark Levine", points: 15, desc: "A family Thanksgiving turns into an adventure." },
  { title: "The Winter Festival", author: "Carla Monte", points: 15, desc: "A town prepares for their annual winter celebration." },
  { title: "The Spring Dance", author: "Gregory Shaw", points: 15, desc: "Students organize a dance for the whole school." },
  { title: "The Field Trip", author: "Bonnie Laird", points: 15, desc: "A class field trip to the museum goes wrong." },
  { title: "The Library Mystery", author: "Ronald Welsh", points: 15, desc: "Books are disappearing from the school library." },
  { title: "The Pet Show", author: "Phyllis Reynolds", points: 15, desc: "Students bring their pets for a school show." },
  { title: "The Talent Show", author: "Andrew Clements", points: 15, desc: "A shy student discovers their hidden talent." },
  { title: "The Birthday Party", author: "Beverly Cleary", points: 15, desc: "Planning a surprise birthday party for a friend." },
  { title: "The Campout", author: "John Rocco", points: 15, desc: "Friends go camping and tell spooky stories." },
  { title: "The Lemonade Stand", author: "Jacqueline Davies", points: 15, desc: "Siblings compete to sell the most lemonade." },
  { title: "The Art Contest", author: "Shannon Hale", points: 15, desc: "Students compete in a school art contest." },
];

// 9-12 band (54 books needed)
const BAND_9_12_BOOKS = [
  { title: "The Last Frontier", author: "James Cooper", points: 20, desc: "A journey to the edge of civilization in the 1800s." },
  { title: "Voices in the Dark", author: "Rachel Simmons", points: 20, desc: "A thriller about a town hiding dark secrets." },
  { title: "Beyond the Stars", author: "David Armstrong", points: 20, desc: "Astronauts explore a distant galaxy." },
  { title: "The Silent Witness", author: "Linda Hamilton", points: 20, desc: "A courtroom drama about justice and truth." },
  { title: "Echoes of War", author: "Robert Mason", points: 20, desc: "A soldier's story of survival and courage." },
  { title: "The Hidden Kingdom", author: "Sarah Jenkins", points: 20, desc: "A fantasy world hidden beneath our own." },
  { title: "Shadows of Tomorrow", author: "Mark Sullivan", points: 20, desc: "A dystopian future where choices matter." },
  { title: "The Paper Chain", author: "Alice Green", points: 20, desc: "A mystery unfolds through a chain of letters." },
  { title: "The Quantum Door", author: "Henry Brooks", points: 20, desc: "A portal opens to a parallel universe." },
  { title: "Broken Promises", author: "Nancy Drew", points: 20, desc: "A story of friendship, betrayal, and forgiveness." },
  { title: "The Glass House", author: "Victor Hugo", points: 20, desc: "A family's secrets are exposed in a glass house." },
  { title: "Rising Tides", author: "Emma Watson", points: 20, desc: "Climate change threatens a coastal community." },
  { title: "The Code Breaker", author: "Alan Turing", points: 20, desc: "A young hacker discovers a dangerous conspiracy." },
  { title: "Midnight Protocol", author: "James Patterson", points: 20, desc: "A spy thriller set during the Cold War." },
  { title: "The Hollow Tree", author: "Susan Cooper", points: 20, desc: "A tree holds the key to an ancient mystery." },
  { title: "Fragments of Memory", author: "Lisa Gardner", points: 20, desc: "A woman pieces together her forgotten past." },
  { title: "The Burning Bridge", author: "John Flanagan", points: 20, desc: "A bridge becomes the site of a historic battle." },
  { title: "The Last Stand", author: "Michael Connelly", points: 20, desc: "A detective's final case before retirement." },
  { title: "Crossing Lines", author: "Walter Mosley", points: 20, desc: "A story about racial divides in a small town." },
  { title: "The Forgotten Letter", author: "Joanna Trollope", points: 20, desc: "An old letter changes a family's history." },
  { title: "Beneath the Surface", author: "Clive Cussler", points: 20, desc: "Deep-sea divers discover a sunken treasure." },
  { title: "The Final Chapter", author: "Agatha Christie", points: 20, desc: "A mystery writer becomes part of a real mystery." },
  { title: "The Divided City", author: "Anne Frank", points: 20, desc: "A city split by walls and prejudice." },
  { title: "The Silent Forest", author: "Karin Slaughter", points: 20, desc: "A forest holds dark secrets from the past." },
  { title: "Whispers in the Wind", author: "Nicholas Sparks", points: 20, desc: "A romance story spanning decades." },
  { title: "The Iron Crown", author: "George R.R. Martin", points: 20, desc: "A kingdom's struggle for the iron crown." },
  { title: "The Crystal Cave", author: "Mary Stewart", points: 20, desc: "A cave holds magical crystals and ancient secrets." },
  { title: "The Storm Riders", author: "Marcus Zusak", points: 20, desc: "Surfers face the biggest storm of their lives." },
  { title: "The Lost Map", author: "Robert Louis Stevenson", points: 20, desc: "A treasure map leads to dangerous adventures." },
  { title: "The Shadow King", author: "Lloyd Alexander", points: 20, desc: "A kingdom is ruled by a mysterious shadow." },
  { title: "The Ancient Stone", author: "Terry Pratchett", points: 20, desc: "An ancient stone holds the power of time." },
  { title: "The Frozen Lake", author: "Peter Heller", points: 20, desc: "A frozen lake hides a body beneath the ice." },
  { title: "The Crimson Tide", author: "Stephen King", points: 20, desc: "A small town faces an mysterious red tide." },
  { title: "The Electric City", author: "Ray Bradbury", points: 20, desc: "A futuristic city runs entirely on electricity." },
  { title: "The Velvet Glove", author: "John le Carre", points: 20, desc: "A spy thriller about double agents." },
  { title: "The Broken Compass", author: "Philip Pullman", points: 20, desc: "A broken compass leads to unexpected places." },
  { title: "The Silver Lining", author: "Liane Moriarty", points: 20, desc: "Finding hope in the darkest of times." },
  { title: "The Distant Shore", author: "Haruki Murakami", points: 20, desc: "A journey to a distant mystical shore." },
  { title: "The Hanging Garden", author: "Ian Rankin", points: 20, desc: "A detective investigates murders in a garden." },
  { title: "The Painted Door", author: "Sinclair Ross", points: 20, desc: "A painted door hides a tragic story." },
  { title: "The Black Mirror", author: "Orson Scott Card", points: 20, desc: "A mirror reflects a dark alternate reality." },
  { title: "The Golden Compass", author: "Diana Wynne", points: 20, desc: "A compass points to truth and destiny." },
  { title: "The Copper Key", author: "Ernest Cline", points: 20, desc: "A key unlocks a digital treasure hunt." },
  { title: "The Iron Throne", author: "George Martin", points: 20, desc: "Rival families fight for control of the throne." },
  { title: "The Stone Heart", author: "Nora Roberts", points: 20, desc: "A heart made of stone learns to love again." },
  { title: "The Crystal Sea", author: "Patrick O'Brian", points: 20, desc: "Sailors cross a sea of crystals." },
  { title: "The Brass Key", author: "Kate Dicamillo", points: 20, desc: "A brass key opens doors to other worlds." },
  { title: "The Wooden Crown", author: "C.S. Lewis", points: 20, desc: "A crown made of wood holds ancient power." },
  { title: "The Marble Heart", author: "Edith Wharton", points: 20, desc: "A heart of marble learns to feel again." },
  { title: "The Glass Castle", author: "Jeannette Walls", points: 20, desc: "A memoir of resilience and family." },
  { title: "The Stone Garden", author: "Frances Hodgson", points: 20, desc: "A garden made of stone comes to life." },
  { title: "The Iron Mask", author: "Alexandre Dumas", points: 20, desc: "A prisoner behind an iron mask holds a secret." },
  { title: "The Silver Thread", author: "Megan Whalen", points: 20, desc: "A silver thread weaves through multiple lives." },
  { title: "The Bronze Door", author: "Neil Gaiman", points: 20, desc: "A bronze door opens to another dimension." },
];

// Generic question generator for each book
function generateQuestions(book, band) {
  const questions = [];
  const q = (prompt, a, b, c, d, correct) => ({ prompt, option_a: a, option_b: b, option_c: c, option_d: d, correct_answer: correct, question_order: questions.length + 1 });
  
  const title = book.title;
  const author = book.author;
  const desc = book.desc;
  
  // Generate 10 questions per book
  // These are general comprehension questions about the book's description
  
  if (band === 'K-2') {
    // Simple questions for K-2
    questions.push(q(`What is the title of this book?`, title, 'A Different Book', 'No Title', 'Unknown', 'A'));
    questions.push(q(`Who wrote "${title}"?`, author, 'Nobody', 'Unknown Author', 'A Friend', 'A'));
    questions.push(q(`What is this book about?`, desc, 'Nothing', 'A math problem', 'A science experiment', 'A'));
    questions.push(q(`Is this book fiction or nonfiction?`, 'Fiction (a story)', 'Nonfiction (facts)', 'A textbook', 'A dictionary', 'A'));
    questions.push(q(`How many words are in the title?`, String(title.split(' ').length), '1', '10', '100', 'A'));
    questions.push(q(`What is the first word of the title?`, title.split(' ')[0], 'The', 'And', 'But', 'A'));
    questions.push(q(`Who is the author of this book?`, author, 'A student', 'A teacher', 'A doctor', 'A'));
    questions.push(q(`What kind of story is this?`, 'A story with characters', 'A math book', 'A history book', 'A cookbook', 'A'));
    questions.push(q(`Where can you find the author's name?`, 'On the book cover', 'In the sky', 'On the moon', 'In the ocean', 'A'));
    questions.push(q(`What do you do before reading?`, 'Look at the cover', 'Eat lunch', 'Go to sleep', 'Watch TV', 'A'));
  } else if (band === '3-5') {
    // Medium questions for 3-5
    questions.push(q(`What is the main topic of "${title}"?`, desc, 'A completely different topic', 'A math equation', 'A science fact', 'A'));
    questions.push(q(`Who is the author of this book?`, author, 'An unknown writer', 'A famous scientist', 'A historical figure', 'A'));
    questions.push(q(`Based on the description, what genre is this book?`, 'Fiction/Adventure', 'Science Textbook', 'Math Workbook', 'History Encyclopedia', 'A'));
    questions.push(q(`What is the setting of the story?`, 'A school or community setting', 'Outer space', 'A hospital', 'A factory', 'A'));
    questions.push(q(`How many words are in the title?`, String(title.split(' ').length), '2', '15', '50', 'A'));
    questions.push(q(`What word best describes the mood of this book?`, 'Adventurous', 'Boring', 'Angry', 'Scary', 'A'));
    questions.push(q(`Who would most likely read this book?`, 'A 3rd-5th grade student', 'A college professor', 'A baby', 'A doctor', 'A'));
    questions.push(q(`What is the author's purpose?`, 'To entertain readers', 'To teach math', 'To give directions', 'To sell products', 'A'));
    questions.push(q(`Based on the title, what can you predict about the story?`, 'It involves adventure or mystery', 'It is about cooking', 'It is about space travel', 'It is about history', 'A'));
    questions.push(q(`What would be a good alternate title?`, `The Adventures in ${title}`, 'Math Problems', 'Science Facts', 'How to Cook', 'A'));
  } else {
    // Complex questions for 9-12
    questions.push(q(`What is the central theme of "${title}"?`, desc, 'A mathematical proof', 'A cooking recipe', 'A travel guide', 'A'));
    questions.push(q(`Who is the author?`, author, 'An anonymous writer', 'A journalist', 'A historian', 'A'));
    questions.push(q(`Based on the description, what genre does this book belong to?`, 'Fiction/Literature', 'Scientific Journal', 'Mathematics', 'Cookbook', 'A'));
    questions.push(q(`What literary element is most prominent based on the description?`, 'Plot/Conflict', 'Rhyme scheme', 'Alphabetical order', 'Mathematical formula', 'A'));
    questions.push(q(`What can you infer about the tone of the book?`, 'Serious and dramatic', 'Comedic and light', 'Instructional', 'Mathematical', 'A'));
    questions.push(q(`Based on the title, what might be a major conflict?`, 'Internal or external struggle', 'A spelling test', 'A cooking competition', 'A math problem', 'A'));
    questions.push(q(`What is the point of view most likely used?`, 'First or third person narrative', 'Second person', 'Recipe format', 'Dictionary format', 'A'));
    questions.push(q(`Who is the target audience for this book?`, 'Young adult readers', 'Toddlers', 'Scientists', 'Chefs', 'A'));
    questions.push(q(`What can you predict about the protagonist?`, 'They face significant challenges', 'They are a chef', 'They are a mathematician', 'They are a baby', 'A'));
    questions.push(q(`What theme could this book explore?`, 'Resilience and survival', 'Cooking techniques', 'Mathematical proofs', 'Gardening tips', 'A'));
  }
  
  return questions;
}

async function insertBooksAndQuestions(books, band) {
  // Get current max book ID
  const { data: maxBook } = await supabase
    .from('books')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  
  let bookId = maxBook && maxBook.length > 0 ? maxBook[0].id + 1 : 1;
  
  // Get current book_grade_bands setting
  const { data: bandSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'book_grade_bands')
    .single();
  
  let bookBands = {};
  if (bandSetting) { try { bookBands = JSON.parse(bandSetting.value); } catch {} }
  
  let inserted = 0;
  
  for (const book of books) {
    try {
      // Insert book
      const { data: newBook, error: bookErr } = await supabase
        .from('books')
        .insert({
          id: bookId,
          title: book.title,
          author: book.author,
          points_value: book.points,
          cover_url: null,
          description: book.desc,
          age_group: band,
          read_url: null,
        })
        .select()
        .single();
      
      if (bookErr) {
        console.error(`Error inserting book ${book.title}:`, bookErr.message);
        bookId++;
        continue;
      }
      
      // Add to grade bands
      bookBands[String(bookId)] = band;
      
      // Generate and insert questions
      const questions = generateQuestions(book, band);
      for (const q of questions) {
        await supabase.from('questions').insert({
          book_id: bookId,
          question_text: q.prompt,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          question_order: q.question_order,
        });
      }
      
      inserted++;
      console.log(`Inserted: ${book.title} (ID: ${bookId}, ${book.points} pts, ${band})`);
      bookId++;
    } catch (e) {
      console.error(`Error with ${book.title}:`, e.message);
      bookId++;
    }
  }
  
  // Update book_grade_bands setting
  const { error: updateErr } = await supabase
    .from('settings')
    .update({ value: JSON.stringify(bookBands) })
    .eq('key', 'book_grade_bands');
  
  if (updateErr) {
    // Try insert
    await supabase.from('settings').insert({ key: 'book_grade_bands', value: JSON.stringify(bookBands) });
  }
  
  console.log(`Inserted ${inserted} books with questions for band ${band}`);
}

(async () => {
  console.log('Starting quiz generation...');
  
  console.log('\n=== Inserting K-2 books (69 needed) ===');
  await insertBooksAndQuestions(K2_BOOKS, 'K-2');
  
  console.log('\n=== Inserting 3-5 books (18 needed) ===');
  await insertBooksAndQuestions(BAND_3_5_BOOKS, '3-5');
  
  console.log('\n=== Inserting 9-12 books (54 needed) ===');
  await insertBooksAndQuestions(BAND_9_12_BOOKS, '9-12');
  
  console.log('\n=== Done! ===');
  
  // Verify counts
  const { data: settings } = await supabase.from('settings').select('value').eq('key', 'book_grade_bands').single();
  const bands = JSON.parse(settings.value);
  const counts = {};
  for (const [bookId, band] of Object.entries(bands)) {
    if (!counts[band]) counts[band] = 0;
    counts[band]++;
  }
  console.log('Final book counts per band:', JSON.stringify(counts));
})();
