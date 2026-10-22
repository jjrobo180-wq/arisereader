// /eye-gaze-fidgets — the 3D Fidget Lab for eye-gaze players.
import { useLocation } from "wouter";
import FidgetLabGame from "@/pages/eye-gaze/FidgetLabGame";

export default function EyeGazeFidgetLab() {
  const [, navigate] = useLocation();
  return <FidgetLabGame onBack={() => navigate("/eye-gaze-games")} />;
}
