import { HALLOREAD_ACTIVE } from "@/lib/halloread";

export default function HalloreadAtmosphere({compact=false}:{compact?:boolean}){
  if(!HALLOREAD_ACTIVE)return null;
  return <div className={"halloread-atmosphere "+(compact?"halloread-compact":"")} aria-hidden="true">
    <div className="halloread-top-rope"/>
    <div className="halloread-garland">
      <span>🦇</span><span>🎃</span><span>👻</span><span>🕸️</span><span>🦇</span><span>🎃</span><span>👻</span><span>🕸️</span><span>🦇</span>
    </div>

    <div className="halloread-web halloread-web-left">🕸️</div>
    <div className="halloread-web halloread-web-right">🕸️</div>
    <div className="halloread-hanger halloread-hanger-left"><i/><span>🕷️</span></div>
    <div className="halloread-hanger halloread-hanger-right"><i/><span>👻</span></div>

    <div className="halloread-smoke halloread-smoke-a"/>
    <div className="halloread-smoke halloread-smoke-b"/>
    <div className="halloread-smoke halloread-smoke-c"/>
    <div className="halloread-ground-fog"/>

    <div className="halloread-edge halloread-edge-left"><span>🎃</span><span>🦇</span><span>🎃</span></div>
    <div className="halloread-edge halloread-edge-right"><span>👻</span><span>🕷️</span><span>🦇</span></div>

    <style>{`
      .halloread-atmosphere{position:fixed;inset:0;z-index:44;pointer-events:none;overflow:hidden;isolation:isolate}
      .halloread-top-rope{position:absolute;left:-2%;right:-2%;top:13px;height:3px;background:linear-gradient(90deg,#171018,#6b3b18,#171018);box-shadow:0 3px 8px rgba(0,0,0,.45);transform:rotate(-.25deg)}
      .halloread-garland{position:absolute;left:0;right:0;top:0;height:82px;display:flex;align-items:flex-start;justify-content:space-around;padding:8px 2vw 0;font-size:29px;opacity:.92;filter:drop-shadow(0 6px 8px rgba(0,0,0,.6));animation:halloreadSway 4.8s ease-in-out infinite alternate}
      .halloread-garland span:nth-child(2n){transform:translateY(22px) rotate(8deg)}
      .halloread-garland span:nth-child(3n){transform:translateY(8px) rotate(-10deg)}
      .halloread-garland span:nth-child(4n){transform:translateY(30px) rotate(5deg)}
      .halloread-web{position:absolute;top:-32px;font-size:118px;opacity:.72;filter:drop-shadow(0 5px 12px rgba(40,15,65,.45))}
      .halloread-web-left{left:-30px;transform:rotate(4deg)}
      .halloread-web-right{right:-30px;transform:scaleX(-1) rotate(4deg)}
      .halloread-hanger{position:absolute;top:54px;display:flex;flex-direction:column;align-items:center;opacity:.72}
      .halloread-hanger i{display:block;width:1px;height:88px;background:linear-gradient(#d8b4fe99,#ffffff22)}
      .halloread-hanger span{font-size:30px;filter:drop-shadow(0 5px 6px rgba(0,0,0,.55));animation:halloreadFloat 4.8s ease-in-out infinite}
      .halloread-hanger-left{left:3.5vw}.halloread-hanger-right{right:4vw}
      .halloread-hanger-right span{animation-delay:-2.2s}
      .halloread-smoke{position:absolute;width:78vw;height:38vh;border-radius:50%;filter:blur(42px);background:radial-gradient(ellipse at center,rgba(241,245,249,.92) 0%,rgba(196,181,253,.48) 34%,rgba(109,40,217,.18) 52%,transparent 73%);animation:halloreadSmoke 10s ease-in-out infinite alternate}
      .halloread-smoke-a{left:-28vw;bottom:-10vh;opacity:.31}
      .halloread-smoke-b{right:-26vw;bottom:-7vh;opacity:.28;animation-delay:-4.2s}
      .halloread-smoke-c{left:12vw;bottom:8vh;width:70vw;height:25vh;opacity:.15;animation-delay:-7s}
      .halloread-ground-fog{position:absolute;left:-5%;right:-5%;bottom:-28px;height:150px;background:linear-gradient(to top,rgba(235,228,255,.34),rgba(216,180,254,.14),transparent);filter:blur(14px);animation:halloreadGround 7s ease-in-out infinite alternate}
      .halloread-edge{position:absolute;top:28%;display:flex;flex-direction:column;gap:26vh;font-size:28px;opacity:.58;filter:drop-shadow(0 5px 8px rgba(0,0,0,.48))}
      .halloread-edge-left{left:7px}.halloread-edge-right{right:7px}
      .halloread-edge span:nth-child(2){font-size:22px;animation:halloreadFloat 5.5s ease-in-out infinite}
      .halloread-compact .halloread-smoke-a,.halloread-compact .halloread-smoke-b{opacity:.22}
      .halloread-compact .halloread-garland{opacity:.78}
      @keyframes halloreadSmoke{from{transform:translate3d(-6vw,2vh,0) scale(.92)}to{transform:translate3d(10vw,-6vh,0) scale(1.1)}}
      @keyframes halloreadGround{from{transform:translateX(-3%) scaleY(.88)}to{transform:translateX(3%) scaleY(1.08)}}
      @keyframes halloreadSway{from{transform:rotate(-.55deg)}to{transform:rotate(.55deg)}}
      @keyframes halloreadFloat{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(28px) rotate(9deg)}}
      @media(max-width:760px){
        .halloread-atmosphere{z-index:44}
        .halloread-garland{font-size:23px;height:72px;padding-top:7px}
        .halloread-garland span:nth-child(n+8){display:none}
        .halloread-web{font-size:92px;top:-27px}
        .halloread-edge{font-size:24px;opacity:.45}
        .halloread-hanger i{height:64px}
        .halloread-hanger span{font-size:25px}
        .halloread-smoke{filter:blur(34px)}
      }
      @media(prefers-reduced-motion:reduce){.halloread-atmosphere *{animation:none!important}}
    `}</style>
  </div>;
}
