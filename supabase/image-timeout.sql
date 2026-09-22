-- Field Notes stores images as base64 rows in public.images. Existing rows can
-- exceed 25 MB; the default 3 second anon statement timeout is too short for
-- some image reads. Keep text sync fast and allow these larger reads to finish.
-- Apply once to the dedicated Field Notes Supabase project. Reload PostgREST
-- so the Data API uses the new role setting on fresh requests.

alter role anon set statement_timeout = '15s';
notify pgrst, 'reload config';
