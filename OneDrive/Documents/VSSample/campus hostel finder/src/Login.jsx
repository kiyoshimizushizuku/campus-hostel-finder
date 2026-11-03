import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, HOME } from "./auth";
import { BTN, CARD, FIELD } from "./ui";

export default function Login() {
  const { profile, authError, signIn, signUp, resetPassword } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "STUDENT" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (profile) nav(HOME[profile.role], { replace: true }); }, [profile, nav]);

  const submit = async (e) => {
    e.preventDefault(); setMsg(""); setBusy(true);
    if (mode === "signup" && (f.password.length < 8 || f.name.trim().length < 2)) { setBusy(false); return setMsg("Enter your name and a password of at least 8 characters."); }
    const { error } = mode === "login" ? await signIn(f.email, f.password) : await signUp(f.email, f.password, f.name.trim(), f.role);
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === "signup") setMsg("Account created. Check your email to verify, then log in.");
  };

  return (
    <div className="herbal-bg grid min-h-screen place-items-center p-4 text-white">
      <form onSubmit={submit} className={`${CARD} mx-auto w-full max-w-sm space-y-3 p-6`}>
        <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back, seeker 🍃" : "Join the hostel hunt 🧪"}</h1>
        {mode === "signup" && (
          <>
            <input className={FIELD} placeholder="Full name" value={f.name} onChange={set("name")} required />
            <select className={FIELD} value={f.role} onChange={set("role")}>
              <option value="STUDENT">I am a Student</option>
              <option value="LANDLORD">I am a Landlord (Bariwala)</option>
            </select>
          </>
        )}
        <input className={FIELD} type="email" placeholder="Email" value={f.email} onChange={set("email")} required />
        <input className={FIELD} type="password" placeholder="Password" value={f.password} onChange={set("password")} required />
        {(msg || authError) && <p role="alert" className="text-sm text-[#FFD98A]">{msg || authError}</p>}
        <button disabled={busy} className={`${BTN} w-full`}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}</button>
        <div className="flex justify-between text-xs text-[#C7D2EA]">
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>{mode === "login" ? "New here? Sign up" : "Have an account? Log in"}</button>
          {mode === "login" && <button type="button" onClick={async () => { if (!f.email) return setMsg("Enter your email first."); await resetPassword(f.email); setMsg("If that email exists, a reset link was sent."); }}>Forgot password?</button>}
        </div>
      </form>
    </div>
  );
}
