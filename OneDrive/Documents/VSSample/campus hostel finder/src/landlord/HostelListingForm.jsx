import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { uploadImage } from "../lib/upload";
import { useAuth } from "../AuthContext";
import LocationPicker from "../components/LocationPicker";
import { FIELD, CARD, BTN, GHOSTBTN } from "../ui";

const EMPTY = { house_name: "", property_type: "Mess", address: "", lat: null, lng: null, monthly_rent: "", total_rooms: "", vacancy_count: "",
  beds_per_room: "", attached_bath: false, notes: "", electricity_bill_type: "fixed", electricity_bill: "", water_bill: "", trash_bill: "", photos: [] };
const n = (x) => (x === "" || x == null ? null : Number(x));

export default function HostelListingForm() {
  const { id } = useParams();
  const { profile } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState(EMPTY);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("hostels").select("*").eq("id", id).eq("landlord_id", profile.id).maybeSingle();
      if (!data) return setMsg("Listing not found.");
      const r = data.room_details || {};
      setF({ ...EMPTY, ...data, beds_per_room: r.beds_per_room ?? "", attached_bath: !!r.attached_bath, notes: r.notes ?? "", photos: data.photos || [] });
      setReady(true);
    })();
  }, [id, profile.id]);

  if (!ready) return <div className="p-6 text-white">{msg || "Loading…"}</div>;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const v = (k) => f[k] ?? "";
  const pick = (loc) => setF((p) => ({ ...p, lat: loc.lat, lng: loc.lng }));
  const gps = () => navigator.geolocation?.getCurrentPosition((p) => pick({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setMsg("Location permission denied."));

  const addFiles = async (e) => {
    setMsg("");
    try {
      const room = 5 - f.photos.length;
      const urls = [];
      for (const file of [...e.target.files].slice(0, room)) urls.push(await uploadImage("hostel-photos", profile.id, file));
      setF((p) => ({ ...p, photos: [...p.photos, ...urls] }));
    } catch (err) { setMsg(err.message); }
  };
  const addUrl = () => {
    if (!/^https?:\/\//i.test(url) || f.photos.length >= 5) return setMsg("Enter a valid http(s) image link (max 5 photos).");
    setF((p) => ({ ...p, photos: [...p.photos, url] })); setUrl("");
  };

  const save = async (e) => {
    e.preventDefault(); setMsg("");
    if (f.lat == null) return setMsg("Click the map to pin your property location. Students find you by distance.");
    if (n(f.total_rooms) != null && n(f.vacancy_count) > n(f.total_rooms)) return setMsg("Vacancy cannot exceed total rooms.");
    setBusy(true);
    const payload = {
      house_name: f.house_name.trim(), property_type: f.property_type, address: f.address.trim(), lat: f.lat, lng: f.lng,
      monthly_rent: n(f.monthly_rent) ?? 0, total_rooms: n(f.total_rooms), vacancy_count: n(f.vacancy_count) ?? 0,
      electricity_bill_type: f.electricity_bill_type, electricity_bill: n(f.electricity_bill) ?? 0,
      water_bill: n(f.water_bill) ?? 0, trash_bill: n(f.trash_bill) ?? 0, photos: f.photos,
      room_details: { beds_per_room: n(f.beds_per_room), attached_bath: f.attached_bath, notes: f.notes },
    };
    const { error } = id
      ? await supabase.from("hostels").update({ ...payload, status: "pending" }).eq("id", id)
      : await supabase.from("hostels").insert({ ...payload, landlord_id: profile.id });
    setBusy(false);
    if (error) return setMsg(error.message);
    nav("/landlord/dashboard");
  };

  return (
    <div className="herbal-bg min-h-screen p-4 text-white">
      <form onSubmit={save} className={CARD + " mx-auto max-w-2xl space-y-3"}>
        <h1 className="text-xl font-bold">{id ? "Edit listing" : "New listing"}</h1>
        <input className={FIELD} placeholder="House / mess name" value={v("house_name")} onChange={set("house_name")} required />
        <div className="grid grid-cols-2 gap-3">
          <select className={FIELD} value={v("property_type")} onChange={set("property_type")}>
            {["Mess", "Hostel", "Sublet", "Flat"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input className={FIELD} type="number" min="0" placeholder="Monthly rent (৳)" value={v("monthly_rent")} onChange={set("monthly_rent")} required />
          <input className={FIELD} type="number" min="0" placeholder="Total rooms" value={v("total_rooms")} onChange={set("total_rooms")} />
          <input className={FIELD} type="number" min="0" placeholder="Vacant rooms" value={v("vacancy_count")} onChange={set("vacancy_count")} required />
        </div>
        <input className={FIELD} placeholder="Address / landmark (e.g. Ashulia, near DIU)" value={v("address")} onChange={set("address")} required />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Pin your property on the map {f.lat != null && "✓"}</span>
          <button type="button" onClick={gps} className={GHOSTBTN}>Use my location</button>
        </div>
        <LocationPicker value={{ lat: f.lat, lng: f.lng }} onChange={pick} height={240} />
        <div className="grid grid-cols-2 gap-3">
          <input className={FIELD} type="number" min="0" placeholder="Beds per room" value={v("beds_per_room")} onChange={set("beds_per_room")} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.attached_bath} onChange={(e) => setF((p) => ({ ...p, attached_bath: e.target.checked }))} /> Attached bathroom</label>
        </div>
        <textarea className={FIELD} rows={2} placeholder="Room notes (furniture, gas, wifi, rules…)" value={v("notes")} onChange={set("notes")} />
        <p className="text-sm font-semibold">Utility bills (৳ per month)</p>
        <div className="grid grid-cols-2 gap-3">
          <select className={FIELD} value={v("electricity_bill_type")} onChange={set("electricity_bill_type")}>
            <option value="fixed">Electricity: fixed</option><option value="meter">Electricity: by meter</option>
          </select>
          <input className={FIELD} type="number" min="0" placeholder="Electricity" value={v("electricity_bill")} onChange={set("electricity_bill")} />
          <input className={FIELD} type="number" min="0" placeholder="Water" value={v("water_bill")} onChange={set("water_bill")} />
          <input className={FIELD} type="number" min="0" placeholder="Trash / Moyla" value={v("trash_bill")} onChange={set("trash_bill")} />
        </div>
        <p className="text-sm font-semibold">Photos ({f.photos.length}/5)</p>
        <div className="flex flex-wrap gap-2">
          {f.photos.map((p) => (
            <div key={p} className="relative">
              <img src={p} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setF((s) => ({ ...s, photos: s.photos.filter((x) => x !== p) }))} className="absolute right-0 top-0 rounded-full bg-black/70 px-1.5 text-xs">×</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" multiple onChange={addFiles} className="text-xs" />
        <div className="flex gap-2">
          <input className={FIELD} placeholder="…or paste an image link" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" onClick={addUrl} className={GHOSTBTN}>Add</button>
        </div>
        {msg && <p role="alert" className="text-sm text-[#FFD98A]">{msg}</p>}
        <button disabled={busy} className={BTN}>{busy ? "Saving…" : id ? "Save changes" : "Submit for approval"}</button>
      </form>
    </div>
  );
}
