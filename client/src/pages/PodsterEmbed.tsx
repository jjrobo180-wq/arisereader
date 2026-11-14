// Podster inside Arise To Duo: the same Podster app (it has its own sign-in), shown full screen.
export default function PodsterEmbed() {
  return <iframe title="Podster" src="https://arisetodo.com/podster/app/" allow="autoplay; microphone; clipboard-write" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#fff" }} />;
}
