import { HALLOREAD_ACTIVE } from "@/lib/halloread";

export default function HalloreadAtmosphere({compact=false}:{compact?:boolean}){
  if(!HALLOREAD_ACTIVE)return null;
  return <div className={"halloread-atmosphere "+(compact?"halloread-compact":"")} aria-hidden="true">
    <div className="halloread-garland"><span>🦇</span><span>🎃</span><span>👻</span><span>🕸️</span><span>🦇</span><span>🎃</span><span>👻</span><span>🕸️</span></div>
    <div className="halloread-smoke halloread-smoke-a"/><div className="halloread-smoke halloread-smoke-b"/>
    <div className="halloread-side halloread-left">🕷️</div><div className="halloread-side halloread-right">🦇</div>
    <style>{`
      .halloread-atmosphere{position:fixed;inset:0;z-index:12;pointer-events:none;overflow:hidden}
      .halloread-garland{position:absolute;left:0;right:0;top:0;height:58px;display:flex;align-items:flex-start;justify-content:space-around;padding:5px 4vw 0;font-size:24px;opacity:.54;filter:drop-shadow(0 4px 9px rgba(0,0,0,.5));animation:halloreadSway 5.4s ease-in-out infinite alternate}
      .halloread-garland span:nth-child(2n){transform:translateY(12px) rotate(7deg)}
      .halloread-garland span:nth-child(3n){transform:translateY(4px) rotate(-8deg)}
      .halloread-smoke{position:absolute;width:70vw;height:32vh;bottom:-12vh;border-radius:50%;filter:blur(38px);opacity:.16;background:radial-gradient(ellipse at center,rgba(226,232,240,.85) 0%,rgba(167,139,250,.32) 35%,transparent 72%);animation:halloreadSmoke 11s ease-in-out infinite alternate}
      .halloread-smoke-a{left:-18vw}.halloread-smoke-b{right:-20vw;animation-delay:-5s;transform:scale(.9)}
      .halloread-side{position:absolute;top:16%;font-size:25px;opacity:.32;animation:halloreadFloat 6s ease-in-out infinite}
      .halloread-left{left:7px}.halloread-right{right:10px;animation-delay:-2.6s}
      .halloread-compact .halloread-smoke{opacity:.11;height:24vh}
      @keyframes halloreadSmoke{from{transform:translate3d(-4vw,1vh,0) scale(.92)}to{transform:translate3d(8vw,-5vh,0) scale(1.08)}}
      @keyframes halloreadSway{from{transform:rotate(-.4deg)}to{transform:rotate(.4deg)}}
      @keyframes halloreadFloat{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(34px) rotate(8deg)}}
      @media(max-width:640px){.halloread-garland{font-size:19px;height:50px;opacity:.42}.halloread-garland span:nth-child(n+7){display:none}}
      @media(prefers-reduced-motion:reduce){.halloread-atmosphere *{animation:none!important}}
    `}</style>
  </div>;
}
