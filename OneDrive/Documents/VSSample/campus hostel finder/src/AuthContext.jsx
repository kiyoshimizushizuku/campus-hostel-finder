import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { AuthContext } from "./auth";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    // Role always comes from the profiles table (RLS-protected), never from client state or user metadata.
    const load = async (s) => {
      setSession(s);
      setLoading(true);
      if (!s) { setProfile(null); setAuthError(""); setLoading(false); return; }
      const { data, error } = await supabase.from("profiles").select("id,email,role,status").eq("id", s.user.id).single();
      if (error) {
        setProfile(null);
        setAuthError(`Could not verify your account role: ${error.message}`);
        setLoading(false);
        return;
      }
      if (!data || data.status === "suspended") {
        setProfile(null);
        setAuthError(data?.status === "suspended" ? "This account is suspended." : "Your account profile is missing.");
        await supabase.auth.signOut();
      } else {
        setProfile(data);
        setAuthError("");
      }
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      } else {
        load(data.session);
      }
    });
    // Defer: awaiting supabase calls directly inside this callback can deadlock the client.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setTimeout(() => load(s), 0));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session, profile, loading, authError,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, name, role) =>
      supabase.auth.signUp({ email, password, options: { data: { name, role: role === "LANDLORD" ? "LANDLORD" : "STUDENT" } } }),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/login" }),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
