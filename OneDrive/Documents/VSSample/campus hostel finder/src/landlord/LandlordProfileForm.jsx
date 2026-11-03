import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { uploadImage } from "../lib/upload";
import { useAuth } from "../auth";
import { FIELD, CARD, BTN } from "../ui";

export default function LandlordProfileForm() {
  const { profile } = useAuth();
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("landlord_profiles").select("*").eq("user_id", profile.id).single().then(({ data }) => setF(data || {}));
  }, [profile.id]);

  if (!f) return <div className="p-6 text-white">Loading…</div>;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const pic = async (e) => {
    try { const url = await uploadImage("avatars", profile.id, e.target.files[0]); setF((p) => ({ ...p, profile_pic_url: url })); }
    catch (err) { setMsg(err.message); }
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    const c = (v) => (v === "" || v === undefined ? null : v);
    const { error } = await supabase.from("landlord_profiles")
      .update({ name: c(f.name), contact_no: c(f.contact_no), bio: c(f.bio), nid_number: c(f.nid_number), profile_pic_url: c(f.profile_pic_url) })
      .eq("user_id", profile.id);
    setBusy(false);
    setMsg(error ? error.message : "Saved. Students will see your name, phone and bio on your listings.");
  };

  return (
    <div className="herbal-bg min-h-screen p-4 text-white">
      <form onSubmit={save} className={CARD + " mx-auto max-w-xl space-y-3"}>
        <h1 className="text-xl font-bold">Landlord profile</h1>
        <div className="flex items-center gap-3">
          {f.profile_pic_url ? <img src={f.profile_pic_url} alt="Profile" className="h-16 w-16 rounded-full object-cover" /> : <div className="h-16 w-16 rounded-full bg-white/20" />}
          <input type="file" accept="image/*" onChange={pic} className="text-xs" />
        </div>
        <input className={FIELD} placeholder="Your name" value={f.name || ""} onChange={set("name")} required />
        <input className={FIELD} placeholder="Contact number (shown to students)" value={f.contact_no || ""} onChange={set("contact_no")} required />
        <textarea className={FIELD} rows={3} placeholder="Short bio / about your property" value={f.bio || ""} onChange={set("bio")} />
        <input className={FIELD} placeholder="NID number (private, never shown to students)" value={f.nid_number || ""} onChange={set("nid_number")} />
        {msg && <p role="alert" className="text-sm text-[#FFD98A]">{msg}</p>}
        <button disabled={busy} className={BTN}>{busy ? "Saving…" : "Save profile"}</button>
      </form>
    </div>
  );
}
