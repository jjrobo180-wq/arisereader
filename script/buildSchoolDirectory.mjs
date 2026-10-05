// Builds server/data/usSchools.json: every US K-12 school, as one compact text
// block the server searches when someone signs up.
//
// Source: the SchoolData project (https://github.com/bxshan/SchoolData), which
// compiles the National Center for Education Statistics lists: public schools
// from the Common Core of Data, private schools from the Private School Survey.
//
//   node script/buildSchoolDirectory.mjs <path to SchoolData's schools.json> ["CCD 2024-25, PSS 2023-24"]
//
// One line per school: id <tab> name <tab> city <tab> state <tab> lowest grade <tab> highest grade
import { readFileSync, writeFileSync } from "node:fs";

const [, , input, years = "public schools 2024-25, private schools 2023-24"] = process.argv;
if (!input) { console.error("usage: node script/buildSchoolDirectory.mjs <schools.json> [years]"); process.exit(1); }

// Words that stay in capitals, and short forms that get one capital.
const UPPER = new Set("ISD USD CSD CUSD UFSD HS MS ES JHS SHS STEM STEAM PK II III IV VI VII VIII IX XI XII USA US DC NYC JROTC ROTC IB AP GED ESL DAEP JJAEP AEP ALC CTE CTC BOCES YMCA YWCA UCLA UC CSU SDA LDS KIPP IDEA PS JH TLC ABC CEC CDC ECC ECE EC NE NW SE SW".split(" "));
const SHORT = { JR: "Jr", SR: "Sr", ST: "St", MT: "Mt", FT: "Ft", DR: "Dr", CO: "Co", CTR: "Ctr", SCH: "Sch", HTS: "Hts", SPGS: "Spgs", LRN: "Lrn", CNTY: "Cnty", CMTY: "Cmty", SCHL: "Schl", PT: "Pt", MTN: "Mtn", BLVD: "Blvd", TWP: "Twp", VLG: "Vlg", CHRN: "Chrn", CHRSTN: "Chrstn", LTHRN: "Lthrn", MGNT: "Mgnt", PRT: "Prt", SPR: "Spr", HLTH: "Hlth", SCI: "Sci", TECH: "Tech", PREP: "Prep", ELEM: "Elem", ACAD: "Acad", ALT: "Alt", INTERM: "Interm", MID: "Mid", INT: "Int", PRI: "Pri", EL: "El", ED: "Ed", EDUC: "Educ", SPEC: "Spec", VOC: "Voc", DIST: "Dist", DEPT: "Dept", INST: "Inst", ASSOC: "Assoc", INC: "Inc", MONTESSORI: "Montessori" };
const SMALL = new Set("of the and at for in on de la del los las y a an to by".split(" "));

function capPart(part, first) {
  if (!part) return part;
  const up = part.toUpperCase(), bare = up.replace(/[^A-Z0-9]/g, "");
  if (!bare) return part;
  if (/\d/.test(bare)) return up.replace(/(\d)(ST|ND|RD|TH)\b/g, (_m, d, s) => d + s.toLowerCase());
  if (bare.length === 1) return up;
  if (UPPER.has(bare)) return up;
  if (SHORT[bare]) return up.replace(bare, SHORT[bare]);
  if (!first && SMALL.has(bare)) return up.toLowerCase();
  // initials with full stops ("J.F.K."), and short runs with no vowel ("BVSD"), are abbreviations
  if (/^([A-Z]\.){2,}$/.test(up)) return up;
  if (bare.length <= 5 && !/[AEIOUY]/.test(bare)) return up;
  let out = up.charAt(0) + up.slice(1).toLowerCase();
  out = out.replace(/^Mc([a-z])/, (_m, c) => "Mc" + c.toUpperCase());
  out = out.replace(/^(O|D|L)'([a-z])/, (_m, a, c) => `${a}'${c.toUpperCase()}`);
  return out;
}
/** "ABRAHAM LINCOLN HS OF THE ARTS" -> "Abraham Lincoln HS of the Arts". Names already in mixed case are left alone. */
function tidy(text) {
  let s = String(text || "").replace(/�/g, "'").replace(/[‘’]/g, "'").replace(/[\t\r\n|]/g, " ").replace(/\s+/g, " ").trim();
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase() || letters.length < 3) return s;
  let first = true;
  return s.split(" ").map((word) => {
    const done = word.split(/([-/()&,."])/).map((piece, i) => (i % 2 ? piece : capPart(piece, first))).join("");
    first = false;
    return done;
  }).join(" ");
}

const ORDER = ["PK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];
const rank = (g) => { const i = ORDER.indexOf(g); return i < 0 ? null : i; };

const all = JSON.parse(readFileSync(input, "utf8"));
const seen = new Map();
let skipped = 0;
for (const r of all) {
  const id = String(r.i || "").trim(), name = tidy(r.n), city = tidy(r.ci), state = String(r.s || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,14}$/.test(id) || name.length < 2 || !/^[A-Z]{2}$/.test(state)) { skipped++; continue; }
  const gl = ORDER.includes(r.gl) ? r.gl : "", gh = ORDER.includes(r.gh) ? r.gh : "";
  // the same name in the same town is one entry: programs that share a building are listed several times
  const key = `${name.toLowerCase()}|${city.toLowerCase()}|${state}`;
  const had = seen.get(key);
  if (!had) { seen.set(key, { id, name, city, state, gl, gh }); continue; }
  if (gl && (had.gl === "" || rank(gl) < rank(had.gl))) had.gl = gl;
  if (gh && (had.gh === "" || rank(gh) > rank(had.gh))) had.gh = gh;
}
const rows = [...seen.values()].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name) || a.city.localeCompare(b.city));
const text = rows.map((r) => [r.id, r.name, r.city, r.state, r.gl, r.gh].join("\t")).join("\n");
const out = {
  source: "National Center for Education Statistics (Common Core of Data and Private School Survey), compiled by the SchoolData project, https://github.com/bxshan/SchoolData",
  license: "CC BY-SA 4.0. Changes: reduced to name, city, state and grade span; names in capitals re-cased; repeated entries merged.",
  years,
  count: rows.length,
  rows: text,
};
writeFileSync(new URL("../server/data/usSchools.json", import.meta.url), JSON.stringify(out));
const priv = rows.filter((r) => !/^\d{12}$/.test(r.id)).length;
console.log(`${rows.length} schools (${rows.length - priv} public, ${priv} private), ${skipped} skipped, ${(text.length / 1e6).toFixed(1)} MB`);
