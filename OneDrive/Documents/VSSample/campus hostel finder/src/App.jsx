import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { HOME, useAuth } from "./auth";
import { ActivePresenceProvider } from "./hooks/useActivePresence";
import ProtectedRoute from "./ProtectedRoute";
import Login from "./Login";

const LandlordPublicView = lazy(() => import("./LandlordPublicView"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const HostelListingForm = lazy(() => import("./landlord/HostelListingForm"));
const LandlordDashboard = lazy(() => import("./landlord/LandlordDashboard"));
const LandlordDirectory = lazy(() => import("./landlord/LandlordDirectory"));
const LandlordProfileForm = lazy(() => import("./landlord/LandlordProfileForm"));
const HostelSearchAndFilter = lazy(() => import("./student/HostelSearchAndFilter"));
const StudentChat = lazy(() => import("./student/StudentChat"));
const StudentDirectory = lazy(() => import("./student/StudentDirectory"));
const Inbox = lazy(() => import("./student/Inbox"));
const PublicProfile = lazy(() => import("./PublicProfile"));
const StudentProfileForm = lazy(() => import("./student/StudentProfileForm"));
const StudentReportForm = lazy(() => import("./student/StudentReportForm"));
const StudentBookings = lazy(() => import("./student/StudentBookings"));
const BookingChat = lazy(() => import("./student/BookingChat"));
const HostelInterestChat = lazy(() => import("./student/HostelInterestChat"));

const LINKS = {
  STUDENT: [
    ["Hostel search", "/student/dashboard"],
    ["My profile", "/student/profile"],
    ["Inbox", "/inbox"],
    ["My bookings", "/student/bookings"],
    ["Report an issue", "/student/report"],
  ],
  LANDLORD: [
    ["My dashboard", "/landlord/dashboard"],
    ["My profile", "/landlord/profile"],
    ["Inbox", "/inbox"],
    ["New listing", "/landlord/listing/new"],
  ],
  ADMIN: [["Admin dashboard", "/admin/dashboard"]],
};

function HomeRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingPage />;
  return <Navigate to={profile ? HOME[profile.role] : "/login"} replace />;
}

function LoadingPage() {
  return <div className="herbal-bg grid min-h-screen place-items-center text-white">Loading…</div>;
}

function PortalLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="herbal-bg min-h-screen text-white">
      <header className="sticky top-0 z-30 border-b border-[#E3B86B]/20 bg-[#16241D]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to={HOME[profile.role]} className="font-bold tracking-tight">Campus Hostel Finder</Link>
          <nav aria-label="Portal navigation" className="flex flex-wrap items-center gap-2">
            {LINKS[profile.role].map(([label, path]) => (
              <Link
                key={path}
                to={path}
                aria-current={location.pathname === path ? "page" : undefined}
                className={`relative rounded-lg px-3 py-2 text-sm ${location.pathname === path ? "bg-[#A8C887] font-semibold text-[#182019]" : "bg-white/10 text-white"}`}
              >
                {label}
              </Link>
            ))}
            <button type="button" onClick={signOut} className="rounded-lg border border-white/25 px-3 py-2 text-sm">
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <ActivePresenceProvider userId={profile.id}>
        <main className="py-4">
          <Outlet />
        </main>
      </ActivePresenceProvider>
      <footer className="px-4 pb-8 text-center text-sm text-[#9FB0D3]">
        Always visit a hostel and confirm the terms before paying.
      </footer>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute roles={["STUDENT", "LANDLORD"]}><PortalLayout /></ProtectedRoute>}>
          <Route path="/inbox" element={<Inbox />} />
        </Route>

        <Route element={<ProtectedRoute roles={["STUDENT"]}><PortalLayout /></ProtectedRoute>}>
          <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
          <Route path="/student/dashboard" element={<HostelSearchAndFilter />} />
          <Route path="/student/profile" element={<StudentProfileForm />} />
          <Route path="/student/peers" element={<StudentDirectory />} />
          <Route path="/student/chat/:userId" element={<StudentChat />} />
          <Route path="/student/bookings" element={<StudentBookings />} />
          <Route path="/student/bookings/:requestId/chat" element={<BookingChat />} />
          <Route path="/student/hostels/:hostelId/chat" element={<HostelInterestChat />} />
          <Route path="/student/report" element={<StudentReportForm />} />
        </Route>

        <Route element={<ProtectedRoute roles={["LANDLORD"]}><PortalLayout /></ProtectedRoute>}>
          <Route path="/landlord" element={<Navigate to="/landlord/dashboard" replace />} />
          <Route path="/landlord/dashboard" element={<LandlordDashboard />} />
          <Route path="/landlord/peers" element={<LandlordDirectory />} />
          <Route path="/landlord/chat/:userId" element={<StudentChat />} />
          <Route path="/landlord/profile" element={<LandlordProfileForm />} />
          <Route path="/landlord/listing/new" element={<HostelListingForm />} />
          <Route path="/landlord/listing/:id/edit" element={<HostelListingForm />} />
          <Route path="/landlord/bookings/:requestId/chat" element={<BookingChat />} />
          <Route path="/landlord/hostels/:hostelId/students/:studentId/chat" element={<HostelInterestChat />} />
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN"]}><PortalLayout /></ProtectedRoute>}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>

        <Route
          path="/hostel/:id"
          element={
            <ProtectedRoute roles={["STUDENT", "LANDLORD", "ADMIN"]}>
              <div className="mx-auto max-w-6xl px-4"><LandlordPublicView /></div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profiles/:userId"
          element={
            <ProtectedRoute roles={["STUDENT", "LANDLORD"]}>
              <div className="mx-auto max-w-6xl px-4"><PublicProfile /></div>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
