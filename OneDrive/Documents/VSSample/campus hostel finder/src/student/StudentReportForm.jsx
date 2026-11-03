import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { CARD, FIELD } from "../ui";

const TYPES = [
  "Advance payment scam",
  "Rent changed after moving in",
  "Photos did not match the room",
  "Unsafe or unhygienic conditions",
  "Harassment or threats",
  "Something else",
];

export default function StudentReportForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [hostels, setHostels] = useState([]);
  const [hostelId, setHostelId] = useState("");
  const [reportType, setReportType] = useState(TYPES[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.from("hostels").select("id,house_name").eq("status", "approved").order("house_name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(error.message);
        else setHostels(data || []);
      });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const text = details.trim();
    if (!text || text.length > 5000) {
      setMessage("Enter issue details (up to 5,000 characters).");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("reports").insert({
      reporter_id: profile.id,
      hostel_id: hostelId || null,
      report_type: reportType,
      details: text,
    });
    setBusy(false);
    if (error) {
      const missingDetails = error.message.toLowerCase().includes("details")
        && error.message.toLowerCase().includes("schema cache");
      setMessage(missingDetails
        ? "Supabase database-এ report details column নেই। supabase/migrations/20261103100000_add_report_details.sql SQL Editor-এ চালিয়ে schema reload হওয়া পর্যন্ত অপেক্ষা করো."
        : error.message);
      return;
    }
    navigate("/student/dashboard");
  };

  return (
    <section className="mx-auto max-w-2xl px-4 text-white">
      <form onSubmit={submit} className={`${CARD} space-y-3`}>
        <h1 className="text-xl font-bold">Report an issue</h1>
        <p className="text-sm text-[#C7D2EA]">Reports are shared with platform admins for review.</p>
        <select className={FIELD} value={hostelId} onChange={(event) => setHostelId(event.target.value)}>
          <option value="">Not about a listed hostel</option>
          {hostels.map((hostel) => <option key={hostel.id} value={hostel.id}>{hostel.house_name}</option>)}
        </select>
        <select className={FIELD} value={reportType} onChange={(event) => setReportType(event.target.value)}>
          {TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
        <textarea
          className={FIELD}
          rows={5}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={5000}
          placeholder="Describe the issue. Avoid sharing passwords or sensitive medical details."
          required
        />
        {message && <p role="alert" className="text-sm text-[#FFD98A]">{message}</p>}
        <button disabled={busy} className="rounded-xl bg-[#2DD4BF] px-4 py-2 text-sm font-semibold text-[#06222B] disabled:opacity-40">
          {busy ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </section>
  );
}
