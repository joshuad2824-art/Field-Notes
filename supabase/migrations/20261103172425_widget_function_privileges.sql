-- Supabase's schema defaults also grant authenticated EXECUTE on new functions.
-- Remove that inherited default grant explicitly; retain the intended anon RPC
-- entry point, which separately validates the scoped token or paired vault key.
revoke all on function public.widget_publish(text,jsonb,boolean), public.widget_read(text), public.widget_revoke() from authenticated;
