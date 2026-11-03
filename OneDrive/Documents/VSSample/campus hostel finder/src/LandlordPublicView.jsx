import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useAuth, HOME } from "./AuthContext";

const tk = (n) => "৳" + Number(n || 0).toLocaleString("en-BD");

// Read-only. No edit controls are rendered here, and writes are blocked by RLS anyway.
export default function LandlordPublicView() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [h, setH] = useState(undefined);
  const [o, setO] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("hostels").select("*").eq("id", id).maybeSingle();
      setH(data || null);
      if (data) {
        const { data: l } = await supabase.from("landlord_public").select("*").eq("user_id", data.landlord_id).maybeSingle();
        setO(l);
      }
    })();
  }, [id]);

  const back = <Link to={HOME[profile.role]} className="text-sm underline">← Back</Link>;
  if (h === undefined) return <div className="herbal-bg min-h-screen p-6 text-white">Loading…</div>;
  if (!h) return <div className="herbal-bg min-h-screen p-6 text-white">{back}<p className="mt-4">Listing not found or not approved yet.</p></div>;

  return (
    <div className="herbal-bg min-h-screen p-4 text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        {back}
        {h.photos?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">{h.photos.map((p) => <img key={p} src={p} alt={h.house_name} className="h-48 rounded-xl object-cover" />)}</div>
        )}
        <section className="space-y-2 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
          <h1 className="text-xl font-bold">{h.house_name}</h1>
          <p className="text-sm text-[#C7D2EA]">{h.address}{h.property_type ? ` · ${h.property_type}` : ""}</p>
          <p>Rent <b>{tk(h.monthly_rent)}</b> · {h.vacancy_count > 0 ? `${h.vacancy_count} vacant` : "Full"}{h.total_rooms ? ` of ${h.total_rooms} rooms` : ""}</p>
          <p className="text-sm">Electricity ({h.electricity_bill_type}) {tk(h.electricity_bill)} · Water {tk(h.water_bill)} · Trash/Moyla {tk(h.trash_bill)}</p>
          {h.room_details && Object.keys(h.room_details).length > 0 && (
            <ul className="text-sm text-[#C7D2EA]">{Object.entries(h.room_details).map(([k, v]) => <li key={k}>{k}: {String(v)}</li>)}</ul>
          )}
          <a href={`https://www.google.com/maps?q=${h.lat},${h.lng}`} target="_blank" rel="noreferrer" className="inline-block rounded-lg bg-white/10 px-3 py-1.5 text-xs">Open in Maps</a>
        </section>
        {o && (
          <section className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-xl">
            <h2 className="font-semibold">Landlord</h2>
            <p className="text-sm">{o.name} · {o.contact_no || "no number listed"}</p>
            {o.bio && <p className="mt-1 text-sm text-[#C7D2EA]">{o.bio}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
