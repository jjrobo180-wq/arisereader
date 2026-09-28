export type AvatarCharacterId =
  | "robin-hood"
  | "sherlock-holmes"
  | "king-arthur"
  | "hercules"
  | "odysseus"
  | "sinbad"
  | "alice"
  | "dracula"
  | "frankenstein"
  | "musketeer";

export type AvatarCharacterPreset = {
  id: AvatarCharacterId;
  name: string;
  subtitle: string;
  icon: string;
  morph: "male" | "female";
  skin: string;
  hair: "fade"|"curls"|"locs"|"waves"|"afro"|"braids"|"short"|"buzz";
  hairColor: string;
  eyeColor: string;
  face: "oval"|"round"|"square"|"long";
  build: "slim"|"athletic"|"broad";
  brows: "natural"|"straight"|"bold";
  costume: "forest"|"detective"|"king"|"mythic"|"voyager"|"sailor"|"wonder"|"vampire"|"monster"|"musketeer";
  palette: { top:string; bottom:string; accent:string; trim:string; boots:string };
};

export const AVATAR_CHARACTERS: AvatarCharacterPreset[] = [
  {id:"robin-hood",name:"Robin Hood",subtitle:"Forest outlaw hero",icon:"🌲",morph:"male",skin:"#d89a73",hair:"short",hairColor:"#5b3a20",eyeColor:"#355b39",face:"oval",build:"athletic",brows:"natural",costume:"forest",palette:{top:"#275d38",bottom:"#4a3d2d",accent:"#759f53",trim:"#d5c7a0",boots:"#3a2b20"}},
  {id:"sherlock-holmes",name:"Sherlock Holmes",subtitle:"Master detective",icon:"🔎",morph:"male",skin:"#e7b184",hair:"short",hairColor:"#3b2417",eyeColor:"#475569",face:"long",build:"slim",brows:"straight",costume:"detective",palette:{top:"#4b5563",bottom:"#2f3640",accent:"#8b7355",trim:"#d8d2c4",boots:"#211d1a"}},
  {id:"king-arthur",name:"King Arthur",subtitle:"Legendary king",icon:"👑",morph:"male",skin:"#e7b184",hair:"waves",hairColor:"#6b3d24",eyeColor:"#305b66",face:"square",build:"athletic",brows:"bold",costume:"king",palette:{top:"#1f3b66",bottom:"#263246",accent:"#d7b34c",trim:"#d8dde8",boots:"#2a211c"}},
  {id:"hercules",name:"Hercules",subtitle:"Mythic champion",icon:"⚡",morph:"male",skin:"#b97750",hair:"curls",hairColor:"#3b2417",eyeColor:"#3f2a1d",face:"square",build:"broad",brows:"bold",costume:"mythic",palette:{top:"#7b3f2f",bottom:"#6d5840",accent:"#c9a45c",trim:"#e7d7b0",boots:"#3f2a1d"}},
  {id:"odysseus",name:"Odysseus",subtitle:"Clever voyager",icon:"🌊",morph:"male",skin:"#b97750",hair:"waves",hairColor:"#2a1b13",eyeColor:"#355b39",face:"oval",build:"athletic",brows:"natural",costume:"voyager",palette:{top:"#455d4c",bottom:"#594a38",accent:"#8b6f47",trim:"#d8cfb4",boots:"#39291e"}},
  {id:"sinbad",name:"Sinbad",subtitle:"World explorer",icon:"🧭",morph:"male",skin:"#9b6244",hair:"curls",hairColor:"#171717",eyeColor:"#3f2a1d",face:"oval",build:"athletic",brows:"natural",costume:"sailor",palette:{top:"#284c66",bottom:"#5a4a34",accent:"#a36f3a",trim:"#e6d6b4",boots:"#31231c"}},
  {id:"alice",name:"Alice",subtitle:"Wonderland adventurer",icon:"🗝️",morph:"female",skin:"#f4c7a1",hair:"waves",hairColor:"#b5814e",eyeColor:"#305b66",face:"round",build:"slim",brows:"natural",costume:"wonder",palette:{top:"#5f8fb6",bottom:"#5f8fb6",accent:"#f7f2df",trim:"#d9ecf7",boots:"#242126"}},
  {id:"dracula",name:"Dracula",subtitle:"Dark noble",icon:"🦇",morph:"male",skin:"#d9b9a4",hair:"short",hairColor:"#111111",eyeColor:"#5b2222",face:"long",build:"slim",brows:"bold",costume:"vampire",palette:{top:"#17131e",bottom:"#151218",accent:"#701f32",trim:"#d9d2ca",boots:"#0f0d10"}},
  {id:"frankenstein",name:"Frankenstein's Monster",subtitle:"Classic creature",icon:"⚙️",morph:"male",skin:"#80936f",hair:"short",hairColor:"#111111",eyeColor:"#475569",face:"square",build:"broad",brows:"bold",costume:"monster",palette:{top:"#3c4441",bottom:"#302f2c",accent:"#6d746d",trim:"#a4a69a",boots:"#211f1d"}},
  {id:"musketeer",name:"The Musketeer",subtitle:"Bold adventurer",icon:"🎭",morph:"male",skin:"#d89a73",hair:"waves",hairColor:"#2a1b13",eyeColor:"#3f2a1d",face:"oval",build:"athletic",brows:"natural",costume:"musketeer",palette:{top:"#273f71",bottom:"#31384d",accent:"#b28a3e",trim:"#e6e1d8",boots:"#2a211b"}}
];

export const DEFAULT_AVATAR_CHARACTER: AvatarCharacterId = "robin-hood";

export function getAvatarCharacter(id:string|undefined|null){
  return AVATAR_CHARACTERS.find(character=>character.id===id) || AVATAR_CHARACTERS[0];
}
