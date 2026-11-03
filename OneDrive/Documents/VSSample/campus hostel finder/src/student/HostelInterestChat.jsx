import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { CARD } from "../ui";

export default function HostelInterestChat() {
  const { hostelId, studentId: routeStudentId } = useParams();
  const { profile } = useAuth();
  const studentId = profile.role === "STUDENT" ? profile.id : routeStudentId;
  const [hostelName, setHostelName] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatAvailable, setChatAvailable] = useState(false);

  const loadMessages = useCallback(async () => {
    const [{ data: interest, error: interestError }, { data: rows, error: messagesError }] = await Promise.all([
      supabase.from("hostel_interests")
        .select("hostel_id,student_id,hostels(house_name)")
        .eq("hostel_id", hostelId)
        .eq("student_id", studentId)
        .maybeSingle(),
      supabase.from("hostel_interest_messages")
        .select("id,sender_id,body,created_at")
        .eq("thread_hostel_id", hostelId)
        .eq("thread_student_id", studentId)
        .order("created_at", { ascending: true }),
    ]);

    if (interestError || messagesError) {
      setChatAvailable(false);
      setNotice(interestError?.message || messagesError?.message);
      return;
    }
    if (!interest) {
      setChatAvailable(false);
      setNotice("This private chat opens after the student marks interest in the listing.");
      return;
    }
    setChatAvailable(true);
    setHostelName(interest.hostels?.house_name || "Hostel");
    setMessages(rows || []);
    setNotice("");
  }, [hostelId, studentId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadMessages, 0);
    const timer = window.setInterval(loadMessages, 5000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadMessages]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase.from("hostel_interest_messages").insert({
      thread_hostel_id: hostelId,
      thread_student_id: studentId,
      sender_id: profile.id,
      body,
    });
    setBusy(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setDraft("");
    await loadMessages();
  };

  const backTo = profile.role === "LANDLORD" ? "/landlord/dashboard" : "/student/dashboard";

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 text-white">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hostel chat 💬</h1>
          <p className="text-sm text-[#D7E6D1]">{hostelName} · Private to this student and landlord</p>
        </div>
        <Link to={backTo} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm">Back</Link>
      </header>
      {notice && <p role="alert" className="text-sm text-[#FFD98A]">{notice}</p>}
      <div aria-live="polite" className={`${CARD} min-h-64 space-y-2`}>
        {!messages.length && !notice && <p className="text-sm text-[#C7D2EA]">No messages yet. One clear question saves a whole season of guessing. 🍵</p>}
        {messages.map((item) => (
          <article key={item.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.sender_id === profile.id ? "ml-auto bg-[#A8C887] text-[#182019]" : "bg-white/15"}`}>
            <p className="whitespace-pre-wrap break-words">{item.body}</p>
            <time className="mt-1 block text-right text-[10px] opacity-70" dateTime={item.created_at}>
              {new Date(item.created_at).toLocaleString()}
            </time>
          </article>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={4000}
          disabled={!chatAvailable || busy}
          aria-label="Message"
          placeholder="Ask about rent, rooms, move-in, or house rules…"
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-[#C7D2E0]"
        />
        <button disabled={!chatAvailable || busy || !draft.trim()} className="rounded-xl bg-[#A8C887] px-4 py-2 text-sm font-semibold text-[#182019] disabled:opacity-40">
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
