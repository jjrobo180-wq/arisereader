// "Back to To Duo" chip, shown over Cooked, Cooked PT, Arise Notes and Podster when they were opened from the To Duo drawer.
import { useEffect, useState } from "react";
export function FromDuoBack() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => { try { setOn(sessionStorage.getItem("arise-from-duo") === "1"); } catch { setOn(false); } };
    read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read);
  }, []);
  if (!on) return null;
  return (
    <button type="button" data-testid="from-duo-back"
      onClick={() => { try { sessionStorage.removeItem("arise-from-duo"); } catch {} window.location.hash = "#/to-do"; }}
      style={{ position: "fixed", left: 10, bottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)", zIndex: 9999 }}
      className="rounded-full bg-[#292446] px-3.5 py-2 text-xs font-bold text-white shadow-lg">← To Duo</button>
  );
}
export default FromDuoBack;
