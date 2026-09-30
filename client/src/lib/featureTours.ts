export type TutorialRole = "student" | "teacher" | "eye-gaze" | "parent";

export type FeatureTourStep = {
  title: string;
  subtitle: string;
  emoji: string;
  details: string[];
};

export const FEATURE_TOURS: Record<TutorialRole, FeatureTourStep[]> = {
  student: [
    {
      title: "Welcome to A.R.I.S.E. Reader",
      subtitle: "Read, practice, earn, and play",
      emoji: "📚",
      details: [
        "Use the Library as your main reading home.",
        "Search books, open quizzes, and track your reading progress.",
        "Your account connects reading progress with rewards, games, badges, and certificates."
      ],
    },
    {
      title: "Library, Search & Book Discovery",
      subtitle: "Find something you actually want to read",
      emoji: "🔎",
      details: [
        "Search and browse the full book library.",
        "Explore the FYP-style discovery feed and saved books.",
        "Use category sections including iARISE lessons, class reading, point books, and recommended books."
      ],
    },
    {
      title: "Quizzes & Book Requests",
      subtitle: "Take a quiz or ask for one",
      emoji: "🧠",
      details: [
        "Take book quizzes after reading and see your score immediately.",
        "Request a quiz when your book is not available.",
        "Use Instant AI Quiz when available for a fast generated quiz that can be reviewed by staff."
      ],
    },
    {
      title: "iARISE Learning",
      subtitle: "Short lessons for real-life skills",
      emoji: "🚀",
      details: [
        "Open iARISE lessons on topics like friendship, feelings, study skills, wellness, money, careers, mindset, and digital citizenship.",
        "Each lesson connects to a short quiz.",
        "iARISE content appears directly alongside regular reading content."
      ],
    },
    {
      title: "Points, Certificates & Progress",
      subtitle: "See your growth",
      emoji: "🏆",
      details: [
        "Passing quizzes earns the book's point value.",
        "Passed quizzes can generate certificates.",
        "Your profile and progress screens show completed quizzes, points, and reading growth."
      ],
    },
    {
      title: "Leaderboard, Badges & Rewards",
      subtitle: "Celebrate reading without losing the fun",
      emoji: "🥇",
      details: [
        "Leaderboards show eligible student readers and grade-band competition.",
        "Badges and teacher rewards celebrate milestones.",
        "Teacher-created rewards can be tied to quiz completion."
      ],
    },
    {
      title: "A.R.I.S.E. 2.0 Live Quiz Games",
      subtitle: "Kahoot-style live classroom play",
      emoji: "⚡",
      details: [
        "Join teacher-hosted live quiz games with a short game code.",
        "Answer questions in real time from your account.",
        "Follow the live standings and results during the session."
      ],
    },
    {
      title: "Club A.R.I.S.E. & Arcade",
      subtitle: "Games are part of the reading reward loop",
      emoji: "🎮",
      details: [
        "Enter Club A.R.I.S.E. and the arcade to play multiplayer and computer games.",
        "Teachers can lock games, limit play, or connect access to passed quizzes.",
        "Regular student accounts can earn more access through reading based on teacher settings."
      ],
    },
    {
      title: "Avatar, Pets, Homes & Worlds",
      subtitle: "Build your own A.R.I.S.E. experience",
      emoji: "🐾",
      details: [
        "Customize your avatar with earned items and characters.",
        "Own pets and keep their happiness up with food, treats, and activities.",
        "Explore your home, The Block/neighborhood, worlds, vehicles, and other interactive spaces."
      ],
    },
    {
      title: "Cinema, Board Quest & Social Play",
      subtitle: "Explore beyond the library",
      emoji: "🎬",
      details: [
        "Visit the A.R.I.S.E. cinema, choose supported shows, sit in the theater, and interact with the space.",
        "Play Board Quest and arcade games with other players or the computer where available.",
        "Use safe-chat phrases and social features built for the school environment."
      ],
    },
    {
      title: "Polls, Messages & Notifications",
      subtitle: "Stay connected",
      emoji: "💬",
      details: [
        "Check notifications for quiz approvals, messages, rewards, and updates.",
        "Use the inbox for messages connected to your reading account.",
        "Participate in polls and other school engagement features when available."
      ],
    },
    {
      title: "Quick Menu & Account",
      subtitle: "Everything stays easy to reach",
      emoji: "🧭",
      details: [
        "Use the Quick Menu for fast access to major A.R.I.S.E. features, including A.R.I.S.E. 2.0.",
        "Open your account/profile to review your activity and settings.",
        "Use back/home navigation to move between reading, games, profile, and progress."
      ],
    },
  ],

  teacher: [
    {
      title: "Welcome to the Teacher Dashboard",
      subtitle: "Manage reading, quizzes, students, and game access",
      emoji: "👩‍🏫",
      details: [
        "Your dashboard is the control center for assigned students.",
        "Use notifications and pending-task areas to see what needs attention.",
        "Teacher tools are separated from the student experience."
      ],
    },
    {
      title: "Student Management",
      subtitle: "See assigned students and their progress",
      emoji: "👥",
      details: [
        "View your students, all students you are allowed to access, and pending student approvals.",
        "Search students, review quiz totals and points, and open student details.",
        "Reset passwords, reassign students where permitted, and approve account requests."
      ],
    },
    {
      title: "Quiz Requests & AI Quiz Review",
      subtitle: "Keep quiz quality under teacher control",
      emoji: "✅",
      details: [
        "Review student book requests and pending AI-generated quizzes.",
        "Approve or reject generated quizzes before students use them when review is required.",
        "Create or support quizzes for books students want to read."
      ],
    },
    {
      title: "Live A.R.I.S.E. 2.0 Quizzes",
      subtitle: "Run real-time classroom games",
      emoji: "⚡",
      details: [
        "Create live quiz sessions students join with a short code.",
        "Run questions in real time and watch the live board update.",
        "Use live quizzes as a whole-class review or engagement activity."
      ],
    },
    {
      title: "Proctor & Quiz Controls",
      subtitle: "Control when quizzes begin",
      emoji: "🔐",
      details: [
        "Manage the proctor password used for protected student quizzes.",
        "Use teacher approval and quiz review tools to keep testing intentional.",
        "Students still receive their normal score and point rules after a valid attempt."
      ],
    },
    {
      title: "Progress & Growth Check",
      subtitle: "Monitor more than points",
      emoji: "📈",
      details: [
        "Review student quiz history, points, and progress.",
        "Use Growth Check data to see student performance over time.",
        "Use grade-change requests and reading-level information when those tools are active."
      ],
    },
    {
      title: "Rewards & Motivation",
      subtitle: "Add incentives that fit your students",
      emoji: "🎁",
      details: [
        "Create student rewards tied to reading or quiz completion.",
        "Use badges, certificates, and incentives alongside leaderboard points.",
        "Rewards can support motivation without changing a student's quiz score."
      ],
    },
    {
      title: "Club A.R.I.S.E. Controls",
      subtitle: "Decide how games connect to reading",
      emoji: "🎮",
      details: [
        "Lock or unlock Club A.R.I.S.E. for individual students.",
        "Set daily game limits or games-per-passed-quiz rules.",
        "Choose whether passing a quiz unlocks unlimited play for the rest of the week."
      ],
    },
    {
      title: "Parent Connection",
      subtitle: "Bring families into the reading loop",
      emoji: "👨‍👩‍👧",
      details: [
        "Print or share parent connection codes for students.",
        "Parents can link to their child and view progress.",
        "Family tools are especially important for Eye Gazer personalization and controls."
      ],
    },
    {
      title: "Messages & Notifications",
      subtitle: "Keep communication inside the platform",
      emoji: "🔔",
      details: [
        "Use notifications to catch pending quizzes, requests, and account activity.",
        "Send or review messages connected to students and families.",
        "Use the inbox and dashboard alerts instead of hunting through separate pages."
      ],
    },
    {
      title: "Eye Gazer Support",
      subtitle: "Support visual, AAC, and simplified learning",
      emoji: "👁️",
      details: [
        "Eye Gazer students have a separate simplified learning experience.",
        "Staff can review Eye Gaze quiz standards and requests.",
        "Eye Gazer learning includes visual quizzes, AAC/My Talker, games, Life Skills, My World, Shorts, flash cards, and progress."
      ],
    },
    {
      title: "Ready to Teach",
      subtitle: "Reading and motivation in one system",
      emoji: "🌟",
      details: [
        "Use reading data, rewards, games, and live activities together.",
        "Adjust access as student needs change.",
        "The goal is to make reading practice easier to manage and more motivating for students."
      ],
    },
  ],

  "eye-gaze": [
    {
      title: "Welcome to My Learning Home",
      subtitle: "Large choices, simple navigation, full access",
      emoji: "👋",
      details: [
        "The Eye Gazer home keeps the most important choices large and easy to reach.",
        "Main choices include My Talker, Games, Life Skills, and My World.",
        "More tools include A.R.I.S.E. Shorts, Flash Cards, My Buddy, and My Progress."
      ],
    },
    {
      title: "My Talker",
      subtitle: "AAC communication plus language learning",
      emoji: "🗣️",
      details: [
        "Tap words and categories to hear spoken words and sentences.",
        "Use categories such as people, food, animals, and emotions.",
        "Learning tools can expand a word into phonics, pictures, phrases, questions, and practice."
      ],
    },
    {
      title: "Personalized Talker",
      subtitle: "Make communication familiar",
      emoji: "🎙️",
      details: [
        "Grown-ups can add personal pictures and custom words.",
        "Words and sentences can be edited to match the learner.",
        "Parent-recorded voice options and simplified/category views can personalize the AAC experience."
      ],
    },
    {
      title: "Eye Gaze Games & Lessons",
      subtitle: "Learn through play",
      emoji: "🎮",
      details: [
        "Open reading and learning games designed for large targets and simple interaction.",
        "Games include visual, matching, reading, and fidget-style activities.",
        "Lessons and books are available from the Games learning area when enabled."
      ],
    },
    {
      title: "Visual Quizzes",
      subtitle: "One question at a time",
      emoji: "🧠",
      details: [
        "Eye Gaze quizzes use large visual answer choices.",
        "Questions can be read aloud with text-to-speech.",
        "Results show performance without requiring a traditional keyboard-heavy quiz experience."
      ],
    },
    {
      title: "Life Skills",
      subtitle: "Practice everyday routines",
      emoji: "🌟",
      details: [
        "Life Skills contains practical learning routines.",
        "Potty Training tools can include timers, trackers, songs/videos, and step-by-step support.",
        "Family settings can control which Life Skills tools are available."
      ],
    },
    {
      title: "My World",
      subtitle: "Learn from familiar places and pictures",
      emoji: "🏠",
      details: [
        "Upload familiar room or environment pictures with grown-up help.",
        "Add and edit labels to identify objects and build vocabulary.",
        "Use familiar images for exploration, prompts, and I-Spy-style learning."
      ],
    },
    {
      title: "A.R.I.S.E. Shorts",
      subtitle: "Short-form learning videos",
      emoji: "📺",
      details: [
        "Watch an auto-playing learning feed selected for the learner.",
        "Families can control age range, channels, and content types.",
        "Comprehension checks can appear during videos before playback continues."
      ],
    },
    {
      title: "Flash Cards & My Buddy",
      subtitle: "Repeat, hear, and practice",
      emoji: "🃏",
      details: [
        "Flash Cards support swipe, picture, and audio practice.",
        "My Buddy provides a familiar learning companion.",
        "These tools are designed to make repeated practice feel less clinical and more engaging."
      ],
    },
    {
      title: "My Progress",
      subtitle: "See what I learned",
      emoji: "⭐",
      details: [
        "Track completed Eye Gaze learning activities and quiz progress.",
        "Progress can include skill areas and completed activity counts.",
        "Eligible real student accounts can appear in Eye Gazer rankings; demo accounts never do."
      ],
    },
    {
      title: "Family Controls",
      subtitle: "Grown-ups shape the experience",
      emoji: "👨‍👩‍👧",
      details: [
        "Parents can choose which Eye Gazer tools are available.",
        "Grown-up gates protect editing areas such as My World and communication settings.",
        "The learner keeps a simple interface while adults keep access to setup controls."
      ],
    },
    {
      title: "Eye Gazer Account",
      subtitle: "Profile, appearance, and personal settings",
      emoji: "🎨",
      details: [
        "Use the Eye Gazer account area for profile and appearance choices.",
        "Personal settings can include profile image, colors, learning buddy settings, and related preferences.",
        "Navigation stays focused on Home, My Talker, Games, Life Skills, and Profile."
      ],
    },
  ],

  parent: [
    {
      title: "Welcome to the Parent Experience",
      subtitle: "Stay connected to your child's reading and learning",
      emoji: "👨‍👩‍👧",
      details: [
        "A parent account links to a student using the school's connection process.",
        "Your dashboard focuses on the linked child's progress rather than a separate parent leaderboard.",
        "Parent accounts are not student competitors."
      ],
    },
    {
      title: "Reading Progress",
      subtitle: "See quizzes, points, and books",
      emoji: "📊",
      details: [
        "Review the linked student's quiz history and reading activity.",
        "See points, completed quizzes, and other progress information.",
        "Use the dashboard to spot growth and celebrate consistency."
      ],
    },
    {
      title: "Certificates & Achievements",
      subtitle: "Celebrate progress at home",
      emoji: "🏅",
      details: [
        "View certificates earned from passed quizzes.",
        "Use achievements and points as a conversation starter about reading.",
        "Parent access is for support and visibility, not competition."
      ],
    },
    {
      title: "Messages & School Connection",
      subtitle: "Keep communication close to the reading data",
      emoji: "💬",
      details: [
        "Use parent messaging tools to stay connected with the school or teacher where available.",
        "See updates related to the linked student's reading account.",
        "Use parent connection codes when setting up a family account."
      ],
    },
    {
      title: "Eye Gazer Family Controls",
      subtitle: "Choose what your child can access",
      emoji: "👁️",
      details: [
        "For linked Eye Gazer students, families can control available learning areas.",
        "Choose access to games, videos, communication, Life Skills, My World, and other supported tools.",
        "Controls let the child keep a simple home screen matched to family priorities."
      ],
    },
    {
      title: "My Talker Setup",
      subtitle: "Personalize AAC communication",
      emoji: "🗣️",
      details: [
        "Add personal pictures, edit words and sentences, and organize categories.",
        "Use familiar language that makes communication more useful at home and school.",
        "Supported settings can include recorded family voice and simplified views."
      ],
    },
    {
      title: "My World Setup",
      subtitle: "Turn familiar spaces into learning spaces",
      emoji: "🏠",
      details: [
        "Add room or environment photos for the linked Eye Gazer learner.",
        "Edit object labels and learning prompts.",
        "Grown-up checks protect editing tools while the learner gets a simple exploration view."
      ],
    },
    {
      title: "Flash Cards, Life Skills & Media",
      subtitle: "Extend practice beyond book quizzes",
      emoji: "🌈",
      details: [
        "Support personalized flash-card practice.",
        "Use Life Skills routines such as potty-training supports where enabled.",
        "Manage supported A.R.I.S.E. Shorts content settings for the linked learner."
      ],
    },
    {
      title: "Ready to Support",
      subtitle: "One connected view of reading and learning",
      emoji: "❤️",
      details: [
        "Use the parent account to monitor, celebrate, personalize, and communicate.",
        "Student and Eye Gazer experiences remain separate from the parent account.",
        "The parent account never competes on student leaderboards."
      ],
    },
  ],
};
