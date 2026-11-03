import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import ProfileAvatar from "../components/ProfileAvatar";
import { useActiveUsers } from "../hooks/activePresence";

export default function StudentDirectory() {
  const { profile } = useAuth();
  const activeUsers = useActiveUsers();
  const [universityName, setUniversityName] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: mine, error: profileError } = await supabase
        .from("student_profiles")
        .select("university_id")
        .eq("user_id", profile.id)
        .single();

      if (!active) return;
      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }
      if (!mine.university_id) {
        setMessage("Set your university in your profile to find fellow students.");
        setLoading(false);
        return;
      }

      const [universityResult, studentsResult] = await Promise.all([
        supabase.from("universities").select("name").eq("id", mine.university_id).single(),
        supabase
          .from("student_public")
          .select("user_id,name,university_id,department,profile_pic_url,verified")
          .eq("university_id", mine.university_id)
          .neq("user_id", profile.id)
          .order("name"),
      ]);
      if (!active) return;
      if (studentsResult.error || universityResult.error) {
        setMessage(studentsResult.error?.message || universityResult.error?.message);
      } else {
        setUniversityName(universityResult.data.name);
        setStudents(studentsResult.data || []);
      }
      setLoading(false);
    })();

    return () => { active = false; };
  }, [profile.id]);

  return (
    <section className="mx-auto max-w-4xl space-y-4 px-4 text-white">
      <header>
        <h1 className="text-2xl font-bold">Student network</h1>
        {universityName && <p className="mt-1 text-sm text-[#C7D2EA]">Students at {universityName}</p>}
      </header>
      {message && (
        <p role="status" className="rounded-xl border border-white/15 bg-white/10 p-3 text-sm text-[#FFD98A]">
          {message} {message.startsWith("Set your university") && <Link to="/student/profile" className="underline">Edit profile</Link>}
        </p>
      )}
      {loading && <p className="text-sm text-[#C7D2EA]">Loading students…</p>}
      {!loading && !message && students.length === 0 && (
        <p className="rounded-xl bg-white/10 p-4 text-sm text-[#C7D2EA]">No other student profiles are listed for this university yet.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {students.map((student) => (
          <article key={student.user_id} className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4">
            <ProfileAvatar
              imageUrl={student.profile_pic_url}
              name={student.name}
              active={activeUsers.has(student.user_id)}
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{student.name || "Student"} {student.verified && <span className="text-xs text-[#2DD4BF]">Verified</span>}</h2>
              <p className="text-sm text-[#C7D2EA]">{student.department || "Department not provided"}</p>
            </div>
            <Link to={`/student/chat/${student.user_id}`} className="shrink-0 rounded-lg bg-[#2DD4BF] px-3 py-2 text-sm font-semibold text-[#06222B]">
              Message
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
