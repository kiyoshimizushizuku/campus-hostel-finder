import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../AuthContext";
import LocationPicker from "../components/LocationPicker";

const FIELD = "w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder-[#9FB0D3] [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]";
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function StudentProfileForm() {
  const { profile } = useAuth();
  const [f, setF] = useState(null);
  const [unis, setUnis] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [u, s] = await Promise.all([
        supabase.from("universities").select("id,name,short_name").order("name"),
        supabase.from("student_profiles").select("*").eq("user_id", profile.id).single(),
      ]);
      setUnis(u.data || []);
      setF(s.data || {});
    })();
  }, [profile.id]);

  if (!f) return <div className="p-6 text-white">Loading…</div>;

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const pick = (loc) => setF((p) => ({ ...p, staying_lat: loc.lat, staying_lng: loc.lng }));
  const gps = () => navigator.geolocation?.getCurrentPosition(
    (pos) => pick({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => setMsg("Location permission denied."));

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return setMsg("Image files only, max 2 MB.");
    const path = `${profile.id}/avatar-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file);
    if (error) return setMsg(error.message);
    setF((p) => ({ ...p, profile_pic_url: supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl }));
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg("");
    const c = (v) => (v === "" || v === undefined ? null : v);
    const { error } = await supabase.from("student_profiles").update({
      name: c(f.name), contact_email: c(f.contact_email), contact_no: c(f.contact_no),
      university_id: f.university_id ? Number(f.university_id) : null,
      department: c(f.department), blood_group: c(f.blood_group), guardian_name: c(f.guardian_name),
      guardian_contact: c(f.guardian_contact), emergency_info: c(f.emergency_info),
      staying_lat: f.staying_lat ?? null, staying_lng: f.staying_lng ?? null, profile_pic_url: c(f.profile_pic_url),
    }).eq("user_id", profile.id);
    setBusy(false);
    setMsg(error ? error.message : "Saved.");
  };

  return (
    <div className="herbal-bg min-h-screen p-4 text-white">
      <form onSubmit={save} className="mx-auto max-w-2xl space-y-3 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
        <h1 className="text-xl font-bold">My profile</h1>
        <div className="flex items-center gap-3">
          {f.profile_pic_url ? <img src={f.profile_pic_url} alt="Profile" className="h-16 w-16 rounded-full object-cover" /> : <div className="h-16 w-16 rounded-full bg-white/20" />}
          <input type="file" accept="image/*" onChange={upload} className="text-xs" />
        </div>
        <p className="text-xs text-[#C7D2EA]">Login email: {profile.email} (cannot be changed here)</p>
        <input className={FIELD} placeholder="Full name" value={f.name || ""} onChange={set("name")} />
        <input className={FIELD} type="email" placeholder="Gmail (contact)" value={f.contact_email || ""} onChange={set("contact_email")} />
        <input className={FIELD} placeholder="Contact number" value={f.contact_no || ""} onChange={set("contact_no")} />
        <select className={FIELD} value={f.university_id || ""} onChange={set("university_id")}>
          <option value="">Select your university</option>
          {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input className={FIELD} placeholder="Department" value={f.department || ""} onChange={set("department")} />
        <select className={FIELD} value={f.blood_group || ""} onChange={set("blood_group")}>
          <option value="">Blood group</option>
          {BLOOD.map((b) => <option key={b}>{b}</option>)}
        </select>
        <input className={FIELD} placeholder="Guardian name" value={f.guardian_name || ""} onChange={set("guardian_name")} />
        <input className={FIELD} placeholder="Guardian contact" value={f.guardian_contact || ""} onChange={set("guardian_contact")} />
        <textarea className={FIELD} rows={3} placeholder="Emergency info (allergies, medical notes…)" value={f.emergency_info || ""} onChange={set("emergency_info")} />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Where are you staying now? Click the map.</span>
          <button type="button" onClick={gps} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Use my location</button>
        </div>
        <LocationPicker value={{ lat: f.staying_lat, lng: f.staying_lng }} onChange={pick} />
        {msg && <p role="alert" className="text-sm text-[#FFD98A]">{msg}</p>}
        <button disabled={busy} className="rounded-xl bg-[#2DD4BF] px-5 py-2 text-sm font-semibold text-[#06222B] disabled:opacity-40">{busy ? "Saving…" : "Save profile"}</button>
      </form>
    </div>
  );
}
