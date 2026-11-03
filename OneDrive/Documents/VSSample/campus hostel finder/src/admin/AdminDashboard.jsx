import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CARD, FIELD, GHOSTBTN, tk } from "../ui";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [tab, setTab] = useState("pending");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [s, h, u, unis, r] = await Promise.all([
      supabase.rpc("get_admin_stats"),
      supabase.from("hostels").select("*").order("created_at", { ascending: false }),
      supabase.from("admin_user_overview").select("*").order("created_at", { ascending: false }),
      supabase.from("universities").select("id,name").order("name"),
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
    ]);
    setStats(s.data); setHostels(h.data || []); setUsers(u.data || []); setUniversities(unis.data || []); setReports(r.data || []);
    const err = s.error || h.error || u.error || unis.error || r.error;
    setMsg(err ? err.message : "");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const act = async (p) => { const { error } = await p; setMsg(error ? error.message : ""); load(); };
  const beginEdit = (user) => {
    setEditing(user.id);
    setEditForm({
      name: user.display_name || "",
      contact_no: user.contact_no || "",
      contact_email: user.contact_email || "",
      university_id: user.university_id || "",
      department: user.department || "",
      bio: user.bio || "",
    });
  };
  const saveBasics = async (event, user) => {
    event.preventDefault();
    setSaving(true);
    setMsg("");
    const { error } = await supabase.rpc("admin_update_profile_basics", {
      target_user_id: user.id,
      user_name: editForm.name.trim() || null,
      contact_no: editForm.contact_no.trim() || null,
      contact_email: editForm.contact_email.trim() || null,
      university_id: user.role === "STUDENT" && editForm.university_id ? Number(editForm.university_id) : null,
      department: user.role === "STUDENT" ? editForm.department.trim() || null : null,
      bio: user.role === "LANDLORD" ? editForm.bio.trim() || null : null,
    });
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setEditing(null);
    setMsg("Profile information updated.");
    await load();
  };
  const shown = hostels.filter((h) => h.status === tab);
  const STAT = [["Students", stats?.students], ["Landlords", stats?.landlords], ["Active listings", stats?.active_listings], ["Open reports", stats?.open_reports]];

  return (
    <div className="herbal-bg min-h-screen p-4 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        {msg && <p role="alert" className="text-sm text-[#FFD98A]">{msg}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STAT.map(([k, v]) => <div key={k} className={CARD + " text-center"}><p className="text-xs text-[#C7D2EA]">{k}</p><p className="text-2xl font-bold">{v ?? 0}</p></div>)}
        </div>

        <section className={CARD + " space-y-3"}>
          <div className="flex gap-2">
            {["pending", "approved", "rejected"].map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs ${tab === t ? "bg-[#2DD4BF] font-semibold text-[#06222B]" : "bg-white/10"}`}>{t} ({hostels.filter((h) => h.status === t).length})</button>
            ))}
          </div>
          {shown.length === 0 && <p className="text-sm text-[#C7D2EA]">Nothing here.</p>}
          {shown.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 p-3 text-sm">
              <div><b>{h.house_name}</b><p className="text-xs text-[#C7D2EA]">{h.address} · {tk(h.monthly_rent)} · vacant {h.vacancy_count}</p></div>
              <div className="flex gap-2">
                {h.status !== "approved" && <button onClick={() => act(supabase.from("hostels").update({ status: "approved" }).eq("id", h.id))} className={GHOSTBTN}>Approve</button>}
                {h.status !== "rejected" && <button onClick={() => act(supabase.from("hostels").update({ status: "rejected" }).eq("id", h.id))} className={GHOSTBTN}>Reject</button>}
                <button onClick={() => confirm(`Delete "${h.house_name}"?`) && act(supabase.from("hostels").delete().eq("id", h.id))} className={GHOSTBTN}>Delete</button>
              </div>
            </div>
          ))}
        </section>

        <section className={CARD + " space-y-3"}>
          <h2 className="font-semibold">Student reports ({reports.filter((report) => report.status === "open" || report.status === "reviewing").length} open)</h2>
          {reports.length === 0 && <p className="text-sm text-[#C7D2EA]">No reports submitted.</p>}
          {reports.map((report) => (
            <article key={report.id} className="space-y-2 rounded-xl bg-white/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <b>{report.report_type}</b>
                  <p className="text-xs text-[#C7D2EA]">Status: {report.status} · {new Date(report.created_at).toLocaleString()}</p>
                </div>
                {report.status !== "resolved" && report.status !== "dismissed" && (
                  <div className="flex gap-2">
                    <button onClick={() => act(supabase.from("reports").update({ status: "resolved" }).eq("id", report.id))} className={GHOSTBTN}>Resolve</button>
                    <button onClick={() => act(supabase.from("reports").update({ status: "dismissed" }).eq("id", report.id))} className={GHOSTBTN}>Dismiss</button>
                  </div>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{report.details}</p>
              <button
                type="button"
                onClick={() => confirm("Permanently delete this report?") && act(supabase.from("reports").delete().eq("id", report.id))}
                className={GHOSTBTN}
              >
                Delete report
              </button>
            </article>
          ))}
        </section>

        <section className={CARD + " space-y-2"}>
          <h2 className="font-semibold">Users ({users.length})</h2>
          {users.map((u) => (
            <article key={u.id} className="space-y-2 rounded-xl bg-white/5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{u.email} · {u.role} · {u.status}</span>
                <div className="flex gap-2">
                  {u.role !== "ADMIN" && <button onClick={() => beginEdit(u)} className={GHOSTBTN}>Edit profile info</button>}
                  {u.role !== "ADMIN" && (
                    <button onClick={() => act(supabase.rpc("admin_set_status", { uid: u.id, s: u.status === "active" ? "suspended" : "active" }))} className={GHOSTBTN}>
                      {u.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  )}
                </div>
              </div>
              {editing === u.id && (
                <form onSubmit={(event) => saveBasics(event, u)} className="grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                  <p className="sm:col-span-2 text-[#C7D2EA]">Login email: {u.email} (not changed here)</p>
                  <input className={FIELD} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" />
                  <input className={FIELD} value={editForm.contact_no} onChange={(e) => setEditForm({ ...editForm, contact_no: e.target.value })} placeholder="Contact number" />
                  {u.role === "STUDENT" && <>
                    <input className={FIELD} type="email" value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} placeholder="Contact email" />
                    <select className={FIELD} value={editForm.university_id} onChange={(e) => setEditForm({ ...editForm, university_id: e.target.value })}>
                      <option value="">University not set</option>
                      {universities.map((university) => <option key={university.id} value={university.id}>{university.name}</option>)}
                    </select>
                    <input className={FIELD} value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} placeholder="Department" />
                  </>}
                  {u.role === "LANDLORD" && <textarea className={FIELD} rows={2} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Public bio" />}
                  <div className="flex gap-2 sm:col-span-2">
                    <button disabled={saving} className={GHOSTBTN}>{saving ? "Saving…" : "Save changes"}</button>
                    <button type="button" onClick={() => setEditing(null)} className={GHOSTBTN}>Cancel</button>
                  </div>
                </form>
              )}
            </article>
          ))}
          <p className="text-xs text-[#9FB0D3]">Private details and student messages are not shown in admin tools. Changing a contact email does not change the account login email.</p>
        </section>
      </div>
    </div>
  );
}
