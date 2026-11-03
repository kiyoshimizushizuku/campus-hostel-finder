import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth";
import LocationPicker from "../components/LocationPicker";
import { FIELD } from "../ui";
import ProfileAvatar from "../components/ProfileAvatar";
import { useActiveUsers } from "../hooks/activePresence";

const tk = (n) => "৳" + Number(n || 0).toLocaleString("en-BD");
const localToday = new Date();
localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
const MIN_BOOKING_DATE = localToday.toISOString().slice(0, 10);

export default function HostelSearchAndFilter() {
  const { profile } = useAuth();
  const activeUsers = useActiveUsers();
  const [unis, setUnis] = useState([]);
  const [uni, setUni] = useState("");
  const [targetPoint, setTargetPoint] = useState(null);
  const [radius, setRadius] = useState(5);
  const [maxRent, setMaxRent] = useState("");
  const [onlyVacant, setOnlyVacant] = useState(true);
  const [sort, setSort] = useState("distance");
  const [rows, setRows] = useState([]);
  const [owners, setOwners] = useState({});
  const [interestStatuses, setInterestStatuses] = useState({});
  const [interestSubmitting, setInterestSubmitting] = useState(new Set());
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingHostel, setBookingHostel] = useState(null);
  const [moveInDate, setMoveInDate] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [u, s] = await Promise.all([
        supabase.from("universities").select("id,name").order("name"),
        supabase.from("student_profiles").select("target_university_id,university_id,target_lat,target_lng").eq("user_id", profile.id).single(),
      ]);
      setUnis(u.data || []);
      if (s.error) {
        setMsg(s.error.message);
        return;
      }
      if (s.data?.target_lat != null && s.data?.target_lng != null) {
        setTargetPoint({ lat: s.data.target_lat, lng: s.data.target_lng });
      }
      const start = s.data?.target_university_id || s.data?.university_id;
      if (start) setUni(String(start));
    })();
  }, [profile.id]);

  useEffect(() => {
    if (!uni && !targetPoint) {
      return;
    }
    (async () => {
      setLoading(true); setMsg("");
      const { data, error } = targetPoint
        ? await supabase.rpc("hostels_near_location", {
          target_lat: targetPoint.lat,
          target_lng: targetPoint.lng,
          radius_km: radius,
        })
        : await supabase.rpc("hostels_near_university", { uni_id: Number(uni), radius_km: radius });
      if (error) { setMsg(error.message); setLoading(false); return; }
      setRows(data || []);
      const ids = [...new Set((data || []).map((r) => r.landlord_id))];
      if (ids.length) {
        const { data: l, error: ownerError } = await supabase.from("landlord_public").select("*").in("user_id", ids);
        if (ownerError) {
          setMsg(ownerError.message);
          setLoading(false);
          return;
        }
        setOwners(Object.fromEntries((l || []).map((x) => [x.user_id, x])));
      } else {
        setOwners({});
      }
      setLoading(false);
    })();
  }, [uni, targetPoint, radius]);

  useEffect(() => {
    const ids = rows.map((row) => row.id);
    if (!ids.length) {
      return;
    }
    supabase.from("hostel_interests").select("hostel_id,status")
      .eq("student_id", profile.id)
      .in("hostel_id", ids)
      .then(({ data, error }) => {
        if (error) setMsg(error.message);
        else setInterestStatuses(Object.fromEntries(
          (data || []).map((interestRow) => [interestRow.hostel_id, interestRow.status || "pending"]),
        ));
      });
  }, [rows, profile.id]);

  const changeUni = async (v) => {
    setUni(v);
    setTargetPoint(null);
    const { error } = await supabase.from("student_profiles").update({
      target_university_id: v ? Number(v) : null,
      target_lat: null,
      target_lng: null,
    }).eq("user_id", profile.id);
    if (error) setMsg(error.message);
  };

  const pickTargetPoint = async (point) => {
    setTargetPoint(point);
    setUni("");
    const { error } = await supabase.from("student_profiles").update({
      target_university_id: null,
      target_lat: point.lat,
      target_lng: point.lng,
    }).eq("user_id", profile.id);
    if (error) setMsg(error.message);
  };

  const interest = async (id) => {
    setInterestSubmitting((current) => new Set(current).add(id));
    const { data: status, error } = await supabase.rpc("request_hostel_interest", {
      p_hostel_id: id,
    });
    setInterestSubmitting((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setInterestStatuses((current) => ({ ...current, [id]: status }));
    setMsg(status === "pending"
      ? "Interest sent. You can now message the landlord about this place."
      : "This landlord has already responded to your interest.");
  };

  const book = async (event) => {
    event.preventDefault();
    if (!bookingHostel || !moveInDate || bookingBusy) return;
    setBookingBusy(true);
    setMsg("");
    const { error } = await supabase.from("hostel_booking_requests").insert({
      hostel_id: bookingHostel.id,
      student_id: profile.id,
      landlord_id: bookingHostel.landlord_id,
      move_in_date: moveInDate,
      message: bookingNote.trim(),
    });
    setBookingBusy(false);
    if (error) {
      setMsg(error.code === "23505"
        ? "You already have a request for this place. Check My bookings before sending a sequel."
        : error.message);
      return;
    }
    setBookingHostel(null);
    setMoveInDate("");
    setBookingNote("");
    setMsg("Booking request sent. It is not confirmed until the landlord accepts it.");
  };

  const list = useMemo(() => {
    if (!uni && !targetPoint) return [];
    let r = rows.filter((h) => (!onlyVacant || h.vacancy_count > 0) && (!maxRent || h.monthly_rent <= Number(maxRent)));
    return [...r].sort((a, b) => (sort === "rent" ? a.monthly_rent - b.monthly_rent : a.distance_km - b.distance_km));
  }, [uni, targetPoint, rows, onlyVacant, maxRent, sort]);

  return (
    <div className="herbal-bg min-h-screen p-4 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#D7E6D1]">Find a place before your semester finds you. 🍃</p>
          <Link to="/student/bookings" className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm">My bookings</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
          <select className={FIELD} value={uni} onChange={(e) => changeUni(e.target.value)} aria-label="Target university">
            <option value="">Select target university</option>
            {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <label className="text-xs">Within {radius} km
            <input type="range" min="1" max="20" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="ml-2 align-middle" />
          </label>
          <input className={FIELD + " w-32"} type="number" min="0" placeholder="Max rent" value={maxRent} onChange={(e) => setMaxRent(e.target.value)} />
          <label className="text-xs"><input type="checkbox" checked={onlyVacant} onChange={(e) => setOnlyVacant(e.target.checked)} /> Vacant only</label>
          <select className={FIELD} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="distance">Nearest first</option>
            <option value="rent">Lowest rent</option>
          </select>
        </div>
        <section className="space-y-2 rounded-2xl border border-white/20 bg-white/10 p-4">
          <div>
            <h2 className="font-semibold">Or pin any university location in Bangladesh</h2>
            <p className="text-xs text-[#C7D2EA]">Click the map to search around a location, even if the university is not in the directory yet.</p>
          </div>
          <LocationPicker value={targetPoint} onChange={pickTargetPoint} height={240} />
          {targetPoint && <button type="button" onClick={() => changeUni("")} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Clear map pin</button>}
        </section>
        {msg && <p role="alert" className="text-sm text-[#FFD98A]">{msg}</p>}
        {!uni && !targetPoint && <p className="text-sm text-[#C7D2EA]">Select a university or pin its location to see nearby hostels.</p>}
        {(uni || targetPoint) && !loading && list.length === 0 && <p className="text-sm text-[#C7D2EA]">No approved hostels match. Try a bigger radius.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((h) => {
            const o = owners[h.landlord_id];
            return (
              <article key={h.id} className="space-y-2 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{h.house_name}</h3>
                  <span className="rounded-md bg-[#2DD4BF] px-2 py-0.5 text-xs font-semibold text-[#06222B]">{h.distance_km.toFixed(1)} km</span>
                </div>
                <p className="text-xs text-[#C7D2EA]">{h.address}</p>
                <p className="text-sm">Rent <b>{tk(h.monthly_rent)}</b> · {h.vacancy_count > 0 ? `${h.vacancy_count} vacant` : "Full"}</p>
                <p className="text-xs text-[#C7D2EA]">Electricity {tk(h.electricity_bill)} · Water {tk(h.water_bill)} · Trash/Moyla {tk(h.trash_bill)}</p>
                <p className="text-xs">Est. monthly total: <b>{tk(h.monthly_rent + h.electricity_bill + h.water_bill + h.trash_bill)}</b></p>
                {o && (
                  <div className="flex items-center gap-2 text-xs">
                    <ProfileAvatar
                      size="sm"
                      imageUrl={o.profile_pic_url}
                      name={o.name}
                      active={activeUsers.has(h.landlord_id)}
                    />
                    <span>Landlord: {o.name} · {o.contact_no || "no number"}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  <Link to={`/hostel/${h.id}`} className="rounded-lg bg-[#2DD4BF] px-3 py-1.5 font-semibold text-[#06222B]">View details</Link>
                  <a href={`https://www.google.com/maps?q=${h.lat},${h.lng}`} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5">Open in Maps</a>
                  <button onClick={() => { setBookingHostel(h); setMoveInDate(""); setBookingNote(""); }} disabled={h.vacancy_count < 1} className="rounded-lg bg-[#E3B86B] px-3 py-1.5 font-semibold text-[#28200F] disabled:opacity-40">
                    Request to book
                  </button>
                  {interestStatuses[h.id] && interestStatuses[h.id] !== "declined" ? (
                    <>
                      <span className="rounded-lg bg-white/10 px-3 py-1.5 capitalize">
                        Interest {interestStatuses[h.id]}
                      </span>
                      <Link to={`/student/hostels/${h.id}/chat`} className="rounded-lg border border-[#A8C887]/30 bg-[#A8C887]/15 px-3 py-1.5 text-[#E4F0D8]">Message landlord 💬</Link>
                    </>
                  ) : (
                    <button
                      disabled={interestSubmitting.has(h.id)}
                      onClick={() => interest(h.id)}
                      className="rounded-lg bg-white/10 px-3 py-1.5 disabled:opacity-40"
                    >
                      {interestSubmitting.has(h.id)
                        ? "Sending…"
                        : interestStatuses[h.id] === "declined" ? "Apply again" : "I’m interested"}
                    </button>
                  )}
                </div>
                {bookingHostel?.id === h.id && (
                  <form onSubmit={book} className="space-y-2 rounded-xl border border-[#E3B86B]/30 bg-black/20 p-3">
                    <label className="block text-xs text-[#D7E6D1]">
                      Requested move-in date
                      <input
                        type="date"
                        required
                        min={MIN_BOOKING_DATE}
                        value={moveInDate}
                        onChange={(event) => setMoveInDate(event.target.value)}
                        className={FIELD + " mt-1 block w-full"}
                      />
                    </label>
                    <textarea
                      value={bookingNote}
                      onChange={(event) => setBookingNote(event.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder="A short note for the landlord (optional)"
                      className={FIELD + " w-full"}
                    />
                    <div className="flex gap-2">
                      <button disabled={bookingBusy} className="rounded-lg bg-[#E3B86B] px-3 py-1.5 text-xs font-semibold text-[#28200F] disabled:opacity-40">
                        {bookingBusy ? "Sending request…" : "Send booking request"}
                      </button>
                      <button type="button" onClick={() => setBookingHostel(null)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Cancel</button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
