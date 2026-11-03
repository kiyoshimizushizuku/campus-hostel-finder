import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../AuthContext";
import { CARD, GHOSTBTN, tk } from "../ui";

const BADGE = { approved: "bg-green-500/30", pending: "bg-yellow-500/30", rejected: "bg-red-500/30" };

export default function LandlordDashboard() {
  const { profile } = useAuth();
  const [me, setMe] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [leads, setLeads] = useState([]);
  const [requests, setRequests] = useState([]);
  const [responding, setResponding] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [m, h, l, r] = await Promise.all([
      supabase.from("landlord_profiles").select("name,contact_no,bio,profile_pic_url").eq("user_id", profile.id).single(),
      supabase.from("hostels").select("*").eq("landlord_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("interested_students").select("*").order("created_at", { ascending: false }),
      supabase.from("landlord_booking_overview").select("*").order("created_at", { ascending: false }),
    ]);
    setMe(m.data); setHostels(h.data || []); setLeads(l.data || []); setRequests(r.data || []);
    const err = m.error || h.error || l.error || r.error;
    setMsg(err ? err.message : "");
  }, [profile.id]);
  useEffect(() => { load(); }, [load]);

  const setVac = async (h, v) => { if (v < 0) return; await supabase.from("hostels").update({ vacancy_count: v }).eq("id", h.id); load(); };
  const remove = async (h) => { if (confirm(`Delete "${h.house_name}"?`)) { await supabase.from("hostels").delete().eq("id", h.id); load(); } };
  const respond = async (request, status) => {
    setResponding(request.id);
    setMsg("");
    const { error } = await supabase.rpc("respond_to_booking_request", {
      request_id: request.id,
      next_status: status,
    });
    setResponding("");
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(status === "accepted"
      ? "Booking accepted. One room has been held for this student."
      : "Request declined. At least the suspense is over.");
    await load();
  };
  const incomplete = me && (!me.name || !me.contact_no);

  return (
    <div className="herbal-bg min-h-screen p-4 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        {msg && <p role="alert" className="text-sm text-[#FFD98A]">{msg}</p>}
        <section className={CARD + " flex items-center gap-3"}>
          {me?.profile_pic_url ? <img src={me.profile_pic_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="h-14 w-14 rounded-full bg-white/20" />}
          <div className="flex-1">
            <h1 className="font-bold">{me?.name || "Landlord"}</h1>
            <p className="text-xs text-[#C7D2EA]">{me?.contact_no || "No phone yet"}</p>
          </div>
          <Link to="/landlord/profile" className={GHOSTBTN}>Edit profile</Link>
        </section>
        {incomplete && <p className="rounded-xl bg-yellow-500/20 p-3 text-sm">Add your name and phone number first. Students contact you through them. <Link to="/landlord/profile" className="underline">Complete profile</Link></p>}

        <section className={CARD + " space-y-3"}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My listings ({hostels.length})</h2>
            <Link to="/landlord/listing/new" className="rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-xs font-semibold text-[#06222B]">+ New listing</Link>
          </div>
          {hostels.length === 0 && <p className="text-sm text-[#C7D2EA]">No listings yet.</p>}
          {hostels.map((h) => (
            <div key={h.id} className="space-y-1 rounded-xl bg-white/5 p-3">
              <div className="flex items-start justify-between">
                <b>{h.house_name}</b>
                <span className={`rounded-md px-2 py-0.5 text-xs ${BADGE[h.status]}`}>{h.status}</span>
              </div>
              <p className="text-xs text-[#C7D2EA]">{h.address} · Rent {tk(h.monthly_rent)} · Bills {tk(h.electricity_bill + h.water_bill + h.trash_bill)}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span>Vacant: {h.vacancy_count}</span>
                <button onClick={() => setVac(h, h.vacancy_count - 1)} className={GHOSTBTN} aria-label="Decrease vacancy">−</button>
                <button onClick={() => setVac(h, h.vacancy_count + 1)} className={GHOSTBTN} aria-label="Increase vacancy">+</button>
                <Link to={`/landlord/listing/${h.id}/edit`} className={GHOSTBTN}>Edit</Link>
                {h.status === "approved" && <Link to={`/hostel/${h.id}`} className={GHOSTBTN}>Public view</Link>}
                <button onClick={() => remove(h)} className={GHOSTBTN}>Delete</button>
              </div>
              {h.status === "pending" && <p className="text-xs text-[#FFD98A]">Waiting for admin approval. Students cannot see it yet.</p>}
            </div>
          ))}
        </section>

        <section className={CARD + " space-y-2"}>
          <h2 className="font-semibold">Booking requests ({requests.filter((request) => request.status === "pending").length} waiting)</h2>
          {!requests.length && <p className="text-sm text-[#C7D2EA]">No booking requests yet. The inbox is enjoying a suspiciously peaceful day.</p>}
          {requests.map((request) => (
            <article key={request.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <b>{request.student_name || "Student"} · {request.house_name}</b>
                  <p className="text-xs text-[#C7D2EA]">
                    Move-in {request.move_in_date} · {request.department || "Department not provided"}
                    {request.student_contact ? ` · ${request.student_contact}` : ""}
                  </p>
                  {request.message && <p className="mt-1 whitespace-pre-wrap text-xs">{request.message}</p>}
                </div>
                <span className="rounded-full bg-black/20 px-3 py-1 text-xs">{request.status}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/landlord/bookings/${request.id}/chat`} className={GHOSTBTN}>Message student 💬</Link>
                {request.status === "pending" && <>
                  <button disabled={responding === request.id} onClick={() => respond(request, "accepted")} className="rounded-lg bg-[#E3B86B] px-3 py-1.5 text-xs font-semibold text-[#28200F] disabled:opacity-40">
                    {responding === request.id ? "Saving…" : "Accept & reserve room"}
                  </button>
                  <button disabled={responding === request.id} onClick={() => respond(request, "declined")} className={GHOSTBTN}>Decline</button>
                </>}
              </div>
            </article>
          ))}
        </section>

        <section className={CARD + " space-y-2"}>
          <h2 className="font-semibold">Interested students ({leads.length})</h2>
          {leads.length === 0 && <p className="text-sm text-[#C7D2EA]">Nobody yet. Students appear here after tapping "I'm interested".</p>}
          {leads.map((s) => (
            <div key={s.hostel_id + s.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 p-3 text-sm">
              <div>
                <b>{s.name || "Student"}</b> {s.verified && <span className="rounded bg-[#2DD4BF] px-1.5 text-xs text-[#06222B]">Verified</span>}
                <p className="text-xs text-[#C7D2EA]">{s.department || "—"} · for {s.house_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/landlord/hostels/${s.hostel_id}/students/${s.student_id}/chat`} className={GHOSTBTN}>Message student 💬</Link>
                {s.contact_no ? <a href={`tel:${s.contact_no}`} className={GHOSTBTN}>{s.contact_no}</a> : <span className="text-xs text-[#C7D2EA]">No phone</span>}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
