import json, re

P=[]
def add(title, grade, genre, body, q):
    P.append({"title":title,"grade_level":grade,"genre":genre,"word_count":len(re.findall(r"\b[\w’'-]+\b",body)),"body":body,"questions":q})
def qs(rows):
    return [{"question_text":a,"option_a":b,"option_b":c,"option_c":d,"option_d":e,"correct_answer":f,"skill_type":g} for a,b,c,d,e,f,g in rows]

add("The Rooftop Garden",3,"fiction",'''Maya lived in an apartment above a busy bakery. Every morning, the smell of warm bread floated through her window. Maya liked the smell, but she wished she had a quiet green place to sit. One Saturday, she noticed an empty corner on the roof. It held only a broken chair and three dusty pots.

Maya asked the building manager if she could clean the corner. He said yes, as long as an adult helped. Her grandfather brought a small broom. Together, they swept away leaves and filled the pots with soil. Maya planted bean seeds in one pot, basil in another, and bright yellow flowers in the last.

For many days, nothing changed. Then Maya saw a tiny green loop pushing through the soil. Soon, the roof had its own little garden. Neighbors began visiting after school. They sat in the broken chair, which Maya had painted blue. The roof was still high above the noisy street, but it no longer felt empty.''',qs([
("What did Maya wish she had?","A larger bedroom","A quiet green place","A new bicycle","A bakery job","B","comprehension"),
("Where did Maya find an empty corner?","In the basement","Behind the bakery","On the roof","At the park","C","retention"),
("What does dusty mean in the passage?","Covered with fine dirt","Wet from rain","Made of metal","Very colorful","A","vocabulary"),
("Why did Maya ask the building manager first?","She needed permission to use the roof","She wanted him to buy seeds","She did not know where the roof was","She hoped he would paint a chair","A","inference"),
("Who helped Maya sweep?","Her teacher","Her grandfather","A neighbor","The baker","B","retention"),
("Which plant did Maya put in a pot?","A rose tree","A tomato vine","Basil","A pine tree","C","retention"),
("What happened after many days?","The pots disappeared","A green sprout appeared","Maya moved away","The roof flooded","B","comprehension"),
("What can the reader infer about the neighbors?","They enjoyed the new garden","They were angry about the flowers","They never went upstairs","They wanted to remove the chair","A","inference"),
("How did Maya change the broken chair?","She painted it blue","She threw it away","She planted it in soil","She gave it to the manager","A","retention"),
("Which idea is best shown by the story?","Small changes can improve a shared place","Roofs are unsafe for plants","Bakeries should close on Saturdays","Seeds grow best without water","A","comprehension")
]))

add("A Map That Listens",4,"fiction",'''On the first day of the city scavenger hunt, Jordan was sure his team would win. He had a bright orange backpack, a pencil sharpened to a perfect point, and a digital map borrowed from his aunt. The map did more than show streets. When Jordan tapped a blue dot, it played a recorded clue.

The first clue led the team to the old train station. “Find the clock that has watched more arrivals than any person,” the map said. Jordan raced toward the biggest clock above the front doors. But his teammate Lila stopped beside a small clock inside the waiting room. Its brass face was scratched, and a plaque said it had hung there since 1912.

“The biggest thing is not always the oldest thing,” Lila said. She tapped the answer into the map. A cheerful chime sounded.

At the next stop, the map gave a clue about a fountain shaped like a fish. Jordan wanted to follow the quickest route. Lila noticed a street festival blocking that path. The team took a longer alley, where they found a mural of local athletes. The mural was not a hunt answer, but Jordan wrote it down anyway.

By afternoon, Jordan understood that a map could point toward a place, but it could not notice everything for him. His team finished second. Still, Jordan felt as if they had found more than the winning team.''',qs([
("What is unusual about Jordan's map?","It is painted on paper","It gives recorded clues","It only works at night","It belongs to the train station","B","comprehension"),
("What did Jordan first think was the answer at the station?","The brass clock","The biggest clock above the doors","The street festival","The athletes' mural","B","retention"),
("What evidence helped Lila choose the small clock?","It was painted orange","It had a plaque saying it dated to 1912","It played a cheerful chime","It was near the front doors","B","retention"),
("In the passage, plaque most nearly means","a small sign with information","a kind of map","a bright backpack","a street musician","A","vocabulary"),
("Why did the team take a longer alley?","They wanted to be last","The quickest route was blocked by a festival","The map stopped working","They were looking for food","B","comprehension"),
("What can the reader infer about Jordan at the beginning?","He feels confident about winning","He dislikes working with others","He is afraid of the city","He knows nothing about maps","A","inference"),
("Why did Jordan write down the mural?","It was the final answer","He began valuing things beyond the hunt clues","Lila told him it was required","It showed where the fountain was","B","inference"),
("Which word best describes Lila?","Observant","Careless","Silent","Impatient","A","inference"),
("What place was the second clue about?","A bakery","A fountain shaped like a fish","A school library","A bridge with flags","B","retention"),
("What is a main lesson of the story?","The fastest path is always correct","Technology can replace careful thinking","Paying attention can lead to unexpected discoveries","Winning a contest is impossible with a team","C","comprehension")
]))

add("Why Some Cities Grow Cooler",5,"nonfiction",'''On a hot summer day, sidewalks and rooftops can make a city feel warmer than nearby fields. Dark pavement absorbs sunlight, while buildings can block breezes. Scientists call this pattern the urban heat island effect. It does not mean that a city is literally an island. Instead, it means that a built-up area can become a pocket of extra warmth surrounded by cooler land.

Many cities are trying to reduce this effect. One method is planting trees along streets and in schoolyards. A tree's leaves provide shade, so less sunlight reaches pavement. Trees also release water vapor through tiny openings in their leaves. As that water changes from liquid to gas, it takes heat from the air. This process is called transpiration.

Another strategy is using light-colored roofs. A pale roof reflects more sunlight than a black one, so the building beneath it absorbs less heat. Some neighborhoods have painted roofs white or covered them with reflective materials. These changes may also lower the amount of electricity needed for air conditioning.

Cooling a city is not only about comfort. During heat waves, very high temperatures can be dangerous, especially for young children, older adults, and people who work outdoors. Parks, shade shelters, drinking fountains, and cooling centers can give residents safer places to rest. However, planners must decide where these improvements are needed most. Neighborhoods with fewer trees often have hotter streets, yet they may have less money for large projects.

No single solution fixes every block. Still, when residents, planners, and schools work together, they can make small changes that add up: a line of trees, a bright roof, a shaded bus stop, or a garden where concrete once stood.''',qs([
("What is the urban heat island effect?","A city becomes warmer than nearby land","An island forms in a city river","Cities have more rain than farms","Pavement turns into sand","A","comprehension"),
("Why can dark pavement raise city temperatures?","It absorbs sunlight","It creates water vapor","It blocks all traffic","It grows darker at night","A","comprehension"),
("What does transpiration describe in the passage?","Water vapor leaving leaves and taking heat from air","Rain collecting on rooftops","People watering street trees","Sunlight reflecting from a roof","A","vocabulary"),
("Which change would most directly make a roof absorb less heat?","Painting it a light color","Adding a taller chimney","Covering it with dark pavement","Opening more windows at night","A","retention"),
("Why might reflective roofs reduce air-conditioning use?","Buildings beneath them absorb less heat","They make trees grow faster","They create stronger breezes","They make streets wider","A","inference"),
("Which group is named as especially at risk during heat waves?","People who work outdoors","People who own bicycles","People who visit museums","People who live near rivers","A","retention"),
("What problem can make cooling projects harder in some neighborhoods?","They may have fewer resources for big projects","They always have too many trees","They cannot use light-colored roofs","They have no sidewalks","A","comprehension"),
("In the last paragraph, add up most nearly means","become less important","combine to create a larger effect","cost the same amount","appear only once","B","vocabulary"),
("Which detail best supports the idea that cooling cities affects health?","Very high temperatures can be dangerous during heat waves","Some roofs are covered with reflective materials","Mural painters use bright colors","Buildings may block breezes","A","comprehension"),
("What is the author's main purpose?","To explain ways cities can reduce heat and why it matters","To persuade readers to move to rural areas","To tell a story about one tree planter","To compare different kinds of air conditioners","A","comprehension")
]))

add("Signal From the Marsh",6,"fiction",'''The first sound was not a splash or a birdcall. It was a steady, metallic beep coming from the cattails behind the school athletic field.

Nia heard it while waiting for her brother after robotics club. The school bordered a marsh, a place most students ignored unless a soccer ball rolled into the tall grass. Nia followed the beeping along a narrow boardwalk. At the end, she found Mr. Vale, the science teacher, kneeling beside a small silver box attached to a post.

“Is that one of your robots?” Nia asked.

“Not exactly,” he said. “It is a water sensor. It sends a signal when the water level changes quickly.”

The sensor had been beeping all week. Mr. Vale explained that construction uphill had replaced an empty lot with a parking area. Rain now slid across the smooth pavement instead of soaking slowly into soil. During storms, the marsh filled faster than usual. Fast water could wash away nests hidden near the ground.

Nia looked across the reeds. She had always thought the marsh was messy: mud, mosquitoes, and grass that seemed to grow without permission. Mr. Vale handed her a clipboard. On it were water-level readings and notes about frog calls. The numbers rose sharply after every rain, while the number of frog calls had dropped.

The next day, Nia brought the data to the student council. Some students wanted to complain about the new parking area. Nia suggested a different first step: ask the town engineers whether a rain garden could be built beside it. A rain garden uses plants and loose soil to catch water before it rushes away.

The council invited Mr. Vale and an engineer to a meeting. The engineer did not promise anything. She explained that the lot had been designed to meet rules, but she agreed to examine the readings. She also asked whether students would help count frogs for the next month.

By spring, workers had dug a shallow planted basin along the edge of the lot. It was not large, and it did not make the parking area disappear. Yet after the next storm, the sensor beeped only twice instead of all afternoon. Nia stood on the boardwalk, listening to frogs call from the cattails. The marsh still looked messy. Now she knew that messy was not the same as useless.''',qs([
("What first draws Nia toward the marsh?","A soccer ball","A metallic beep","A flashing robot","A loud argument","B","retention"),
("What does the water sensor do?","It measures rapid changes in water level","It counts every bird in the marsh","It controls the school sprinklers","It sends homework assignments","A","comprehension"),
("How did the new parking area affect rainwater?","It caused rainwater to run off more quickly","It made rain stop falling","It filtered water through more soil","It turned water into ice","A","comprehension"),
("What evidence did Mr. Vale show Nia?","Water readings and notes about frog calls","Maps of soccer fields","Photos of the parking lot at night","A list of robotics projects","A","retention"),
("What does sharply mean as used to describe the rising numbers?","Slowly and slightly","Quickly and by a large amount","In a dangerous direction","At a perfect angle","B","vocabulary"),
("Why does Nia suggest talking to engineers instead of simply complaining?","She wants to seek a practical solution using evidence","She does not care about the marsh","She wants the parking lot made bigger","She thinks students cannot attend meetings","A","inference"),
("What is the purpose of a rain garden?","To catch runoff before it rushes away","To provide a new place to park cars","To make frog calls louder","To dry out the entire marsh","A","comprehension"),
("Why does the engineer's response matter?","It shows that the data may lead to further investigation","It proves the parking lot will be removed immediately","It means the sensor was broken","It prevents students from counting frogs","A","inference"),
("What changed after workers built the planted basin?","The sensor beeped much less after a storm","The marsh became a soccer field","All the frogs left the cattails","Nia stopped visiting the boardwalk","A","retention"),
("What does Nia mean by the final statement about messy and useless?","Natural places can have important functions even if they seem untidy","The marsh needs to be cleaned every day","Only neat places can protect animals","The parking lot is more useful than the marsh","A","inference")
]))

add("The Archive of Almosts",7,"fiction",'''The museum's newest exhibit occupied the smallest room in the building. It had no dinosaur skeleton, no jeweled crown, and no touch screen that made children crowd around it. Instead, it displayed unfinished things: a brass compass with no needle, a half-carved chess piece, a page of music ending in a sudden empty measure.

Mara volunteered at the museum on Saturdays, mostly because the archive room was quiet enough for homework. Her first job in the exhibit was to replace small labels when visitors smudged them against the glass. The labels told tidy stories. The compass had belonged to a shipbuilder who died before completing it. The chess piece had been found in an artist's workshop. The music page was attributed to a local composer whose other work was performed every year at the town festival.

One gray afternoon, Mara noticed that the label beneath the music page had a loose corner. As she straightened it, a folded strip of paper slipped from behind the frame. It was not old enough to belong with the exhibit; the paper was bright and the handwriting looked recent. It read: “Not unfinished. Waiting for the second voice.”

Mara showed the note to Ms. Imani, the museum curator. Ms. Imani frowned, not angrily, but as if someone had moved a familiar chair. “This was not here last month,” she said. “Please don't mention it to visitors until we know more.”

The instruction made Mara curious. In the archive catalog, she found the composer's name, Elian Rook, and a scanned letter from his sister. The letter described their childhood habit of writing songs together: Elian wrote melody, and his sister, Sora, added a lower part. When Sora left town to study medicine, they promised to finish a festival song someday. The catalog included no record that she had returned.

Mara expected the discovery to settle the matter. Instead, it complicated it. The note's ink was modern, but its message matched the letter. Someone had either uncovered a forgotten family story or invented one that fit unusually well.

At the next staff meeting, Mara proposed placing the note beside the music page with a new label: “A question from an unknown visitor.” One board member objected. Museums, he said, should present facts, not mysteries. Ms. Imani asked Mara what she thought the exhibit was already doing.

“Showing that a missing piece can still tell us something,” Mara said. “But only if we say what we know and what we don't.”

The board approved a revised label. It explained the documented letter, the undated note, and the uncertainty connecting them. Within a week, visitors began leaving their own questions on cards: Had Sora ever heard the song? Was there another page? Could musicians try adding a second voice?

On the final Saturday of the exhibit, a pair of students brought a violin and a cello. They played the surviving melody twice. The first time, the cello stayed silent. The second time, it entered gently after the empty measure. No one claimed that the music was now complete. Yet the room, once filled with objects that seemed to have failed, held a different feeling: not an ending, but an invitation to listen closely.''',qs([
("What makes the museum exhibit unusual?","It contains only interactive screens","It displays unfinished objects and works","It is located outdoors","It focuses on dinosaur fossils","B","comprehension"),
("What is Mara's first job in the exhibit?","Replacing smudged labels","Writing new music","Leading school tours","Repairing the compass needle","A","retention"),
("What does the hidden note say about the music page?","It was copied from another book","It is waiting for a second voice","It should be removed from the museum","It belongs to a different composer","B","retention"),
("In the passage, attributed most nearly means","proven to be false","said to have been created by","hidden from the public","performed for the first time by","B","vocabulary"),
("Why is Ms. Imani cautious about the note?","Its recent appearance makes its connection to the artifact uncertain","She dislikes all visitor comments","She knows Mara wrote it","The note is too damaged to read","A","inference"),
("What does Sora's letter reveal?","She and Elian had a history of writing music together","She destroyed Elian's festival song","She built the museum exhibit","She never wanted to study medicine","A","comprehension"),
("Why does Mara say the discovery complicates the matter?","The note fits the old letter, but its modern ink raises questions","The music page has too many labels","The board member has found another artifact","Sora's letter is impossible to read","A","inference"),
("What policy does Mara propose for displaying the note?","Present it with a label that explains both evidence and uncertainty","Hide it permanently in the archive","Call it proof that Sora returned","Replace the music page with the note","A","comprehension"),
("Which event best demonstrates that visitors engaged with the exhibit's uncertainty?","They leave cards asking questions about the music","They smudge all of the labels","They demand a new dinosaur room","They take the compass from its case","A","inference"),
("What is the significance of the final musical performance?","It treats the empty measure as a space for thoughtful interpretation rather than proof of failure","It proves the students found Sora's missing page","It shows that the original song was played incorrectly","It ends the need for museum labels","A","comprehension")
]))

out={"passages":P}
with open('/home/user/workspace/bookquiz/passages/comprehensive_assessment.json','w') as f:
    json.dump(out,f,ensure_ascii=False,indent=2)
print([(p['grade_level'],p['word_count'],len(p['questions'])) for p in P])
