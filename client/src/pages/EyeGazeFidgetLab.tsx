// /eye-gaze-fidgets — the 3D Fidget Lab for eye-gaze players.
import { useLocation } from "wouter";
import { isEyeGazerApp } from "@/lib/nativeApp";
import FidgetLabGame from "@/pages/eye-gaze/FidgetLabGame";

export default function EyeGazeFidgetLab() {
  const [, navigate] = useLocation();
  return <FidgetLabGame onBack={() => navigate(isEyeGazerApp() ? "/eye-gaze-apps" : "/eye-gaze-games")} />;
}
