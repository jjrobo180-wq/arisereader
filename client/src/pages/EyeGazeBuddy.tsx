import { useAuth } from "@/context/AuthContext";
import EyeGazeProfileDashboard from "@/components/EyeGazeProfileDashboard";

export default function EyeGazeBuddy() {
  const { user } = useAuth();
  return <EyeGazeProfileDashboard displayName={user?.displayName || user?.username || "Reader"} />;
}
