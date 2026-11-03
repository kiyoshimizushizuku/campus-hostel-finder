import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { CARD } from "../ui";
import ProfileAvatar from "../components/ProfileAvatar";
import { useActiveUsers } from "../hooks/activePresence";

const STATUS = {
  pending: "Awaiting landlord reply",
  accepted: "Accepted",
  declined: "Declined",
};

export default function StudentBookings() {
  const { profile } = useAuth();
  const activeUsers = useActiveUsers();
  const [bookings, setBookings] = useState([]);
  const [landlords, setLandlords] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("hostel_booking_requests")
      .select("id,hostel_id,landlord_id,move_in_date,message,status,created_at,hostels!inner(house_name,address)")
      .eq("student_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setBookings(data || []);
    const ids = [...new Set((data || []).map((booking) => booking.landlord_id))];
    if (ids.length) {
      const { data: owners, error: ownerError } = await supabase
        .from("landlord_public")
        .select("user_id,name,contact_no,profile_pic_url")
        .in("user_id", ids);
      if (ownerError) setMessage(ownerError.message);
      else setLandlords(Object.fromEntries((owners || []).map((owner) => [owner.user_id, owner])));
    } else {
      setLandlords({});
    }
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 text-white">
      <div>
        <h1 className="text-2xl font-bold">My booking requests 🍵</h1>
        <p className="text-sm text-[#D7E6D1]">A request is not a reservation until the landlord accepts it. Hope is lovely; confirmed rooms are lovelier.</p>
      </div>
      {message && <p role="alert" className="text-sm text-[#FFD98A]">{message}</p>}
      {loading && <p className="text-sm text-[#C7D2EA]">Checking the request ledger…</p>}
      {!loading && !bookings.length && (
        <div className={CARD}>
          <p>No booking requests yet. Your future self may appreciate getting started.</p>
          <Link to="/student/dashboard" className="mt-3 inline-block underline">Find a hostel</Link>
        </div>
      )}
      {bookings.map((booking) => {
        const hostel = booking.hostels;
        const landlord = landlords[booking.landlord_id];
        return (
          <article key={booking.id} className={`${CARD} space-y-2`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{hostel?.house_name || "Hostel listing"}</h2>
                <p className="text-xs text-[#C7D2EA]">{hostel?.address}</p>
              </div>
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs">{STATUS[booking.status] || booking.status}</span>
            </div>
            <p className="text-sm">Requested move-in: <b>{booking.move_in_date}</b></p>
            {booking.message && <p className="text-sm text-[#D7E6D1]">{booking.message}</p>}
            <div className="flex items-center gap-2 text-xs text-[#C7D2EA]">
              {landlord && (
                <ProfileAvatar
                  size="sm"
                  imageUrl={landlord.profile_pic_url}
                  name={landlord.name}
                  active={activeUsers.has(booking.landlord_id)}
                />
              )}
              <span>
                Landlord: {landlord?.name || "Your landlord"}
                {landlord?.contact_no ? ` · ${landlord.contact_no}` : ""}
              </span>
            </div>
            <Link to={`/student/bookings/${booking.id}/chat`} className="inline-flex rounded-lg bg-[#E3B86B] px-3 py-2 text-xs font-semibold text-[#28200F]">
              Message landlord 💬
            </Link>
          </article>
        );
      })}
    </section>
  );
}
