// /eye-gaze-farm — the 3D Farm World for eye-gaze explorers.
import { useLocation } from "wouter";
import FarmWorldGame from "@/pages/eye-gaze/FarmWorldGame";

export default function EyeGazeFarmWorld() {
  const [, navigate] = useLocation();
  return <FarmWorldGame onBack={() => navigate("/eye-gaze-games")} />;
}
