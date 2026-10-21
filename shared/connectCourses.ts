// A.R.I.S.E. Connect Learning: short career courses that end in a certificate on the student's profile.
// Shared by server/ariseSocial.ts (which checks answers and issues certificates) and sent to /social/
// through GET /api/social/catalog. Each course: 3 short lessons, each with reading, key terms, an optional
// hands-on activity and a quick check. Answers are checked again on the server before a lesson counts.

export type CourseField = "trades" | "eng" | "film" | "music" | "health" | "tech" | "biz";
export type CoursePath = "trade" | "cert" | "college";
export type CourseQuestion = { q: string; o: string[]; a: number; why: string };
export type CourseLesson = {
  title: string; minutes: number; body: string[]; terms: [string, string][];
  activity?: "ohm" | "beat" | "profit"; tryIt?: string; quiz: CourseQuestion[];
};
export type Course = {
  id: string; code: string; field: CourseField; icon: string; title: string; minutes: number; points: number;
  paths: CoursePath[]; interests: string[]; blurb: string; learn: string[]; careers: string[]; subjects: string[];
  lessons: CourseLesson[];
};

export const COURSE_FIELDS: Record<CourseField, string> = {
  trades: "Trades", eng: "Engineering", film: "Film & Media", music: "Music Production",
  health: "Healthcare", tech: "Tech & Coding", biz: "Business",
};
export const COURSE_PATH_LABELS: Record<CoursePath, string> = { trade: "Apprenticeship", cert: "Certificate program", college: "College degree" };

export const COURSES: Course[] = [
{id:"elec",code:"ELEC 101",field:"trades",icon:"bolt",title:"Electrical Basics",minutes:35,points:20,paths:["trade","cert"],interests:["build","how"],
 blurb:"Learn how circuits work, how electricians stay safe, and how to start an apprenticeship.",
 learn:["Use Ohm's law to figure out current in a circuit","Explain lockout/tagout and other job-site safety rules","Map the path from apprentice to licensed electrician"],
 careers:["Electrician","Solar panel installer","Lineworker","Electrical inspector"],subjects:["Algebra","Physical science","Shop / CTE classes"],
 lessons:[
 {title:"How circuits work",minutes:12,activity:"ohm",
  body:["A circuit is a complete loop that electricity travels around. Break the loop anywhere and the power stops. That is exactly what a light switch does: it opens or closes the loop.",
   "Electricians talk about three things. Voltage is the push that moves electricity. Current is how much electricity is flowing. Resistance is anything that slows the flow down, like a light bulb or a heater.",
   "These three are connected by Ohm's law: volts = amps × ohms. If you know two of them, you can always find the third. Electricians use this every day to pick the right wire size and breaker."],
  terms:[["Voltage (V)","The push, measured in volts"],["Current (A)","The flow, measured in amps"],["Resistance (Ω)","What slows the flow, measured in ohms"]],
  quiz:[{q:"A circuit has 12 volts and 4 ohms of resistance. How much current flows?",o:["48 amps","3 amps","8 amps","16 amps"],a:1,why:"Current = volts ÷ ohms, so 12 ÷ 4 = 3 amps."},
        {q:"What does a light switch do in a circuit?",o:["Adds more voltage","Stores electricity for later","Opens or closes the loop","Changes the wire size"],a:2,why:"A switch breaks or completes the loop. No complete loop means no current."}]},
 {title:"Safety on the job",minutes:10,
  body:["Electricians treat every wire as live until they have tested it themselves. A meter check takes seconds and prevents serious injuries.",
   "Before working on equipment, they use lockout/tagout: shut off the breaker, put a lock on it, and attach a tag with their name so nobody turns the power back on while they work.",
   "Outlets near water, like in kitchens and bathrooms, are GFCI outlets. They watch for electricity leaking where it should not go and cut the power in a fraction of a second."],
  terms:[["Lockout/tagout","Locking and labeling a power source so it stays off"],["GFCI","An outlet that shuts off fast if current leaks"],["PPE","Safety gear like glasses and insulated gloves"]],
  tryIt:"Walk around your home with an adult and find the GFCI outlets. They have TEST and RESET buttons. Which rooms are they in, and why do you think so?",
  quiz:[{q:"What is lockout/tagout?",o:["Locking the toolbox at night","Locking and labeling a power source so it stays off during work","Tagging wires with their color","Turning off the lights when you leave"],a:1,why:"It keeps someone else from turning the power back on while you are working."},
        {q:"Where are you most likely to find a GFCI outlet?",o:["Next to the kitchen sink","Inside a closet","On the ceiling","Behind the TV"],a:0,why:"GFCI outlets go near water because water makes shocks more dangerous."}]},
 {title:"Becoming an electrician",minutes:13,
  body:["Most electricians start as apprentices. An apprenticeship is a paid job where you learn from experienced electricians while taking classes. In the US it usually lasts four to five years.",
   "After the apprenticeship you take a licensing exam to become a journeyman electrician. With more experience and another exam, you can become a master electrician and run your own jobs or business.",
   "Electricians can specialize in homes, big buildings, factories, or newer work like solar panels and EV chargers. In middle and high school, algebra, science and any shop or CTE classes give you a head start."],
  terms:[["Apprentice","Paid trainee learning on the job"],["Journeyman","Licensed electrician who works on their own"],["Master electrician","Highest license; can lead jobs and pull permits"]],
  quiz:[{q:"What makes an apprenticeship different from regular school?",o:["You only read books","You get paid while you learn on real jobs","It takes one weekend","You do not need any classes"],a:1,why:"Apprentices earn a paycheck while they learn from experienced workers."},
        {q:"What usually comes right after finishing an apprenticeship?",o:["Master electrician license","Retiring","A journeyman license exam","Starting over as a helper"],a:2,why:"Journeyman is the first full license. Master comes later with more experience."}]}
 ]},
{id:"engr",code:"ENGR 101",field:"eng",icon:"truss",title:"Think Like an Engineer",minutes:40,points:20,paths:["college","cert"],interests:["build","how"],
 blurb:"Use the engineering design process, meet the different kinds of engineers, and find out why triangles hold up bridges.",
 learn:["Walk through the engineering design process","Match problems to the type of engineer who solves them","Explain why triangles make structures strong"],
 careers:["Civil engineer","Mechanical engineer","Biomedical engineer","Engineering technician"],subjects:["Geometry","Physics","Robotics or STEM clubs"],
 lessons:[
 {title:"The design process",minutes:13,
  body:["Engineers solve problems with a repeatable process: define the problem, research, brainstorm ideas, plan, build a prototype, test it, and improve it.",
   "A prototype is an early model built to test an idea. It does not have to be pretty. Its job is to show what works and what fails.",
   "The process is a loop, not a straight line. When a test fails, engineers learn from it, change the design, and test again. Failing early is part of the plan."],
  terms:[["Prototype","An early test version of a design"],["Constraint","A limit, like budget, time or materials"],["Iterate","Improve a design and test it again"]],
  tryIt:"Pick something in your room that annoys you, like a cord that keeps falling. Write the problem in one sentence, then sketch three different fixes.",
  quiz:[{q:"What is a prototype?",o:["The final product sold in stores","An early model built to test an idea","A drawing of a building","A type of engineer"],a:1,why:"Prototypes are for testing. The final version comes after many rounds."},
        {q:"A prototype fails its test. What does an engineer do next?",o:["Gives up on the idea","Hides the results","Learns from it, improves the design and tests again","Ships it anyway"],a:2,why:"Testing and improving is the core loop of engineering."}]},
 {title:"Kinds of engineers",minutes:12,
  body:["Civil engineers design bridges, roads, tunnels and water systems. Mechanical engineers design machines, engines and anything with moving parts.",
   "Electrical engineers work on power systems and electronics. Biomedical engineers design medical devices like prosthetic legs and heart monitors.",
   "Aerospace engineers work on aircraft and spacecraft, and environmental engineers protect air, water and soil. Most engineers earn a four-year degree. Engineering technicians often start with a two-year degree."],
  terms:[["Civil","Bridges, roads, water"],["Mechanical","Machines and moving parts"],["Biomedical","Health devices and the human body"]],
  quiz:[{q:"Who would design a prosthetic leg?",o:["Civil engineer","Biomedical engineer","Aerospace engineer","Environmental engineer"],a:1,why:"Biomedical engineers combine engineering with medicine and the human body."},
        {q:"A city needs a new bridge. Which engineer leads the design?",o:["Civil engineer","Software engineer","Biomedical engineer","Electrical engineer"],a:0,why:"Civil engineers design public structures like bridges and roads."}]},
 {title:"Strong shapes",minutes:15,
  body:["Push on the corner of a square made of sticks and it folds into a slanted shape. Push on a triangle and it keeps its shape. That is why triangles show up everywhere in structures.",
   "A truss is a frame made of connected triangles. Look at bridges, cranes, roof frames and power towers and you will see them.",
   "Triangles spread a load across all three sides, so no single joint has to hold everything. Engineers test this with models before anything real gets built."],
  terms:[["Load","The weight or force a structure carries"],["Truss","A frame made of triangles"],["Joint","Where two parts connect"]],
  tryIt:"Build a square and a triangle out of straws and tape. Press down on a corner of each. Which one bends first?",
  quiz:[{q:"Why do engineers use triangles in bridges and roofs?",o:["They are cheaper to paint","They keep their shape under a load","They are easier to draw","They weigh more"],a:1,why:"A triangle cannot fold without one of its sides changing length, so it stays rigid."},
        {q:"Which path can lead to an engineering technician job?",o:["A two-year degree","No school at all, ever","Only a PhD","A cooking certificate"],a:0,why:"Many engineering technicians start with a two-year associate degree."}]}
 ]},
{id:"film",code:"FILM 101",field:"film",icon:"clap",title:"Directing Your First Scene",minutes:35,points:15,paths:["college","cert"],interests:["stories"],
 blurb:"Plan shots like a director, use storyboards, and learn the 180-degree rule used on every film set.",
 learn:["Describe what a director does before and during filming","Pick the right shot type for a moment","Use the 180-degree rule to keep scenes clear"],
 careers:["Director","Cinematographer","Video editor","Production assistant"],subjects:["English / writing","Art","Media or video production"],
 lessons:[
 {title:"What a director does",minutes:11,
  body:["The director turns a script into what you see on screen. They decide how scenes should feel and guide everyone toward that vision.",
   "Before filming, directors break down the script, sketch storyboards (comic-style drawings of each shot), and make a shot list. They plan camera moves with the cinematographer, also called the director of photography.",
   "On set, the director works with actors on their performance. After filming, they work with the editor to put the story together."],
  terms:[["Storyboard","Drawings that show each planned shot"],["Shot list","The list of every shot to film"],["Cinematographer","Leads the camera and lighting team"]],
  quiz:[{q:"What is a storyboard?",o:["The script's first page","Comic-style drawings of each planned shot","A list of actors","The movie poster"],a:1,why:"Storyboards let the whole crew see the plan before the camera rolls."},
        {q:"Who does the director plan camera shots with?",o:["The caterer","The cinematographer","The ticket seller","The costume designer"],a:1,why:"The cinematographer, or director of photography, runs camera and lighting."}]},
 {title:"Shot types",minutes:12,
  body:["A wide shot shows the whole setting. When it opens a scene to show where we are, it is called an establishing shot.",
   "A medium shot shows a character from about the waist up. It is good for body language and conversations.",
   "A close-up fills the frame with a face or an object. Directors use close-ups when they want you to feel a character's emotion or notice an important detail."],
  terms:[["Establishing shot","Shows where the scene happens"],["Medium shot","Waist up; good for talking"],["Close-up","Face or detail fills the screen"]],
  tryIt:"Use a phone to film the same moment three ways: wide, medium and close-up. Watch them back. Which one makes you feel the most?",
  quiz:[{q:"You want viewers to feel how scared a character is. Which shot fits best?",o:["Wide shot","Close-up","Establishing shot","Aerial shot"],a:1,why:"Close-ups put the audience right in front of the character's emotions."},
        {q:"What is an establishing shot for?",o:["Showing where the scene takes place","Showing the end credits","Hiding the actors","Recording sound"],a:0,why:"It tells the audience where they are before the action starts."}]},
 {title:"The 180-degree rule",minutes:12,
  body:["Imagine a line drawn between two characters who are talking. If the camera stays on one side of that line, one character always faces right and the other always faces left.",
   "Cross the line and suddenly both characters seem to face the same way. Viewers get confused about who is looking at whom.",
   "Many directors start as production assistants, helping on set and learning how everything works. Others go to film school or build a portfolio of short films they make with friends."],
  terms:[["180-degree line","Imaginary line the camera stays behind"],["Production assistant","Entry-level helper on a film set"],["Coverage","All the shots filmed for one scene"]],
  quiz:[{q:"What does the 180-degree rule protect?",o:["The camera from damage","The direction characters face on screen","The actors' lines","The movie budget"],a:1,why:"Staying on one side keeps characters facing consistent directions so the scene makes sense."},
        {q:"What is a common first job on a film set?",o:["Director","Production assistant","Studio owner","Lead actor"],a:1,why:"Production assistants learn how a set runs from the ground up."}]}
 ]},
{id:"musc",code:"MUSC 101",field:"music",icon:"music",title:"Make Your First Beat",minutes:40,points:20,paths:["cert","college"],interests:["music","computers"],
 blurb:"Build a drum pattern on a real step grid, learn studio words like BPM and EQ, and explore audio careers.",
 learn:["Build a beat in 4/4 time on a 16-step grid","Use BPM, levels, EQ and panning correctly","Name careers in music and audio"],
 careers:["Music producer","Audio engineer","Sound designer for games","Live sound technician"],subjects:["Music / band","Math (counting & fractions)","Computer class"],
 lessons:[
 {title:"Inside the studio",minutes:12,
  body:["Producers make music on a DAW, which stands for digital audio workstation. GarageBand, FL Studio, Ableton Live and Logic Pro are all DAWs.",
   "Every song has a tempo measured in BPM, or beats per minute. A lot of hip-hop sits somewhere around 80 to 100 BPM, and a lot of house music around 120 to 128.",
   "In a DAW you arrange sounds on a timeline, record instruments and voices, and mix everything so it sounds good together."],
  terms:[["DAW","Software for making and recording music"],["BPM","Beats per minute, the song's speed"],["Track","One layer, like drums or vocals"]],
  quiz:[{q:"What does DAW stand for?",o:["Digital audio workstation","Drum and wave","Digital art window","Direct audio wire"],a:0,why:"A DAW is the main tool producers use to build songs."},
        {q:"What does BPM measure?",o:["How loud a song is","How fast the beat is","How long the song is","How many instruments play"],a:1,why:"BPM is beats per minute, the tempo of the song."}]},
 {title:"Build a beat",minutes:15,activity:"beat",
  body:["Most popular music is in 4/4 time: four beats in every bar. A step grid splits each bar into 16 steps, so each beat gets four steps.",
   "A classic pattern puts the kick drum on beats 1 and 3 and the snare on beats 2 and 4. Hi-hats keep time in between.",
   "Press Play below, then click squares to change the pattern. Try moving the kick around and hear how the groove changes."],
  terms:[["Bar","One group of four beats in 4/4"],["Kick","The low, booming drum"],["Snare","The sharp crack on 2 and 4"]],
  quiz:[{q:"In 4/4 time, how many beats are in one bar?",o:["2","3","4","16"],a:2,why:"The top number tells you: four beats per bar."},
        {q:"In a classic beat, the snare usually lands on which beats?",o:["1 and 3","2 and 4","Only beat 1","Every step"],a:1,why:"Kick on 1 and 3, snare on 2 and 4 is the backbone of countless songs."}]},
 {title:"Mixing & music careers",minutes:13,
  body:["Mixing means making every sound fit together. Levels set how loud each track is. EQ shapes the lows, mids and highs of a sound. Panning places sounds left or right in your headphones.",
   "Producers shape songs and work with artists. Audio engineers record and mix. Sound designers create sound effects for games and movies, and live sound techs run concerts.",
   "Paths in include audio engineering certificate programs, college music technology degrees, and building a portfolio of your own tracks."],
  terms:[["Levels","How loud each track is"],["EQ","Adjusts low, mid and high frequencies"],["Panning","Moves sound left or right"]],
  quiz:[{q:"What does panning do?",o:["Makes a track louder","Moves a sound left or right","Speeds up the song","Removes the bass"],a:1,why:"Panning places sounds in the stereo field."},
        {q:"Which tool shapes the lows, mids and highs of a sound?",o:["EQ","BPM","A bar","The snare"],a:0,why:"EQ, short for equalizer, adjusts frequencies."}]}
 ]},
{id:"hlth",code:"HLTH 101",field:"health",icon:"pulse",title:"Healthcare Heroes",minutes:35,points:20,paths:["cert","college"],interests:["help"],
 blurb:"Take a pulse, learn how health workers protect patient privacy, and see quick ways into healthcare jobs.",
 learn:["Measure and calculate a heart rate","Explain patient privacy and infection control","Compare CNA, EMT, LPN and RN paths"],
 careers:["Certified nursing assistant (CNA)","EMT","Registered nurse","Medical assistant"],subjects:["Biology","Health class","Health science CTE"],
 lessons:[
 {title:"Vital signs",minutes:12,
  body:["Vital signs are quick measurements that show how the body is doing: heart rate, breathing rate, blood pressure, temperature and oxygen level.",
   "To take a pulse, place two fingers (not your thumb) on the inside of the wrist below the thumb. Count the beats for 15 seconds, then multiply by 4 to get beats per minute.",
   "Why not the thumb? It has its own pulse, which can mix up your count. A normal resting heart rate for adults is usually 60 to 100 beats per minute."],
  terms:[["Pulse","The heartbeat you feel in an artery"],["BPM","Beats per minute"],["Vital signs","Key body measurements"]],
  tryIt:"Take your own pulse sitting down. Then do 20 jumping jacks and take it again. How much did it change?",
  quiz:[{q:"You count 18 beats in 15 seconds. What is the heart rate?",o:["33 bpm","54 bpm","72 bpm","90 bpm"],a:2,why:"18 × 4 = 72 beats per minute."},
        {q:"Why shouldn't you use your thumb to take someone's pulse?",o:["It is too short","Your thumb has its own pulse","It is not allowed","Thumbs are too cold"],a:1,why:"You might count your own heartbeat instead of the patient's."}]},
 {title:"Privacy and teamwork",minutes:11,
  body:["In the US, a law called HIPAA protects patients' health information. Health workers only share it with people who need it to give care.",
   "Hospitals run on teamwork: doctors, nurses, nursing assistants, techs, pharmacists and more. Clear communication keeps patients safe.",
   "Hand washing is one of the most important skills in healthcare. Scrub with soap for at least 20 seconds to stop germs from spreading."],
  terms:[["HIPAA","US law protecting health information"],["Infection control","Steps that stop germs spreading"],["Care team","Everyone who helps one patient"]],
  quiz:[{q:"What does HIPAA protect?",o:["Hospital parking","Patients' health information","Doctors' salaries","Medicine prices"],a:1,why:"HIPAA keeps private health details private."},
        {q:"How long should you scrub with soap when washing hands?",o:["3 seconds","At least 20 seconds","5 minutes","Only if hands look dirty"],a:1,why:"Twenty seconds of scrubbing removes far more germs."}]},
 {title:"Ways into healthcare",minutes:12,
  body:["A certified nursing assistant (CNA) helps patients with daily care. CNA training can take just weeks to a few months, and some high schools offer it in CTE programs.",
   "EMTs respond to emergencies. EMT training is usually one course of about a semester. LPNs, or licensed practical nurses, train for about a year.",
   "Registered nurses (RNs) earn a two-year associate degree or a four-year bachelor's degree and pass a licensing exam. Many people start as CNAs or EMTs and keep climbing."],
  terms:[["CNA","Nursing assistant; short training"],["EMT","Emergency medical technician"],["RN","Registered nurse; degree plus license"]],
  quiz:[{q:"Which job can you train for in weeks to a few months?",o:["Surgeon","Certified nursing assistant","Pharmacist","Registered nurse"],a:1,why:"CNA programs are short, which makes them a fast way to start in healthcare."},
        {q:"How do people become registered nurses?",o:["A two- or four-year nursing degree plus a licensing exam","A weekend class","Just apply at a hospital","Only by becoming a doctor first"],a:0,why:"RNs need a nursing degree and must pass the licensing exam."}]}
 ]},
{id:"tech",code:"TECH 101",field:"tech",icon:"code",title:"Code Your First Game",minutes:40,points:20,paths:["college","cert"],interests:["computers","how"],
 blurb:"Learn the three building blocks of every game: variables, if statements and loops. Then explore tech careers.",
 learn:["Track a score with a variable","Use if statements and loops to control a game","Name tech careers and certifications"],
 careers:["Software developer","Game developer","Cybersecurity analyst","IT support specialist"],subjects:["Math","Computer science","Robotics or coding club"],
 lessons:[
 {title:"Variables",minutes:12,
  body:["A variable is a labeled box that stores information. In a game, score = 0 creates a box called score and puts 0 inside.",
   "Variables can change. When the player grabs a coin, the game runs score = score + 1. The new value replaces the old one.",
   "Games use variables for everything: lives, speed, level, player name and more."],
  terms:[["Variable","A named place to store a value"],["Value","What is stored, like 5 or \"Sam\""],["Assign","Put a value into a variable"]],
  quiz:[{q:"What is a variable?",o:["A broken piece of code","A named place that stores information","A type of computer","A game level"],a:1,why:"Variables hold values your program can use and change."},
        {q:"score = 5, then score = score + 2. What is score now?",o:["5","2","7","52"],a:2,why:"5 + 2 = 7, and that replaces the old value."}]},
 {title:"If statements & loops",minutes:14,
  body:["An if statement makes a decision: if lives == 0, show Game Over. If the condition is false, that code is skipped.",
   "A loop repeats code. A game loop runs many times a second: check controls, move characters, check for crashes, draw the screen, repeat.",
   "Put variables, ifs and loops together and you can build almost any game."],
  terms:[["Condition","A true-or-false check"],["If statement","Runs code only when a condition is true"],["Loop","Repeats code"]],
  tryIt:"Write out a game in plain words using one variable, one if and one loop. Example: repeat forever: if the player touches a coin, add 1 to score.",
  quiz:[{q:"Which part of code repeats an action?",o:["A variable","A loop","A comment","A condition"],a:1,why:"Loops repeat code until told to stop."},
        {q:"score = 8. The code says: if score > 10, show \"Level up!\" What happens?",o:["\"Level up!\" shows","Nothing shows","The game crashes","Score becomes 10"],a:1,why:"8 is not greater than 10, so the if block is skipped."}]},
 {title:"Careers in tech",minutes:14,
  body:["Software developers build apps and programs. Game developers build games. Web developers build websites. Cybersecurity analysts protect computers and networks from attacks.",
   "Paths include a college computer science degree, coding bootcamps, and industry certifications.",
   "One common starting certification is CompTIA A+, which covers computer hardware and IT support. Many people start in IT support and move into other tech jobs."],
  terms:[["Developer","Someone who builds software"],["Cybersecurity","Protecting systems from attacks"],["CompTIA A+","An entry-level IT certification"]],
  quiz:[{q:"What does a cybersecurity analyst do?",o:["Designs game characters","Protects computers and networks from attacks","Fixes printers only","Sells phones"],a:1,why:"Cybersecurity is all about defending systems and data."},
        {q:"What is CompTIA A+?",o:["A video game","An entry-level IT certification","A college in California","A coding language"],a:1,why:"A+ is a widely known starting certification for IT support jobs."}]}
 ]},
{id:"weld",code:"WELD 101",field:"trades",icon:"flame",title:"Welding & Fabrication",minutes:30,points:15,paths:["trade","cert"],interests:["build"],
 blurb:"Compare stick, MIG and TIG welding, learn the safety gear, and see how welders get certified.",
 learn:["Explain what welding does and where it is used","Compare stick, MIG and TIG welding","Name the safety gear and certifications welders use"],
 careers:["Welder","Pipefitter","Fabricator","Welding inspector"],subjects:["Geometry","Shop / CTE classes","Physical science"],
 lessons:[
 {title:"What welding is",minutes:9,
  body:["Welding joins pieces of metal by melting their edges, often with extra filler metal, so they cool into one solid piece.",
   "Welders build and repair bridges, ships, pipelines, cars, farm equipment and the steel frames of buildings.",
   "Fabricators cut, bend and weld metal into parts and products, often reading blueprints to get every measurement right."],
  terms:[["Weld","A joint where metal has fused"],["Filler metal","Extra metal added to the joint"],["Blueprint","A technical drawing with measurements"]],
  quiz:[{q:"What does welding do?",o:["Glues plastic together","Joins metal by melting it so it fuses","Paints metal","Cuts wood"],a:1,why:"Melted metal cools into one solid joint."},
        {q:"Which of these do welders help build?",o:["Bridges and ships","Only jewelry","Only paper products","Websites"],a:0,why:"Welding is used in heavy construction, shipbuilding, pipelines and more."}]},
 {title:"Stick, MIG and TIG",minutes:11,
  body:["Stick welding uses a rod coated in flux. It is tough and works well outdoors and on dirty or rusty metal.",
   "MIG welding feeds a wire through a gun automatically. It is fast and is often the easiest for beginners to learn.",
   "TIG welding is the most precise and clean. It takes more skill and is used on thin metal and materials like aluminum and stainless steel."],
  terms:[["Stick (SMAW)","Flux-coated rod; rugged and outdoor-friendly"],["MIG (GMAW)","Wire-fed; fast and beginner-friendly"],["TIG (GTAW)","Precise; for thin and specialty metals"]],
  quiz:[{q:"Which process feeds wire through a gun?",o:["Stick","MIG","TIG","None of them"],a:1,why:"MIG is wire-fed, which makes it fast."},
        {q:"Which process is the most precise and used on thin aluminum?",o:["TIG","Stick","MIG","Soldering"],a:0,why:"TIG gives welders the most control."}]},
 {title:"Safety & certification",minutes:10,
  body:["The welding arc gives off light bright enough to burn your eyes, so welders always wear a helmet with a dark or auto-darkening lens.",
   "They also wear fire-resistant clothing and heavy gloves, and they work with good ventilation to avoid breathing fumes.",
   "Welders prove their skills by passing weld tests, often through the American Welding Society (AWS). Training happens in trade schools, community colleges and many high school CTE programs."],
  terms:[["Auto-darkening helmet","Lens darkens instantly when the arc starts"],["AWS","American Welding Society"],["Weld test","A sample weld checked for strength"]],
  quiz:[{q:"Why must welders wear a helmet with a dark lens?",o:["To look cool","The arc light can burn their eyes","To keep their hair clean","It's only for photos"],a:1,why:"Arc light is intense enough to injure eyes in seconds."},
        {q:"Which organization is known for welding certifications?",o:["NBA","American Welding Society","NASA","FIFA"],a:1,why:"Many employers ask for AWS certifications."}]}
 ]},
{id:"biz",code:"BIZ 101",field:"biz",icon:"chart",title:"Start a Small Business",minutes:35,points:15,paths:["college","cert"],interests:["money"],
 blurb:"Do the profit math on your own business idea, find your customer, and pitch it in under a minute.",
 learn:["Calculate revenue, costs and profit","Describe a target customer","Write a short elevator pitch"],
 careers:["Entrepreneur","Marketing specialist","Accountant","Sales manager"],subjects:["Math","English / speech","Business or DECA club"],
 lessons:[
 {title:"Profit math",minutes:12,activity:"profit",
  body:["Revenue is all the money you take in from sales. Costs are what you spend to make and sell your product.",
   "Profit = revenue − costs. If costs are bigger than revenue, the result is negative and you have a loss.",
   "Use the calculator below to test a business idea. Change the price and watch what happens to your profit."],
  terms:[["Revenue","Money from sales"],["Costs","Money spent to run the business"],["Profit","Revenue minus costs"]],
  quiz:[{q:"You sell 20 shirts at $15 each. Your costs are $180. What is your profit?",o:["$300","$120","$180","$480"],a:1,why:"Revenue is 20 × $15 = $300. $300 − $180 = $120."},
        {q:"What is revenue?",o:["Money left after paying costs","All the money taken in from sales","Money borrowed from the bank","The price of one item"],a:1,why:"Revenue is total sales before costs are taken out."}]},
 {title:"Know your customer",minutes:11,
  body:["A target customer is the specific group most likely to buy from you. \"Everyone\" is not a target customer.",
   "Great businesses solve a real problem for that customer. Ask: who has this problem, and how do they solve it now?",
   "Marketing is how you reach those customers: posters, social media, word of mouth, or a table at a school event."],
  terms:[["Target customer","The group most likely to buy"],["Marketing","How you reach and attract customers"],["Competitor","Another business solving the same problem"]],
  tryIt:"Pick a business idea. Write one sentence for each: who is my customer, what problem do I solve, and where will they hear about me?",
  quiz:[{q:"Which is the best target customer for a dog-walking business?",o:["Everyone in the world","Busy dog owners in your neighborhood","Cat owners","People without pets"],a:1,why:"A specific group with the problem you solve is a real target customer."},
        {q:"What is marketing?",o:["Counting money","How you reach and attract customers","Making the product","Paying taxes"],a:1,why:"Marketing gets your business in front of the right people."}]},
 {title:"The pitch & careers",minutes:12,
  body:["An elevator pitch is a short speech, about 30 to 60 seconds, that explains your business: the problem, your solution, and why you.",
   "Investors, customers and partners decide fast, so a clear pitch matters.",
   "Business skills lead to many careers: entrepreneur, marketing, sales, accounting and project management. Clubs like DECA and FBLA let students compete with real pitches."],
  terms:[["Elevator pitch","A 30–60 second business summary"],["Investor","Someone who funds a business"],["Entrepreneur","Someone who starts a business"]],
  quiz:[{q:"About how long is an elevator pitch?",o:["30 to 60 seconds","10 minutes","One hour","One school day"],a:0,why:"Short enough to say during an elevator ride."},
        {q:"What should a pitch include?",o:["Only your favorite color","The problem, your solution and why you","Your full life story","Just the price"],a:1,why:"Problem, solution and why you is the core of any pitch."}]}
 ]}
];

/** Groups of courses shown together as a career path. */
export const LEARNING_PATHS: { id: string; title: string; blurb: string; field: CourseField; courses: string[] }[] = [
  { id: "trades", title: "Skilled Trades Starter", blurb: "Wire, weld and build your way into the trades.", field: "trades", courses: ["elec", "weld", "engr"] },
  { id: "create", title: "Create & Perform", blurb: "Direct a scene and produce your first beat.", field: "film", courses: ["film", "musc"] },
  { id: "future", title: "Build the Future", blurb: "Think like an engineer and code your first game.", field: "eng", courses: ["engr", "tech"] },
  { id: "care", title: "Help & Lead", blurb: "Healthcare skills plus how to run a business.", field: "health", courses: ["hlth", "biz"] },
];

/** Skills a finished course adds to the student's profile. */
export const COURSE_SKILLS: Record<string, string[]> = {
  elec: ["Circuits", "Electrical safety"], engr: ["Design process", "Prototyping"], film: ["Storyboarding", "Shot planning"],
  musc: ["Beat making", "Mixing basics"], hlth: ["Vital signs", "Patient privacy"], tech: ["Variables & loops", "Game logic"],
  weld: ["Welding safety", "MIG basics"], biz: ["Profit math", "Pitching"],
};

export const courseById = (id: string) => COURSES.find((c) => c.id === id);

/** True when every answer matches the lesson's quick check. */
export function answersCorrect(lesson: CourseLesson, answers: unknown): boolean {
  return Array.isArray(answers) && answers.length === lesson.quiz.length && lesson.quiz.every((q, i) => Number(answers[i]) === q.a);
}

/** A certificate's ID, e.g. "AC-ELEC101-4K2F9". Stable for the same student, course and day. */
export function certificateCode(userId: number, courseId: string, day: string): string {
  const course = courseById(courseId);
  let h = 2166136261;
  for (const ch of `${userId}|${courseId}|${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `AC-${(course?.code || courseId).replace(/\s+/g, "").toUpperCase()}-${h.toString(36).toUpperCase().padStart(5, "0").slice(0, 5)}`;
}
