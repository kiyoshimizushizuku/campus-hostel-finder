# Campus Hostel Finder

React, Vite, and Supabase app for students and landlords in Bangladesh. Supabase Auth handles passwords; PostgreSQL row-level security (RLS) is the authorization boundary. The React route guard is only a navigation/UI convenience.

## Run locally

1. Install dependencies with `npm install`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
3. Run `npm run dev`.

Only the Supabase publishable/anon key belongs in this frontend. Never put a Supabase `service_role` key in a `VITE_` variable or commit it.

## Set up Supabase

1. Back up the project database, then open the Supabase SQL Editor and run [`supabase/migrations/20261102220000_hostel_finder_rbac.sql`](./supabase/migrations/20261102220000_hostel_finder_rbac.sql). It preserves rows but replaces RLS policies on this app's tables and access policies for its two image buckets.
2. If the project already has a `reports` table and report submission says the `details` column is missing from the schema cache, run [`supabase/migrations/20261103100000_add_report_details.sql`](./supabase/migrations/20261103100000_add_report_details.sql) in the SQL Editor. The database schema is remote, so changing app files alone cannot add this column; the SQL migration also asks PostgREST to reload its schema cache.
3. If the student map page reports missing target coordinates, the admin dashboard reports `admin_user_overview` missing, or you want the new booking/chat flow, run [`supabase/migrations/20261103130000_booking_requests_and_admin_view.sql`](./supabase/migrations/20261103130000_booking_requests_and_admin_view.sql) in the SQL Editor. It creates the admin-only profile view, booking request and private-message tables/policies, atomic landlord responses, and the missing student map-target columns, then reloads the PostgREST schema cache. Refresh the app after the query succeeds.
4. In Authentication settings, enable email/password sign-up and choose whether email confirmation is required.
5. Import the Bangladesh university directory into `public.universities`. Include each campus's latitude/longitude; the student profile picker and university-radius search use these coordinates. A map pin can search any location even before its university is added to the directory.
6. Create the first student/landlord account through the app. To appoint an administrator, run this once in the SQL Editor as the project owner, replacing the email:

   ```sql
   update public.profiles
   set role = 'ADMIN'
   where email = lower('admin@example.com')
     and role <> 'ADMIN';
   ```

   Admin accounts cannot be created through public sign-up. Admins can moderate listings, manage account status, correct basic profile fields, and review student reports. They cannot read private student emergency/guardian details or student chat messages.

The RBAC migration creates the tables, signup profile trigger, role checks, RLS policies, map-distance search functions, safe public-profile views, report/chat storage, and image buckets. Landlords can manage only their own listings; new and edited listings require admin approval. Students can search approved vacant listings, save a university/map target, mark interest, send booking requests, privately message the landlord about a request, view same-university public profiles, message peers, and report issues. A booking is confirmed only when its landlord accepts it; accepting atomically reserves one vacant room.

## Notes

- `src/App.jsx` defines role-specific routes: `/student/*`, `/landlord/*`, `/admin/*`. Direct visits without a matching account are redirected. Database RLS independently blocks unauthorized reads and writes.
- Login roles are `STUDENT` and `LANDLORD`; `ADMIN` is assigned by the project owner only.
- Map tiles use OpenStreetMap; no Google Maps key is required.
- `.env` and other environment files are ignored by Git.
