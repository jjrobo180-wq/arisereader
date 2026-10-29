// Halloread (the October theme) without any 3D code: whether it's on, and a pet's costume name.
// Pages that only need these import this file, so three.js (lib/halloread.ts) isn't in the first load.
export const HALLOREAD_ACTIVE = (() => {
  try {
    const now = new Date();
    return now.getMonth() === 9 || (now.getMonth() === 10 && now.getDate() <= 2);
  } catch {
    return false;
  }
})();

export function halloreadPetGearName(petId:string|null|undefined){
  if(!HALLOREAD_ACTIVE||!petId||petId==="pet-none")return "";
  const code=Array.from(petId).reduce((n,c)=>n+c.charCodeAt(0),0)%3;
  return code===0?"Midnight Witch Hat":code===1?"Pumpkin Charm":"Little Bat Wings";
}
