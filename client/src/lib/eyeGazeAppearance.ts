import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE } from '@/lib/queryClient';
import { DEFAULT_EYE_GAZE_BACKGROUND, normalizeEyeGazeBackground } from '@shared/eyeGazeAppearance';
export { DEFAULT_EYE_GAZE_BACKGROUND };
export function useEyeGazeBackground() {
  const { token, user } = useAuth();
  const [background, setBackground] = useState(DEFAULT_EYE_GAZE_BACKGROUND);
  useEffect(() => {
    let active = true;
    setBackground(DEFAULT_EYE_GAZE_BACKGROUND);
    if (token) fetch(`${API_BASE}/api/eye-gaze/appearance`, {headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
      .then(r=>r.ok?r.json():null).then(data=>{if(active && data)setBackground(normalizeEyeGazeBackground(data.background));}).catch(()=>{});
    const update=(event:Event)=>setBackground(normalizeEyeGazeBackground((event as CustomEvent).detail));
    window.addEventListener('eye-gaze-appearance-updated',update);
    return ()=>{active=false;window.removeEventListener('eye-gaze-appearance-updated',update);};
  },[token,user?.id]);
  return background;
}
