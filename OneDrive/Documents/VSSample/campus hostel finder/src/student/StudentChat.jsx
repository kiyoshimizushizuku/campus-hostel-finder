import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { supabase } from "../lib/supabase";

export default function StudentChat() {
  const { userId } = useParams();
  const { profile } = useAuth();
  const [conversationId, setConversationId] = useState(null);
  const [recipient, setRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadMessages = useCallback(async (id) => {
    const { data, error } = await supabase
      .from("direct_messages")
      .select("id,sender_id,body,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (error) setMessage(error.message);
    else setMessages(data || []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId || userId === profile.id) {
        setMessage("Choose another student's profile to start a conversation.");
        return;
      }
      const [{ data: person, error: personError }, { data: conversation, error: conversationError }] = await Promise.all([
        supabase.from("student_public").select("user_id,name").eq("user_id", userId).maybeSingle(),
        supabase.rpc("get_or_create_conversation", { other_user_id: userId }),
      ]);
      if (!active) return;
      if (personError || conversationError) {
        setMessage(personError?.message || conversationError?.message);
        return;
      }
      if (!person) {
        setMessage("Student profile not found.");
        return;
      }
      const id = typeof conversation === "string" ? conversation : conversation?.id;
      if (!id) {
        setMessage("Could not start this conversation.");
        return;
      }
      setRecipient(person);
      setConversationId(id);
      await loadMessages(id);
    })();
    return () => { active = false; };
  }, [userId, profile.id, loadMessages]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      body,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDraft("");
    await loadMessages(conversationId);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4 px-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Student chat</h1>
          {recipient && <p className="text-sm text-[#C7D2EA]">Conversation with {recipient.name || "Student"}</p>}
        </div>
        <Link to="/student/peers" className="rounded-lg bg-white/10 px-3 py-2 text-sm">Student network</Link>
      </div>
      <div aria-live="polite" className="min-h-64 space-y-2 rounded-2xl border border-white/20 bg-white/5 p-4">
        {messages.length === 0 && <p className="text-sm text-[#C7D2EA]">No messages yet. Start the conversation.</p>}
        {messages.map((item) => (
          <div key={item.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.sender_id === profile.id ? "ml-auto bg-[#2DD4BF] text-[#06222B]" : "bg-white/15"}`}>
            <p className="whitespace-pre-wrap break-words">{item.body}</p>
            <time className="mt-1 block text-right text-[10px] opacity-70" dateTime={item.created_at}>
              {new Date(item.created_at).toLocaleString()}
            </time>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={4000}
          placeholder="Write a message"
          aria-label="Message"
          disabled={!conversationId || busy}
        />
        <button disabled={!conversationId || busy || !draft.trim()} className="rounded-xl bg-[#2DD4BF] px-4 py-2 text-sm font-semibold text-[#06222B] disabled:opacity-40">
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      {message && <p role="alert" className="text-sm text-[#FFD98A]">{message}</p>}
      <p className="text-xs text-[#9FB0D3]">Messages are private to the two students in this conversation.</p>
    </section>
  );
}
