import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import ProfileAvatar from "../components/ProfileAvatar";
import { useActiveUsers } from "../hooks/activePresence";
import { supabase } from "../lib/supabase";

export default function Inbox() {
  const { profile } = useAuth();
  const activeUsers = useActiveUsers();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const directoryPath = profile.role === "LANDLORD" ? "/landlord/peers" : "/student/peers";
  const personType = profile.role === "LANDLORD" ? "landlord" : "student";

  const loadInbox = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_inbox");
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("");
      setConversations(data || []);
    }
    setLoading(false);
  }, []);

  const getChatPath = (conversation) => {
    if (conversation.thread_type === "peer") {
      const base = profile.role === "LANDLORD" ? "/landlord/chat" : "/student/chat";
      return `${base}/${conversation.other_user_id}`;
    }
    if (conversation.thread_type === "booking") {
      const base = profile.role === "LANDLORD" ? "/landlord/bookings" : "/student/bookings";
      return `${base}/${conversation.thread_key}/chat`;
    }
    if (conversation.thread_type === "interest") {
      const [hostelId, studentId] = conversation.thread_key.split(":");
      return profile.role === "LANDLORD"
        ? `/landlord/hostels/${hostelId}/students/${studentId}/chat`
        : `/student/hostels/${hostelId}/chat`;
    }
    return directoryPath;
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(loadInbox, 0);
    const timer = window.setInterval(loadInbox, 10000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadInbox]);

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 text-white">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="mt-1 text-sm text-[#C7D2EA]">People you have chatted with.</p>
        </div>
        <Link to={directoryPath} className="rounded-lg bg-white/10 px-3 py-2 text-sm">
          Find {personType}s
        </Link>
      </header>
      {message && <p role="alert" className="text-sm text-[#FFD98A]">{message}</p>}
      {loading && <p className="text-sm text-[#C7D2EA]">Loading inbox…</p>}
      {!loading && !message && conversations.length === 0 && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-[#C7D2EA]">
          <p>No conversations yet.</p>
          <Link to={directoryPath} className="mt-2 inline-block text-[#7CF0DF] underline">
            Find a {personType} to message
          </Link>
        </div>
      )}
      <div className="space-y-2">
        {conversations.map((conversation) => (
          <article
            key={`${conversation.thread_type}:${conversation.thread_key}`}
            className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4"
          >
            <Link to={`/profiles/${conversation.other_user_id}`} aria-label={`View ${conversation.name || personType}'s profile`}>
              <ProfileAvatar
                imageUrl={conversation.profile_pic_url}
                name={conversation.name}
                active={activeUsers.has(conversation.other_user_id)}
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/profiles/${conversation.other_user_id}`} className="font-semibold hover:underline">
                {conversation.name || personType}
              </Link>
              <span className="ml-2 text-xs text-[#9FB0D3]">
                {conversation.other_role === "LANDLORD" ? "Landlord" : "Student"}
                {conversation.hostel_name ? ` · ${conversation.hostel_name}` : ""}
              </span>
              <p className="truncate text-sm text-[#C7D2EA]">{conversation.last_message}</p>
              <time className="text-[11px] text-[#9FB0D3]" dateTime={conversation.last_message_at}>
                {new Date(conversation.last_message_at).toLocaleString()}
              </time>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Link to={`/profiles/${conversation.other_user_id}`} className="rounded-lg bg-white/10 px-3 py-1.5 text-center text-xs">
                Profile
              </Link>
              <Link to={getChatPath(conversation)} className="rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-center text-xs font-semibold text-[#06222B]">
                Message
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
