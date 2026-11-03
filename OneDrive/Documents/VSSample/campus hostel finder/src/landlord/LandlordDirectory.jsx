import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import ProfileAvatar from "../components/ProfileAvatar";
import { useActiveUsers } from "../hooks/activePresence";

export default function LandlordDirectory() {
  const { profile } = useAuth();
  const activeUsers = useActiveUsers();
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("landlord_public")
        .select("user_id,name,bio,profile_pic_url")
        .neq("user_id", profile.id)
        .order("name");
      if (!active) return;
      if (error) setMessage(error.message);
      else setLandlords(data || []);
      setLoading(false);
    };

    load();
    return () => { active = false; };
  }, [profile.id]);

  return (
    <section className="mx-auto max-w-4xl space-y-4 px-4 text-white">
      <header>
        <h1 className="text-2xl font-bold">Landlord network</h1>
        <p className="mt-1 text-sm text-[#C7D2EA]">View active landlord profiles and message other landlords.</p>
      </header>
      {message && <p role="alert" className="text-sm text-[#FFD98A]">{message}</p>}
      {loading && <p className="text-sm text-[#C7D2EA]">Loading landlords…</p>}
      {!loading && !message && landlords.length === 0 && (
        <p className="rounded-xl bg-white/10 p-4 text-sm text-[#C7D2EA]">No other active landlord profiles are listed yet.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {landlords.map((landlord) => (
          <article key={landlord.user_id} className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4">
            <ProfileAvatar
              imageUrl={landlord.profile_pic_url}
              name={landlord.name}
              active={activeUsers.has(landlord.user_id)}
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{landlord.name || "Landlord"}</h2>
              <p className="line-clamp-2 text-sm text-[#C7D2EA]">{landlord.bio || "No profile bio provided."}</p>
            </div>
            <Link to={`/landlord/chat/${landlord.user_id}`} className="shrink-0 rounded-lg bg-[#2DD4BF] px-3 py-2 text-sm font-semibold text-[#06222B]">
              Message
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
