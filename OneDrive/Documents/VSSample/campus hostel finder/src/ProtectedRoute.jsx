import { Navigate } from "react-router-dom";
import { useAuth, HOME } from "./auth";

// UX guard only. Real enforcement is RLS in the database.
export default function ProtectedRoute({ roles, children }) {
  const { session, profile, loading, authError, signOut } = useAuth();
  if (loading) return <div className="herbal-bg grid min-h-screen place-items-center text-white">Loading…</div>;
  if (session && !profile) {
    return (
      <div className="herbal-bg grid min-h-screen place-items-center p-4 text-white">
        <div className="max-w-lg space-y-3 rounded-2xl border border-white/20 bg-white/10 p-5">
          <p role="alert">{authError || "Your account role could not be verified. Portal access is blocked."}</p>
          <button type="button" onClick={signOut} className="rounded-lg border border-white/25 px-3 py-2 text-sm">Sign out</button>
        </div>
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  if (!roles.includes(profile.role)) return <Navigate to={HOME[profile.role]} replace />;
  return children;
}
