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
3. If the student map page reports missing target coordinates, the admin dashboard reports `admin_user_overview` missing, or you want the new booking/chat flow, run [`supabase/migrations/20261103130000_booking_requests_and_admin_view.sql`](./supabase/migrations/20261103130000_booking_requests_and_admin_view.sql) in the SQL Editor.
4. To fix the missing `admin_update_profile_basics` RPC/schema-cache error, run [`supabase/migrations/20261103140000_restore_admin_profile_rpc.sql`](./supabase/migrations/20261103140000_restore_admin_profile_rpc.sql) after migration 3.
5. Apply [`supabase/migrations/20261103150000_message_notifications.sql`](./supabase/migrations/20261103150000_message_notifications.sql) and [`supabase/migrations/20261103160000_fix_message_notifications.sql`](./supabase/migrations/20261103160000_fix_message_notifications.sql) in order to prepare the existing message tables and scoped profile functions.
6. Then run [`supabase/migrations/20261103170000_inbox_and_remove_notifications.sql`](./supabase/migrations/20261103170000_inbox_and_remove_notifications.sql). This is the current messaging setup: it adds Inbox/conversation RPCs, landlord interest accept/decline and profile access, enables admin report deletion, and removes unread-message indicators/read-state functions.
7. Run [`supabase/migrations/20261103180000_include_private_chats_in_inbox.sql`](./supabase/migrations/20261103180000_include_private_chats_in_inbox.sql) to include booking and hostel-interest messages in both student and landlord Inboxes alongside peer chats. Each row shows the other person's profile and latest message and opens the correct private thread. The Inbox lists a conversation after at least one message exists; green/gray avatar dots show online status. Apply migrations in timestamp order, then refresh the app. Frontend changes cannot update the remote Supabase database by themselves.
8. Run [`supabase/migrations/20261103190000_reuse_hostel_interest_and_inbox_threads.sql`](./supabase/migrations/20261103190000_reuse_hostel_interest_and_inbox_threads.sql) to let a student reapply after a landlord declines while keeping one interest record, and to combine duplicate Inbox entries for the same person and hostel.
7. In Authentication settings, enable email/password sign-up and choose whether email confirmation is required.
8. Import the Bangladesh university directory into `public.universities`. Include each campus's latitude/longitude; the student profile picker and university-radius search use these coordinates. A map pin can search any location even before its university is added to the directory.
9. Create the first student/landlord account through the app. To appoint an administrator, run this once in the SQL Editor as the project owner, replacing the email:

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
- Login roles are `STUDENT` and `LANDLORD`; `ADMIN` is assigned by the project owner only. Students can message other students at the same university; landlords can message other active landlords. Student-landlord conversations stay tied to a booking or hostel-interest thread.
- Map tiles use OpenStreetMap; no Google Maps key is required.
- `.env` and other environment files are ignored by Git.
