// What Arise To Duo adds to a plugin's heading row (the "Move to FamilyHub" button), kept apart from SuperShell so
// To Duo's main page doesn't load the plugin frame to provide it.
import { createContext, type ReactNode } from "react";
export const SuperHeadExtra = createContext<ReactNode>(null);
