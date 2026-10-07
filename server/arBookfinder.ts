import { supabase } from "./supabase";
import { isSetByAdmin, rescoreBook, supabaseBookPointsStore } from "./bookPoints";

export type ARBookMetadata = {
  quizNumber: number | null;
  bookLevel: number | null;
  wordCount: number | null;
  points: number | null;
  sourceUrl: string | null;
  status: "exact" | "formula" | "not_found" | "ambiguous" | "error";
  matchedTitle?: string;
  matchedAuthor?: string;
};

const BASE = "https://www.arbookfind.com";
const SEARCH_URL = BASE + "/default.aspx";

function decodeHtml(value:string){
  return value
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
}
function stripTags(value:string){
  return decodeHtml(value.replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim();
}
function normalize(value:string){
  return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[’‘]/g,"'").replace(/&/g," and ").replace(/[^a-zA-Z0-9]+/g," ")
    .trim().toLowerCase().replace(/\s+/g," ");
}
function authorMatch(expected:string,actual:string){
  const e=normalize(expected),a=normalize(actual);
  if(!e||!a)return false;
  if(e===a||e.includes(a)||a.includes(e))return true;
  const stop=new Set(["jr","sr","ii","iii","iv","phd","md"]);
  const tokens=(value:string)=>value.split(" ").filter(Boolean).filter(t=>!stop.has(t));
  const ep=tokens(e),ap=tokens(a);
  if(!ep.length||!ap.length)return false;
  const expectedSorted=[...ep].sort().join(" ");
  const actualSorted=[...ap].sort().join(" ");
  if(expectedSorted===actualSorted)return true;
  // Permit first-initial/full-first-name differences only when surname matches.
  const eLast=ep[ep.length-1],aLast=ap[0];
  if(eLast===aLast){
    const eFirst=ep[0]||"",aFirst=ap[ap.length-1]||"";
    if(eFirst&&aFirst&&(eFirst===aFirst||eFirst[0]===aFirst[0]))return true;
  }
  return false;
}
function titleMatch(expected:string,actual:string){
  const e=normalize(expected),a=normalize(actual);
  return !!e&&e===a;
}
function parseNumber(value:string|null|undefined){
  if(!value)return null;
  const hit=String(value).replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);
  if(!hit)return null;
  const n=Number(hit[0]);
  return Number.isFinite(n)?n:null;
}
function inputFields(html:string){
  const result:Record<string,string>={};
  const tags=html.match(/<input\b[^>]*>/gi)||[];
  for(const tag of tags){
    const name=tag.match(/\bname=["']([^"']+)["']/i)?.[1];
    if(!name||!/\btype=["']hidden["']/i.test(tag))continue;
    result[name]=decodeHtml(tag.match(/\bvalue=["']([^"']*)["']/i)?.[1]||"");
  }
  return result;
}
function extractById(html:string,id:string){
  const safe=id.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
  const re=new RegExp("<([a-z0-9]+)\\b[^>]*\\bid=[\"']"+safe+"[\"'][^>]*>([\\s\\S]*?)<\\/\\1>","i");
  const hit=html.match(re);
  return hit?stripTags(hit[2]):"";
}
function extractDetailTitle(html:string){
  const marker="ctl00_ContentPlaceHolder1_ucBookDetail_detailTable";
  const start=html.toLowerCase().indexOf(marker.toLowerCase());
  const chunk=start>=0?html.slice(start,start+9000):html;
  const strong=chunk.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i);
  return strong?stripTags(strong[1]):"";
}
function detailLinks(html:string){
  const links:string[]=[];
  const re=/href=["']([^"']*bookdetail\.aspx[^"']*)["']/gi;
  let m:RegExpExecArray|null;
  while((m=re.exec(html))){
    const url=new URL(decodeHtml(m[1]),BASE+"/").toString();
    if(!links.includes(url))links.push(url);
  }
  return links;
}
function mergeCookies(existing:string,setCookieHeaders:string[]){
  const jar=new Map<string,string>();
  for(const part of existing.split(";")){
    const trimmed=part.trim();if(!trimmed)continue;
    const eq=trimmed.indexOf("=");if(eq>0)jar.set(trimmed.slice(0,eq),trimmed.slice(eq+1));
  }
  for(const header of setCookieHeaders){
    const first=header.split(";")[0]?.trim();if(!first)continue;
    const eq=first.indexOf("=");if(eq>0)jar.set(first.slice(0,eq),first.slice(eq+1));
  }
  return [...jar.entries()].map(([k,v])=>k+"="+v).join("; ");
}
function responseSetCookies(res:Response){
  const h:any=res.headers as any;
  if(typeof h.getSetCookie==="function")return h.getSetCookie() as string[];
  const one=res.headers.get("set-cookie");
  return one?[one]:[];
}
async function fetchPage(url:string,init:RequestInit={},cookie="BFUserType=Teacher"){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(url,{
      ...init,signal:controller.signal,redirect:"follow",
      headers:{
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        "Accept":"text/html,application/xhtml+xml","Accept-Language":"en-US,en;q=0.9",
        "Cookie":cookie,...(init.headers||{}),
      },
    });
    if(!res.ok)throw new Error("AR Bookfinder HTTP "+res.status);
    const html=await res.text();
    return {html,cookie:mergeCookies(cookie,responseSetCookies(res))};
  }finally{clearTimeout(timer);}
}
async function fetchText(url:string,init:RequestInit={},cookie="BFUserType=Teacher"){
  return (await fetchPage(url,init,cookie)).html;
}
function namedControlValue(html:string,name:string){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const re=new RegExp("<(?:input|button)\\b[^>]*\\bname=[\"\']"+escaped+"[\"\'][^>]*>","i");
  const tag=html.match(re)?.[0]||"";
  return decodeHtml(tag.match(/\bvalue=["\']([^"\']*)["\']/i)?.[1]||"");
}
async function searchBookfinder(query:string){
  const initialPage=await fetchPage(SEARCH_URL);
  const initial=initialPage.html;
  const params=new URLSearchParams(inputFields(initial));
  params.set("ctl00$ContentPlaceHolder1$txtKeyWords",query);
  params.set("ctl00$clientDateDay",String(new Date().getDate()));
  params.set("ctl00$clientDateHour",String(new Date().getHours()));
  params.set("ctl00$ContentPlaceHolder1$btnDoIt",namedControlValue(initial,"ctl00$ContentPlaceHolder1$btnDoIt")||"Go");
  const result=await fetchPage(SEARCH_URL,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded","Origin":BASE,"Referer":SEARCH_URL},
    body:params.toString(),
  },initialPage.cookie);
  return detailLinks(result.html);
}
async function readDetail(url:string){
  const html=await fetchText(url);
  return {
    title:extractDetailTitle(html),
    author:extractById(html,"ctl00_ContentPlaceHolder1_ucBookDetail_lblAuthor"),
    quizNumber:parseNumber(extractById(html,"ctl00_ContentPlaceHolder1_ucBookDetail_lblQuizNumber")),
    bookLevel:parseNumber(extractById(html,"ctl00_ContentPlaceHolder1_ucBookDetail_lblBookLevel")),
    points:parseNumber(extractById(html,"ctl00_ContentPlaceHolder1_ucBookDetail_lblPoints")),
    wordCount:parseNumber(extractById(html,"ctl00_ContentPlaceHolder1_ucBookDetail_lblWordCount")),
    url,
  };
}
export function calculateARPoints(bookLevel:number,wordCount:number){
  if(!Number.isFinite(bookLevel)||!Number.isFinite(wordCount)||wordCount<=0)return null;
  return Math.round((((10+bookLevel)/10)*(wordCount/10000))*10)/10;
}
export async function lookupARBook(title:string,author:string):Promise<ARBookMetadata>{
  try{
    let links=await searchBookfinder((title+" "+author).trim());
    if(!links.length)links=await searchBookfinder(title);
    if(!links.length)return {quizNumber:null,bookLevel:null,wordCount:null,points:null,sourceUrl:null,status:"not_found"};
    const candidates:any[]=[];
    for(const url of links.slice(0,12)){
      try{
        const detail=await readDetail(url);
        if(titleMatch(title,detail.title)&&authorMatch(author,detail.author))candidates.push(detail);
      }catch{}
    }
    if(!candidates.length)return {quizNumber:null,bookLevel:null,wordCount:null,points:null,sourceUrl:null,status:"not_found"};
    const unique=new Map<string,any>();
    for(const candidate of candidates){
      const key=String(candidate.quizNumber??"")+"|"+String(candidate.points??"")+"|"+normalize(candidate.title)+"|"+normalize(candidate.author);
      unique.set(key,candidate);
    }
    const exact=[...unique.values()];
    const pointSets=new Set(exact.map(c=>String(c.quizNumber??"")+"|"+String(c.points??"")));
    if(pointSets.size>1)return {quizNumber:null,bookLevel:null,wordCount:null,points:null,sourceUrl:null,status:"ambiguous"};
    const best=exact[0];
    const formulaPoints=best.points??(best.bookLevel!=null&&best.wordCount!=null?calculateARPoints(best.bookLevel,best.wordCount):null);
    return {
      quizNumber:best.quizNumber,bookLevel:best.bookLevel,wordCount:best.wordCount,points:formulaPoints,
      sourceUrl:best.url,status:best.points!=null?"exact":formulaPoints!=null?"formula":"ambiguous",
      matchedTitle:best.title,matchedAuthor:best.author,
    };
  }catch(error){
    console.error("[AR Bookfinder lookup]",title,author,error);
    return {quizNumber:null,bookLevel:null,wordCount:null,points:null,sourceUrl:null,status:"error"};
  }
}
export async function saveARMetadata(bookId:number,metadata:ARBookMetadata){
  const update:any={
    ar_quiz_number:metadata.quizNumber,ar_book_level:metadata.bookLevel,ar_word_count:metadata.wordCount,
    ar_points:metadata.points,ar_match_status:metadata.status,ar_source_url:metadata.sourceUrl,
    ar_verified_at:new Date().toISOString(),
  };
  const store=supabaseBookPointsStore(supabase);
  // A book whose points the admin set keeps them: what Bookfinder says is saved
  // for reference (ar_points) but never becomes the book's value.
  const verified=(metadata.status==="exact"||metadata.status==="formula")&&metadata.points!=null
    &&!(await isSetByAdmin(store,bookId));
  const previousPoints=verified?await store.bookPoints(bookId):null;
  if(verified)update.points_value=metadata.points;
  const {error}=await supabase.from("books").update(update).eq("id",bookId);
  if(error)throw new Error(error.message);

  // Keep already-passed quizzes for this book in step with the newly verified AR value,
  // by the site's one rule: a student who passed holds the book's full value.
  // Only the difference is applied to users.total_points, so manual awards and bonuses stay untouched.
  if(verified)await rescoreBook(store,bookId,Number(metadata.points),previousPoints??0);
}
export async function verifyAndSaveARBook(bookId:number,title:string,author:string){
  const metadata=await lookupARBook(title,author);
  await saveARMetadata(bookId,metadata);
  return metadata;
}
export async function syncUnverifiedARBooks(options:{limit?:number;delayMs?:number}={}){
  const limit=Math.max(1,Math.min(options.limit??50,250));
  const delayMs=Math.max(350,options.delayMs??750);
  const {data,error}=await supabase.from("books").select("id,title,author,ar_match_status")
    .in("ar_match_status",["unverified","error"]).order("id",{ascending:true}).limit(limit);
  if(error)throw new Error(error.message);

  // Avoid repeating the same Bookfinder lookup for duplicate title/author rows.
  const groups=new Map<string,any[]>();
  for(const book of data||[]){
    const key=normalize(book.title)+"|"+normalize(book.author);
    const list=groups.get(key)||[];
    list.push(book);groups.set(key,list);
  }

  let matched=0,notFound=0,ambiguous=0,errors=0;
  for(const books of groups.values()){
    const first=books[0];
    const metadata=await lookupARBook(first.title,first.author);
    for(const book of books){
      await saveARMetadata(book.id,metadata);
      if(metadata.status==="exact"||metadata.status==="formula")matched++;
      else if(metadata.status==="not_found")notFound++;
      else if(metadata.status==="ambiguous")ambiguous++;
      else errors++;
    }
    await new Promise(r=>setTimeout(r,delayMs));
  }
  return {processed:(data||[]).length,uniqueLookups:groups.size,matched,notFound,ambiguous,errors};
}
