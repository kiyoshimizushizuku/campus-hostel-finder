import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Helpers ---------- */
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const fmt = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const taka = (n) => "৳" + n.toLocaleString("en-US");
const T0 = iso(new Date());

/* ---------- Mock data (all names, phones and coordinates are placeholders) ---------- */
const R = (id, who, rating, text) => ({ id, who, rating, text });
const SEED_HOSTELS = [
  { id: 1, name: "Shanti Nibash Boys Hostel", area: "Ashulia", rent: 4500, seats: 6, distance: 0.6, phone: "01700-000101", lat: 23.8897, lng: 90.3153, isOpen: true, views: 128,
    reviews: [R("a1", "Rafi, CSE", 5, "Wi-Fi is steady and the owner fixed our water issue in a day."), R("a2", "Tamim, BBA", 4, "Meals are average but the rent is hard to beat this close to campus.")] },
  { id: 2, name: "Green View Mess & Hostel", area: "Birulia", rent: 3500, seats: 2, distance: 1.8, phone: "01700-000102", lat: 23.8832, lng: 90.3497, isOpen: true, views: 76,
    reviews: [R("b1", "Sajid, EEE", 4, "Cheapest around here. Bathrooms are shared between eight people."), R("b2", "Nayeem, Law", 4, "Road gets muddy in monsoon, otherwise quiet and safe at night.")] },
  { id: 3, name: "Campus Corner Residence", area: "Ashulia", rent: 6500, seats: 0, distance: 0.3, phone: "01700-000103", lat: 23.8921, lng: 90.3128, isOpen: true, views: 203,
    reviews: [R("c1", "Mahin, Textile", 5, "Generator backup and CCTV at the gate. Always full by February."), R("c2", "Arif, Pharmacy", 5, "Pricey, but you can walk to class in five minutes.")] },
  { id: 4, name: "Noor Ladies Hostel", area: "Savar", rent: 5500, seats: 4, distance: 2.4, phone: "01700-000104", lat: 23.8583, lng: 90.2667, isOpen: true, views: 91,
    reviews: [R("d1", "Mim, English", 5, "Female warden stays on site and visitors are logged at the door."), R("d2", "Sumaiya, CSE", 4, "Rickshaw to campus is 30 taka. Food is homely and clean.")] },
  { id: 5, name: "Metro Heights Hostel", area: "Mirpur", rent: 8500, seats: 9, distance: 4.6, phone: "01700-000105", lat: 23.8069, lng: 90.3685, isOpen: false, views: 54,
    reviews: [R("e1", "Fahim, Business", 4, "Rooms are modern, but the commute takes 40 minutes in traffic."), R("e2", "Toufiq, Civil", 4, "Lift and AC lounge are real. Advance deposit was clearly written down.")] },
  { id: 6, name: "Sabuj Chhaya Hostel", area: "Birulia", rent: 4000, seats: 3, distance: 1.2, phone: "01700-000106", lat: 23.8861, lng: 90.3412, isOpen: true, views: 62,
    reviews: [R("f1", "Anik, CSE", 2, "Owner kept raising the rent mid-semester. Get the terms in writing."), R("f2", "Rony, Marketing", 4, "Location is good. Mosquitoes and slow repairs are the downside.")] },
];

const SEED_BOOKINGS = [
  { id: "s1", hostelId: 1, name: "Tamim Hasan", phone: "01711-100001", moveIn: addDays(T0, -20), until: addDays(T0, 70), status: "accepted" },
  { id: "s2", hostelId: 1, name: "Nayeem Islam", phone: "01811-100002", moveIn: addDays(T0, -10), until: addDays(T0, 80), status: "accepted" },
  { id: "s3", hostelId: 1, name: "Arif Hossain", phone: "01911-100003", moveIn: addDays(T0, 5), until: addDays(T0, 95), status: "pending" },
  { id: "s4", hostelId: 1, name: "Sajid Rahman", phone: "01611-100004", moveIn: addDays(T0, -3), until: addDays(T0, 87), status: "pending" },
  { id: "s5", hostelId: 1, name: "Mahin Khan", phone: "01511-100005", moveIn: addDays(T0, 2), until: addDays(T0, 92), status: "cancelled" },
  { id: "s6", hostelId: 2, name: "Rony Das", phone: "01711-100006", moveIn: addDays(T0, 8), until: addDays(T0, 98), status: "pending" },
  { id: "s7", hostelId: 4, name: "Mim Akter", phone: "01811-100007", moveIn: addDays(T0, -15), until: addDays(T0, 75), status: "accepted" },
];

const REPORT_TYPES = ["Advance payment scam", "Rent changed after moving in", "Photos did not match the room", "Unsafe or unhygienic conditions", "Harassment or threats", "Something else"];
const SEED_REPORTS = [
  { id: "r1", hostel: "Sabuj Chhaya Hostel", type: "Rent changed after moving in", text: "Agreed on 4,000 taka, asked for 4,800 after the first month with no notice.", when: "3 days ago", resolved: false },
  { id: "r2", hostel: "Other / not listed", type: "Advance payment scam", text: "A man on Facebook asked for 5,000 taka bKash to “hold a seat”, then blocked me.", when: "1 week ago", resolved: false },
  { id: "r3", hostel: "Green View Mess & Hostel", type: "Unsafe or unhygienic conditions", text: "Bathroom drain was blocked for two weeks before anyone came.", when: "2 weeks ago", resolved: true },
];
const SORTS = [{ v: "rating", label: "Best rated" }, { v: "rent", label: "Rent: low to high" }, { v: "distance", label: "Nearest to campus" }, { v: "seats", label: "Most open seats" }];
const ROLES = [{ v: "student", label: "Student Portal" }, { v: "landlord", label: "Landlord (Bariwala) Portal" }, { v: "admin", label: "Admin Dashboard" }];
const WINDOWS = "110101011011101110110101011011";

const GLASS = "bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_24px_rgba(45,212,191,0.12),0_8px_32px_rgba(3,10,30,0.35)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]";
const FIELD = `w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder-[#9FB0D3] [color-scheme:dark] ${FOCUS}`;
const BTN = `rounded-xl px-4 py-2 text-sm font-semibold ${FOCUS} disabled:cursor-not-allowed disabled:opacity-40`;
const TEAL = `${BTN} bg-[#2DD4BF] text-[#06222B]`;
const AMBER = `${BTN} bg-[#F5B544] text-[#2A1B00]`;
const GHOST = `${BTN} border border-white/25 text-white`;
const BADGE = { pending: "bg-[#F5B544]/20 text-[#FFD98A]", accepted: "bg-[#2DD4BF]/20 text-[#7CF0DF]", declined: "bg-rose-400/20 text-rose-200", cancelled: "bg-rose-400/20 text-rose-200", expired: "bg-slate-400/20 text-slate-200" };

/* ---------- Small pieces ---------- */
function Stars({ value, count }) {
  const full = Math.round(value);
  if (!count) return <span className="text-sm text-[#C7D2EA]">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Rated ${value.toFixed(1)} out of 5 from ${count} reviews`}>
      <span aria-hidden="true" className="text-[#F5B544]">{"★".repeat(full)}<span className="text-white/25">{"★".repeat(5 - full)}</span></span>
      <span className="text-sm font-semibold">{value.toFixed(1)}</span>
      <span className="text-sm text-[#C7D2EA]">({count})</span>
    </span>
  );
}

const Pill = ({ tone, children }) => <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{children}</span>;
const Stat = ({ label, value, hint }) => (
  <div className={`${GLASS} rounded-2xl p-5`}>
    <p className="text-sm text-[#C7D2EA]">{label}</p>
    <p className="hf-display mt-1 text-3xl font-bold">{value}</p>
    {hint && <p className="mt-1 text-xs text-[#9FB0D3]">{hint}</p>}
  </div>
);

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#050B1E]/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`${GLASS} max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border-[#2DD4BF]/40 bg-[#0E1A3A]/70 p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="hf-display text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`rounded-lg px-2 text-xl leading-none ${FOCUS}`}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BookingModal({ hostel, me, today, onClose, onSubmit }) {
  const [f, setF] = useState({ name: me.name, phone: me.phone, moveIn: addDays(today, 7), months: 3 });
  const [err, setErr] = useState("");
  const go = (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr("Enter your full name.");
    if (f.phone.replace(/\D/g, "").length < 10) return setErr("Enter a phone number with at least 10 digits.");
    if (!f.moveIn || f.moveIn < today) return setErr("Move-in date must be today or later.");
    onSubmit({ ...f, name: f.name.trim(), months: +f.months });
  };
  return (
    <Modal title={`Book ${hostel.name}`} onClose={onClose}>
      <form onSubmit={go} className="space-y-3" noValidate>
        <p className="text-sm text-[#C7D2EA]">{taka(hostel.rent)} per month. The landlord will accept or decline your request.</p>
        <label className="block text-sm">Full name<input className={`${FIELD} mt-1`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="block text-sm">Phone<input className={`${FIELD} mt-1`} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Move-in date<input type="date" min={today} className={`${FIELD} mt-1`} value={f.moveIn} onChange={(e) => setF({ ...f, moveIn: e.target.value })} /></label>
          <label className="block text-sm">Stay length
            <select className={`${FIELD} mt-1`} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })}>
              {[1, 3, 6, 12].map((m) => <option key={m} value={m} className="text-slate-900">{m} {m === 1 ? "month" : "months"}</option>)}
            </select>
          </label>
        </div>
        <p role="alert" className="min-h-5 text-sm text-rose-300">{err}</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={GHOST}>Not now</button><button type="submit" className={TEAL}>Send booking request</button></div>
      </form>
    </Modal>
  );
}

function ReviewForm({ onSubmit }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const go = (e) => {
    e.preventDefault();
    if (!rating) return setErr("Pick a star rating from 1 to 5.");
    if (text.trim().length < 10) return setErr("Write at least 10 characters.");
    onSubmit(rating, text.trim()); setRating(0); setText(""); setErr("");
  };
  return (
    <form onSubmit={go} className="mt-3 space-y-2 rounded-xl bg-white/5 p-3" noValidate>
      <p className="text-sm font-semibold">Add your review</p>
      <div role="radiogroup" aria-label="Star rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}
            className={`rounded text-2xl leading-none ${FOCUS} ${n <= rating ? "text-[#F5B544]" : "text-white/25"}`}>★</button>
        ))}
      </div>
      <textarea rows="2" value={text} onChange={(e) => setText(e.target.value)} placeholder="What was it really like to live here?" className={FIELD} aria-label="Written review" />
      <p role="alert" className="min-h-4 text-xs text-rose-300">{err}</p>
      <button type="submit" className={TEAL}>Submit review</button>
    </form>
  );
}

function HostelCard({ h, mine, onView, onBook, onCancel, onReview }) {
  const [open, setOpen] = useState(false);
  const blocked = !h.isOpen ? "Closed" : h.avail === 0 ? "Full" : "";
  const toggle = () => { if (!open) onView(h.id); setOpen(!open); };
  return (
    <article className={`${GLASS} flex flex-col gap-4 rounded-2xl p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="hf-display text-lg font-bold leading-snug">{h.name}</h3><p className="text-sm text-[#C7D2EA]">{h.area}</p></div>
        <div className="flex flex-col items-end gap-1.5">
          <Pill tone={h.isOpen ? "bg-[#2DD4BF]/20 text-[#7CF0DF]" : "bg-rose-400/20 text-rose-200"}>{h.isOpen ? "Open" : "Closed"}</Pill>
          <Pill tone={h.avail ? "bg-white/10 text-white" : "bg-rose-400/20 text-rose-200"}>{h.avail ? `${h.avail} seats open` : "No seats"}</Pill>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p><span className="hf-display text-3xl font-bold">{taka(h.rent)}</span><span className="text-sm text-[#C7D2EA]"> per month</span></p>
        <p className="text-sm text-[#C7D2EA]">{h.distance} km from campus</p>
      </div>
      <Stars value={h.rating} count={h.reviews.length} />
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a href={`tel:${h.phone.replace(/-/g, "")}`} className={`rounded text-[#7CF0DF] ${FOCUS}`}>Call {h.phone}</a>
        <a href={`https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`} target="_blank" rel="noreferrer" onClick={() => onView(h.id)} className={`rounded text-[#7CF0DF] ${FOCUS}`}>View on Google Maps</a>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mine ? (
          <>
            <Pill tone={BADGE[mine.state]}>{mine.state === "pending" ? "Request pending" : "Booked"}</Pill>
            <button type="button" onClick={() => onCancel(mine.id)} className={GHOST}>Cancel Booking</button>
          </>
        ) : (
          <button type="button" disabled={!!blocked} onClick={() => onBook(h)} className={TEAL}>{blocked ? `${blocked}, can’t book` : "Book Now"}</button>
        )}
      </div>

      <div className="border-t border-white/15 pt-3">
        <button type="button" onClick={toggle} aria-expanded={open} className={`rounded text-sm font-semibold text-[#7CF0DF] ${FOCUS}`}>
          {open ? "Hide area reviews" : `Read area reviews (${h.reviews.length})`}
        </button>
        {open && (
          <div className="mt-3">
            <ul className="space-y-2">
              {h.reviews.map((r) => (
                <li key={r.id} className="rounded-xl bg-white/5 p-3 text-sm">
                  <p className="text-[#F5B544]" aria-label={`${r.rating} stars`}>{"★".repeat(r.rating)}<span className="text-white/25">{"★".repeat(5 - r.rating)}</span></p>
                  <p>“{r.text}”</p><p className="mt-1 text-xs text-[#9FB0D3]">{r.who}</p>
                </li>
              ))}
            </ul>
            <ReviewForm onSubmit={(rating, text) => onReview(h.id, rating, text)} />
          </div>
        )}
      </div>
    </article>
  );
}

function Facade() {
  return (
    <div className="grid grid-cols-6 gap-2.5" aria-hidden="true">
      {WINDOWS.split("").map((c, i) => <div key={i} className={`aspect-[3/4] rounded-md ${c === "1" ? "bg-[#F5B544] shadow-[0_0_18px_rgba(245,181,68,0.55)]" : "bg-white/10"}`} />)}
    </div>
  );
}

/* ---------- AI assistant (rule-based mock; see note at bottom) ---------- */
function answer(q, hs) {
  const t = q.toLowerCase();
  const open = hs.filter((h) => h.isOpen && h.avail > 0);
  const by = (k, dir = 1) => [...open].sort((a, b) => dir * (a[k] - b[k]))[0];
  if (!open.length) return "No hostel has an open seat right now. Check back after landlords update their listings.";
  if (/scam|fake|fraud|advance|bkash|safe/.test(t)) return "Never pay an advance to someone you haven’t met at the property. Visit in person, see the exact room, and get rent and deposit in writing. If anything feels off, file it in the Report box.";
  if (/book|cancel|request/.test(t)) return "Press Book Now on a hostel card, pick a move-in date, and the landlord will accept or decline. You can cancel from the same card.";
  if (/cheap|lowest|budget|rent|price/.test(t)) { const h = by("rent"); return `Cheapest with open seats: ${h.name} (${h.area}) at ${taka(h.rent)} a month, ${h.distance} km from campus.`; }
  if (/near|close|distance|walk/.test(t)) { const h = by("distance"); return `Closest with a free seat: ${h.name}, ${h.distance} km away at ${taka(h.rent)} a month.`; }
  if (/best|rating|rated|top|review/.test(t)) { const h = by("rating", -1); return `Highest rated with open seats: ${h.name}, ${h.rating.toFixed(1)} stars, ${taka(h.rent)} a month.`; }
  if (/seat|vacan|available|open/.test(t)) return "Open seats right now: " + open.map((h) => `${h.name} (${h.avail})`).join(", ") + ".";
  return "I can compare rent, distance, ratings and open seats, or explain booking and scams. Try: “cheapest hostel” or “how do I avoid scams?”";
}

function ChatWidget({ hs }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([{ from: "ai", text: "Hi, I’m the Hostel Finder assistant. Ask about rent, distance, ratings, booking or scams." }]);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy, open]);
  const send = (text) => {
    const q = text.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { from: "me", text: q }]); setInput(""); setBusy(true);
    setTimeout(() => { setMsgs((m) => [...m, { from: "ai", text: answer(q, hs) }]); setBusy(false); }, 600);
  };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <section aria-label="Hostel assistant" className={`${GLASS} flex h-[460px] max-h-[70vh] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl bg-[#0E1A3A]/70`}>
          <header className="flex items-center justify-between border-b border-white/15 px-4 py-3">
            <h2 className="hf-display font-bold">Ask the assistant</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className={`rounded-lg px-2 text-xl leading-none ${FOCUS}`}>×</button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {msgs.map((m, i) => <p key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "me" ? "ml-auto bg-[#2DD4BF] text-[#06222B]" : "bg-white/10"}`}>{m.text}</p>)}
            {busy && <p className="w-fit rounded-2xl bg-white/10 px-3 py-2 text-sm text-[#C7D2EA]">Typing…</p>}
            <div ref={end} />
          </div>
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {["Cheapest hostel", "Nearest to campus", "Avoid scams"].map((s) => <button key={s} type="button" onClick={() => send(s)} className={`rounded-full border border-white/20 px-3 py-1 text-xs ${FOCUS}`}>{s}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-white/15 p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a hostel" aria-label="Your message" className={FIELD} />
            <button type="submit" className={TEAL}>Send</button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`${GLASS} rounded-full bg-[#2DD4BF]/90 px-5 py-3 text-sm font-bold text-[#06222B] ${FOCUS}`}>{open ? "Close assistant" : "Ask AI assistant"}</button>
    </div>
  );
}

/* ---------- Student Portal ---------- */
function StudentPortal({ hs, bk, reports, me, today, actions }) {
  const [maxRent, setMaxRent] = useState(9000);
  const [maxDist, setMaxDist] = useState(5);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState("rating");
  const [booking, setBooking] = useState(null);
  const [form, setForm] = useState({ hostel: hs[0].name, type: REPORT_TYPES[0], text: "", contact: "" });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const list = useMemo(() => {
    const f = hs.filter((h) => h.rent <= maxRent && h.distance <= maxDist && (!onlyOpen || (h.isOpen && h.avail > 0)));
    const key = { rating: (a, b) => b.rating - a.rating, rent: (a, b) => a.rent - b.rent, distance: (a, b) => a.distance - b.distance, seats: (a, b) => b.avail - a.avail }[sort];
    return f.sort(key);
  }, [hs, maxRent, maxDist, onlyOpen, sort]);
  const totalSeats = hs.reduce((s, h) => s + (h.isOpen ? h.avail : 0), 0);
  const reset = () => { setMaxRent(9000); setMaxDist(5); setOnlyOpen(false); setSort("rating"); };
  const myActive = (id) => bk.find((b) => b.mine && b.hostelId === id && (b.state === "pending" || b.state === "accepted"));
  const mineAll = bk.filter((b) => b.mine);

  const submit = (e) => {
    e.preventDefault();
    if (form.text.trim().length < 20) { setError("Describe what happened in at least 20 characters so others can judge it."); setSent(false); return; }
    actions.report({ id: "r" + Date.now(), hostel: form.hostel, type: form.type, text: form.text.trim(), when: "Just now", resolved: false });
    setForm({ ...form, text: "", contact: "" }); setError(""); setSent(true);
  };

  return (
    <>
      <header className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.2fr_1fr] md:pt-20">
        <div>
          <h1 className="hf-display text-4xl font-bold leading-[1.05] sm:text-6xl">Find a hostel near campus that’s worth the rent.</h1>
          <p className="mt-5 max-w-xl text-lg text-[#C7D2EA]">Compare rent, open seats, distance and what neighbours say. Book a seat, and report anything that smells like a scam so the next student sees it.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#hostels" className={`${TEAL} px-6 py-3`}>Browse hostels</a>
            <a href="#report" className={`${GLASS} rounded-xl px-6 py-3 text-sm font-semibold ${FOCUS}`}>Report a scam</a>
          </div>
        </div>
        <div className={`${GLASS} rounded-3xl p-6`}>
          <Facade />
          <p className="mt-5 text-sm text-[#C7D2EA]"><span className="hf-display text-2xl font-bold text-white">{totalSeats} seats</span> open right now across {hs.filter((h) => h.isOpen && h.avail > 0).length} hostels taking students.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-20 px-4 pb-32">
        {mineAll.length > 0 && (
          <section aria-labelledby="mb-title">
            <h2 id="mb-title" className="hf-display text-2xl font-bold">My bookings</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mineAll.map((b) => (
                <li key={b.id} className={`${GLASS} rounded-2xl p-4 text-sm`}>
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold">{hs.find((h) => h.id === b.hostelId)?.name}</p><Pill tone={BADGE[b.state]}>{b.state}</Pill></div>
                  <p className="mt-1 text-[#C7D2EA]">Move-in {fmt(b.moveIn)}, until {fmt(b.until)}</p>
                  {b.state === "expired" && <p className="mt-1 text-xs text-[#9FB0D3]">This booking’s dates have passed.</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="hostels" aria-labelledby="h-title" className="scroll-mt-24">
          <h2 id="h-title" className="hf-display text-3xl font-bold">Hostels near campus</h2>
          <div className={`${GLASS} mt-6 grid gap-5 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-4`}>
            <label className="block text-sm"><span className="flex justify-between"><span>Max rent</span><b>{taka(maxRent)}</b></span>
              <input type="range" min="3000" max="9000" step="500" value={maxRent} onChange={(e) => setMaxRent(+e.target.value)} className="mt-2 w-full accent-[#2DD4BF]" /></label>
            <label className="block text-sm"><span className="flex justify-between"><span>Max distance</span><b>{maxDist} km</b></span>
              <input type="range" min="0.5" max="5" step="0.5" value={maxDist} onChange={(e) => setMaxDist(+e.target.value)} className="mt-2 w-full accent-[#2DD4BF]" /></label>
            <label className="block text-sm"><span>Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${FIELD} mt-2`}>{SORTS.map((s) => <option key={s.v} value={s.v} className="text-slate-900">{s.label}</option>)}</select></label>
            <div className="flex items-end justify-between gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="h-4 w-4 accent-[#2DD4BF]" />Bookable only</label>
              <button type="button" onClick={reset} className={GHOST}>Reset</button>
            </div>
          </div>
          <p className="mt-4 text-sm text-[#C7D2EA]" aria-live="polite">{list.length} of {hs.length} hostels match</p>
          {list.length ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((h) => <HostelCard key={h.id} h={h} mine={myActive(h.id)} onView={actions.view} onBook={setBooking} onCancel={actions.cancel} onReview={actions.review} />)}
            </div>
          ) : (
            <div className={`${GLASS} mt-4 rounded-2xl p-8 text-center`}>
              <p className="font-semibold">No hostel fits those limits.</p>
              <p className="mt-1 text-sm text-[#C7D2EA]">Raise the rent or distance limit, or reset the filters.</p>
              <button type="button" onClick={reset} className={`${TEAL} mt-4`}>Reset filters</button>
            </div>
          )}
        </section>

        <section id="report" aria-labelledby="r-title" className="scroll-mt-24 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 id="r-title" className="hf-display text-3xl font-bold">Report a scam or complaint</h2>
            <p className="mt-2 text-[#C7D2EA]">Contact details are optional and never shown in the public list.</p>
            <form onSubmit={submit} className={`${GLASS} mt-6 space-y-4 rounded-2xl p-5`} noValidate>
              <label className="block text-sm">Hostel
                <select value={form.hostel} onChange={(e) => setForm({ ...form, hostel: e.target.value })} className={`${FIELD} mt-1`}>
                  {hs.map((h) => <option key={h.id} className="text-slate-900">{h.name}</option>)}<option className="text-slate-900">Other / not listed</option>
                </select></label>
              <label className="block text-sm">What kind of problem
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={`${FIELD} mt-1`}>{REPORT_TYPES.map((t) => <option key={t} className="text-slate-900">{t}</option>)}</select></label>
              <label className="block text-sm">What happened
                <textarea rows="4" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Dates, amounts, how you were contacted" className={`${FIELD} mt-1`} aria-invalid={!!error} /></label>
              <label className="block text-sm">Phone or email (optional)<input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className={`${FIELD} mt-1`} /></label>
              <p role="status" className={`min-h-5 text-sm ${error ? "text-rose-300" : "text-[#7CF0DF]"}`}>{error || (sent ? "Report submitted. Admins can see it now." : "")}</p>
              <button type="submit" className={AMBER}>Submit report</button>
            </form>
          </div>
          <div>
            <h3 className="hf-display text-xl font-bold">Recent reports</h3>
            <ul className="mt-4 space-y-3">
              {reports.map((r) => (
                <li key={r.id} className={`${GLASS} rounded-2xl p-4`}>
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold">{r.type}</p>{r.resolved && <Pill tone={BADGE.accepted}>Resolved</Pill>}</div>
                  <p className="text-sm text-[#C7D2EA]">{r.hostel}, {r.when}</p><p className="mt-2 text-sm">{r.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {booking && <BookingModal hostel={booking} me={me} today={today} onClose={() => setBooking(null)} onSubmit={(f) => { actions.book(booking, f); setBooking(null); }} />}
    </>
  );
}

/* ---------- Landlord (Bariwala) Portal ---------- */
function LandlordPortal({ hs, bk, actions }) {
  const [hid, setHid] = useState(hs[0].id);
  const h = hs.find((x) => x.id === hid);
  const mine = bk.filter((b) => b.hostelId === hid);
  const booked = mine.filter((b) => b.state === "accepted");
  const pending = mine.filter((b) => b.state === "pending");
  const past = mine.filter((b) => ["expired", "cancelled", "declined"].includes(b.state));
  const Row = ({ b, children }) => (
    <li className={`${GLASS} flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-sm`}>
      <div>
        <p className="font-semibold">{b.name}</p>
        <a href={`tel:${b.phone.replace(/-/g, "")}`} className={`rounded text-[#7CF0DF] ${FOCUS}`}>{b.phone}</a>
        <p className="text-[#C7D2EA]">Move-in {fmt(b.moveIn)}, until {fmt(b.until)}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </li>
  );
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pb-32 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="hf-display text-4xl font-bold">Landlord (Bariwala) Portal</h1><p className="mt-2 text-[#C7D2EA]">Manage requests, residents and whether your hostel is taking students.</p></div>
        <label className="block text-sm">Managing
          <select value={hid} onChange={(e) => setHid(+e.target.value)} className={`${FIELD} mt-1 min-w-64`}>{hs.map((x) => <option key={x.id} value={x.id} className="text-slate-900">{x.name}</option>)}</select></label>
      </div>

      <div className={`${GLASS} flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5`}>
        <div><p className="font-semibold">{h.isOpen ? "Open for new students" : "Closed to new students"}</p><p className="text-sm text-[#C7D2EA]">Students can’t send booking requests while closed.</p></div>
        <button type="button" onClick={() => actions.toggleOpen(h.id)} className={h.isOpen ? GHOST : TEAL}>{h.isOpen ? "Mark as closed" : "Mark as open"}</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students viewed" value={h.views} hint="Details or map opened" />
        <Stat label="Active reviews" value={h.reviews.length} hint={h.reviews.length ? `${h.rating.toFixed(1)} average` : "None yet"} />
        <Stat label="Booked students" value={booked.length} hint={`${h.avail} of ${h.seats} seats free`} />
        <Stat label="Pending requests" value={pending.length} />
      </div>

      <section aria-labelledby="l-pend">
        <h2 id="l-pend" className="hf-display text-2xl font-bold">Pending booking requests</h2>
        <ul className="mt-4 space-y-3">
          {pending.length ? pending.map((b) => (
            <Row key={b.id} b={b}>
              <button type="button" disabled={h.avail === 0} title={h.avail === 0 ? "No free seats left" : ""} onClick={() => actions.setStatus(b.id, "accepted")} className={TEAL}>Accept</button>
              <button type="button" onClick={() => actions.setStatus(b.id, "declined")} className={GHOST}>Decline</button>
            </Row>
          )) : <li className="text-sm text-[#C7D2EA]">No pending requests.</li>}
        </ul>
      </section>

      <section aria-labelledby="l-book">
        <h2 id="l-book" className="hf-display text-2xl font-bold">Currently booked students</h2>
        <ul className="mt-4 space-y-3">
          {booked.length ? booked.map((b) => <Row key={b.id} b={b}><Pill tone={BADGE.accepted}>Booked</Pill></Row>) : <li className="text-sm text-[#C7D2EA]">Nobody is booked yet.</li>}
        </ul>
      </section>

      <section aria-labelledby="l-past">
        <h2 id="l-past" className="hf-display text-2xl font-bold">Expired, cancelled and declined</h2>
        <p className="mt-1 text-sm text-[#C7D2EA]">Pending requests expire when their move-in date passes, and accepted stays expire when they end.</p>
        <ul className="mt-4 space-y-3">
          {past.length ? past.map((b) => <Row key={b.id} b={b}><Pill tone={BADGE[b.state]}>{b.state}</Pill></Row>) : <li className="text-sm text-[#C7D2EA]">Nothing here.</li>}
        </ul>
      </section>
    </main>
  );
}

/* ---------- Admin Dashboard ---------- */
function AdminPortal({ hs, bk, reports, actions }) {
  const count = (s) => bk.filter((b) => b.state === s).length;
  const allReviews = hs.flatMap((h) => h.reviews);
  const avg = allReviews.length ? allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length : 0;
  const openReports = reports.filter((r) => !r.resolved).length;
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pb-32 pt-12">
      <div><h1 className="hf-display text-4xl font-bold">Admin Dashboard</h1><p className="mt-2 text-[#C7D2EA]">Platform health, reports and hostel performance in one place.</p></div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total hostels" value={hs.length} hint={`${hs.filter((h) => h.isOpen).length} open to students`} />
        <Stat label="Reports" value={reports.length} hint={`${openReports} open, ${reports.length - openReports} resolved`} />
        <Stat label="Bookings" value={bk.length} hint={`${count("accepted")} booked, ${count("pending")} pending`} />
        <Stat label="Average rating" value={avg.toFixed(1)} hint={`${allReviews.length} reviews`} />
        <Stat label="Free seats" value={hs.reduce((s, h) => s + h.avail, 0)} hint={`of ${hs.reduce((s, h) => s + h.seats, 0)} listed`} />
        <Stat label="Hostel views" value={hs.reduce((s, h) => s + h.views, 0)} />
        <Stat label="Cancelled or declined" value={count("cancelled") + count("declined")} />
        <Stat label="Expired bookings" value={count("expired")} />
      </div>

      <section aria-labelledby="a-host">
        <h2 id="a-host" className="hf-display text-2xl font-bold">Hostels</h2>
        <div className={`${GLASS} mt-4 overflow-x-auto rounded-2xl`}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[#C7D2EA]"><tr>{["Hostel", "Rating", "Free seats", "Status", "Bookings", "Reports"].map((c) => <th key={c} scope="col" className="px-4 py-3 font-semibold">{c}</th>)}</tr></thead>
            <tbody>
              {hs.map((h) => (
                <tr key={h.id} className="border-t border-white/10">
                  <th scope="row" className="px-4 py-3 font-semibold">{h.name}</th>
                  <td className="px-4 py-3">{h.reviews.length ? h.rating.toFixed(1) : "n/a"}</td>
                  <td className="px-4 py-3">{h.avail} / {h.seats}</td>
                  <td className="px-4 py-3">{h.isOpen ? "Open" : "Closed"}</td>
                  <td className="px-4 py-3">{bk.filter((b) => b.hostelId === h.id).length}</td>
                  <td className="px-4 py-3">{reports.filter((r) => r.hostel === h.name).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="a-rep" className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 id="a-rep" className="hf-display text-2xl font-bold">Reports by type</h2>
          <ul className={`${GLASS} mt-4 space-y-2 rounded-2xl p-5 text-sm`}>
            {REPORT_TYPES.map((t) => <li key={t} className="flex justify-between gap-3"><span>{t}</span><b>{reports.filter((r) => r.type === t).length}</b></li>)}
          </ul>
        </div>
        <div>
          <h2 className="hf-display text-2xl font-bold">All reports</h2>
          <ul className="mt-4 space-y-3">
            {reports.map((r) => (
              <li key={r.id} className={`${GLASS} rounded-2xl p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-semibold">{r.type}</p><p className="text-sm text-[#C7D2EA]">{r.hostel}, {r.when}</p></div>
                  <button type="button" onClick={() => actions.resolve(r.id)} className={r.resolved ? GHOST : TEAL}>{r.resolved ? "Reopen" : "Mark resolved"}</button>
                </div>
                <p className="mt-2 text-sm">{r.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

/* ---------- App shell ---------- */
export default function App() {
  const [role, setRole] = useState("student");
  const [hostels, setHostels] = useState(SEED_HOSTELS);
  const [bookings, setBookings] = useState(SEED_BOOKINGS.map((b) => ({ ...b, mine: b.id === "s5" })));
  const [reports, setReports] = useState(SEED_REPORTS);
  const [me, setMe] = useState({ name: "", phone: "" });
  const [today, setToday] = useState(T0);

  // Re-check the date every minute so bookings expire without a reload.
  useEffect(() => { const t = setInterval(() => setToday(iso(new Date())), 60000); return () => clearInterval(t); }, []);

  // Auto-expire: pending requests expire when move-in passes; accepted stays expire when "until" passes.
  const bk = useMemo(() => bookings.map((b) => ({
    ...b, state: (b.status === "pending" && b.moveIn < today) || (b.status === "accepted" && b.until < today) ? "expired" : b.status,
  })), [bookings, today]);

  const hs = useMemo(() => hostels.map((h) => {
    const n = h.reviews.length;
    const taken = bk.filter((b) => b.hostelId === h.id && b.state === "accepted").length;
    return { ...h, rating: n ? h.reviews.reduce((s, r) => s + r.rating, 0) / n : 0, avail: Math.max(0, h.seats - taken) };
  }), [hostels, bk]);

  const patchHostel = (id, fn) => setHostels((all) => all.map((h) => (h.id === id ? fn(h) : h)));
  const actions = {
    view: (id) => patchHostel(id, (h) => ({ ...h, views: h.views + 1 })),
    toggleOpen: (id) => patchHostel(id, (h) => ({ ...h, isOpen: !h.isOpen })),
    review: (id, rating, text) => patchHostel(id, (h) => ({ ...h, reviews: [...h.reviews, { id: "n" + Date.now(), who: me.name ? `${me.name}, student` : "You, student", rating, text }] })),
    book: (h, f) => { setMe({ name: f.name, phone: f.phone }); setBookings((b) => [{ id: "b" + Date.now(), hostelId: h.id, name: f.name, phone: f.phone, moveIn: f.moveIn, until: addDays(f.moveIn, f.months * 30), status: "pending", mine: true }, ...b]); },
    cancel: (id) => setBookings((b) => b.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x))),
    setStatus: (id, status) => setBookings((b) => b.map((x) => (x.id === id ? { ...x, status } : x))),
    report: (r) => setReports((all) => [r, ...all]),
    resolve: (id) => setReports((all) => all.map((r) => (r.id === id ? { ...r, resolved: !r.resolved } : r))),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0E1A3A] text-white" style={{ fontFamily: "Figtree, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600&display=swap');
        .hf-display { font-family: 'Bricolage Grotesque', Georgia, serif; letter-spacing: -0.01em; }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
      `}</style>

      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 top-10 h-96 w-96 rounded-full bg-[#2DD4BF]/30 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-[#F5B544]/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-[#FB7185]/20 blur-3xl" />
      </div>

      <div className="relative z-10">
        <nav aria-label="Main" className={`${GLASS} sticky top-3 z-40 mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:mx-auto sm:max-w-6xl`}>
          <a href="#top" className={`flex items-center gap-2 rounded-lg ${FOCUS}`}>
            <span aria-hidden="true" className="grid h-7 w-7 grid-cols-2 gap-0.5 rounded-md bg-white/10 p-1"><i className="rounded-sm bg-[#F5B544]" /><i className="rounded-sm bg-white/30" /><i className="rounded-sm bg-white/30" /><i className="rounded-sm bg-[#F5B544]" /></span>
            <span className="hf-display text-lg font-bold">Hostel Finder</span>
          </a>
          <div role="group" aria-label="Switch portal" className="order-last grid w-full grid-cols-3 gap-1 rounded-xl bg-black/20 p-1 md:order-none md:w-auto">
            {ROLES.map((r) => (
              <button key={r.v} type="button" aria-pressed={role === r.v} onClick={() => setRole(r.v)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${FOCUS} ${role === r.v ? "bg-[#2DD4BF] text-[#06222B] shadow-[0_0_16px_rgba(45,212,191,0.5)]" : "text-[#C7D2EA]"}`}>{r.label}</button>
            ))}
          </div>
          {role === "student" ? <a href="#report" className={AMBER}>Report a scam</a> : <span className="hidden w-24 md:block" />}
        </nav>

        <div id="top" />
        {role === "student" && <StudentPortal hs={hs} bk={bk} reports={reports} me={me} today={today} actions={actions} />}
        {role === "landlord" && <LandlordPortal hs={hs} bk={bk} actions={actions} />}
        {role === "admin" && <AdminPortal hs={hs} bk={bk} reports={reports} actions={actions} />}

        <footer className="px-4 pb-10 text-center text-sm text-[#9FB0D3]">Hostel Finder is a student project. Always visit a hostel before you pay.</footer>
      </div>

      <ChatWidget hs={hs} />
    </div>
  );
}

/*
  Notes
  - Tailwind CSS must already be set up in your project (v3 or v4); only core utilities and arbitrary values are used.
  - Everything lives in memory and resets on refresh. The role switcher is a demo switch, not real login:
    before going live, protect Landlord and Admin views with real authentication and a backend.
  - Phone numbers, names and map coordinates are placeholders. Replace lat/lng with each hostel’s real location.
  - The AI assistant is rule-based. For a real one, call your own backend route and never ship an API key in frontend code.
*/