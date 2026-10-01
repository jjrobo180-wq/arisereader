import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// A.R.I.S.E. uses its own server API/auth layer. Keep database access server-side
// so RLS and Data API grants can be locked down without changing client behavior.
const supabaseServerKey = supabaseServiceRoleKey || supabaseAnonKey;
if (supabaseServiceRoleKey) {
  console.log("[supabase] server database client: service role");
} else {
  console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY missing; using anon fallback");
}

export const supabase = createClient(supabaseUrl, supabaseServerKey, {
  realtime: {
    transport: ws,
  },
});

// Only use this server-side client for admin-only operations. Never expose its key to Vite.
export function getAdminSupabase() {
  const key = supabaseServiceRoleKey;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged database operations");
  return createClient(supabaseUrl, key);
}
