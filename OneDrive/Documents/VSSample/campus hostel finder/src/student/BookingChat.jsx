import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { CARD } from "../ui";

export default function BookingChat() {
  const { requestId } = useParams();
  const { profile } = useAuth();
  const [request, setRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMessages = useCallback(async () => {
    const [{ data: booking, error: bookingError }, { data: rows, error: messagesError }] = await Promise.all([
      supabase.from("hostel_booking_requests")
        .select("id,student_id,landlord_id,status,hostels(house_name)")
        .eq("id", requestId)
        .maybeSingle(),
      supabase.from("hostel_booking_messages")
        .select("id,sender_id,body,created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true }),
    ]);

    if (bookingError || messagesError) {
      setNotice(bookingError?.message || messagesError?.message);
      return;
    }
    if (!booking) {
      setNotice("Booking request not found, or it is not yours to open.");
      return;
    }
    setRequest(booking);
    setMessages(rows || []);
    setNotice("");
  }, [requestId]);

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
    const { error } = await supabase.from("hostel_booking_messages").insert({
      request_id: requestId,
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

  const backTo = profile.role === "LANDLORD" ? "/landlord/dashboard" : "/student/bookings";

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 text-white">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Booking chat 💬</h1>
          <p className="text-sm text-[#D7E6D1]">{request?.hostels?.house_name || "Private room, private chat"}</p>
        </div>
        <Link to={backTo} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm">Back</Link>
      </header>
      {notice && <p role="alert" className="text-sm text-[#FFD98A]">{notice}</p>}
      <div aria-live="polite" className={`${CARD} min-h-64 space-y-2`}>
        {!messages.length && <p className="text-sm text-[#C7D2EA]">No messages yet. One polite message beats seventeen missed calls.</p>}
        {messages.map((item) => (
          <article key={item.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.sender_id === profile.id ? "ml-auto bg-[#E3B86B] text-[#28200F]" : "bg-white/15"}`}>
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
          disabled={!request || busy}
          aria-label="Message landlord or student"
          placeholder="Ask about the room, move-in, or house rules…"
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-[#C7D2E0]"
        />
        <button disabled={!request || busy || !draft.trim()} className="rounded-xl bg-[#E3B86B] px-4 py-2 text-sm font-semibold text-[#28200F] disabled:opacity-40">
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      <p className="text-xs text-[#C7D2EA]">Only the student and landlord on this booking request can read this chat.</p>
    </section>
  );
}
