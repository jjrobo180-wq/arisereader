import { useLocation } from 'wouter';
import { Home } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
export default function QuickHome() {
  const { user } = useAuth();
  const [location,navigate]=useLocation();
  const home = user?.isAdmin ? '/admin' : user?.role === 'teacher' ? '/teacher-dashboard' : user?.role === 'parent' ? '/parent-dashboard' : user?.is_eye_gaze_user ? '/eye-gaze-home' : user ? '/library' : '/';
  if(location===home || location==='/')return null;
  return <button type="button" onClick={()=>navigate(home)} aria-label="Go Home" className="fixed right-3 z-[20000] min-h-12 rounded-full border-2 border-white bg-teal-900 text-white px-4 shadow-xl inline-flex items-center gap-2 font-black focus-visible:ring-4 focus-visible:ring-amber-300" style={{top:'calc(env(safe-area-inset-top, 0px) + 5.5rem)'}}><Home className="h-5 w-5"/>Home</button>;
}
