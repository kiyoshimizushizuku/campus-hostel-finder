import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "./auth";
import ProfileAvatar from "./components/ProfileAvatar";
import { useActiveUsers } from "./hooks/activePresence";
import { supabase } from "./lib/supabase";

export default function PublicProfile() {
  const { userId } = useParams();
  const { profile } = useAuth();
  const activeUsers = useActiveUsers();
  const [person, setPerson] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const roleName = person?.role === "LANDLORD" ? "Landlord" : "Student";
  const chatPath = profile.role === "LANDLORD" ? "/landlord/chat" : "/student/chat";

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data, error } = await supabase.rpc("get_public_profile", { p_user_id: userId });
      if (!active) return;
      if (error) setMessage(error.message);
      else if (!data?.length) setMessage("Profile not found or unavailable.");
      else setPerson(data[0]);
      setLoading(false);
    };

    loadProfile();
    return () => { active = false; };
  }, [userId]);

  return (
    <section className="mx-auto max-w-2xl space-y-4 px-4 text-white">
      <Link to="/inbox" className="inline-flex rounded-lg bg-white/10 px-3 py-2 text-sm">Back to Inbox</Link>
      {loading && <p className="text-sm text-[#C7D2EA]">Loading profile…</p>}
      {message && <p role="alert" className="text-sm text-[#FFD98A]">{message}</p>}
      {person && (
        <article className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-5">
          <div className="flex items-center gap-4">
            <ProfileAvatar
              imageUrl={person.profile_pic_url}
              name={person.name}
              active={activeUsers.has(person.user_id)}
            />
            <div>
              <h1 className="text-xl font-bold">{person.name || roleName}</h1>
              <p className="text-sm text-[#C7D2EA]">{roleName} · {activeUsers.has(person.user_id) ? "Online" : "Offline"}</p>
            </div>
          </div>
          {person.department && <p><span className="text-[#9FB0D3]">Department:</span> {person.department}</p>}
          {person.university_name && <p><span className="text-[#9FB0D3]">University:</span> {person.university_name}</p>}
          {person.bio && <p className="whitespace-pre-wrap">{person.bio}</p>}
          {person.contact_no && <p><span className="text-[#9FB0D3]">Contact:</span> {person.contact_no}</p>}
          {person.verified && <p className="text-sm text-[#7CF0DF]">Verified profile</p>}
          {person.user_id !== profile.id && person.role === profile.role && (
            <Link to={`${chatPath}/${person.user_id}`} className="inline-flex rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-semibold text-[#06222B]">
              Message
            </Link>
          )}
        </article>
      )}
    </section>
  );
}
