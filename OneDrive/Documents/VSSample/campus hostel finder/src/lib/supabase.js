import { createClient } from "@supabase/supabase-js";

// Only the public anon key belongs in the frontend. Never use the service_role key here.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
