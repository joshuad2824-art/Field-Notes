-- One event remains one recoverable series. Existing events stay unchanged.
-- Repeat interpretation is shared by the app and OAuth-authenticated MCP.
alter table public.events add column recurrence jsonb;
alter table public.events add constraint events_recurrence_shape check (
  recurrence is null or (
    jsonb_typeof(recurrence) = 'object'
    and recurrence ?& array['frequency','interval']
    and jsonb_typeof(recurrence->'frequency') = 'string'
    and recurrence->>'frequency' in ('daily','weekly','monthly','yearly')
    and jsonb_typeof(recurrence->'interval') = 'number'
    and recurrence->>'interval' ~ '^[1-9][0-9]?$'
    and octet_length(recurrence::text) <= 4096
  )
);
comment on column public.events.recurrence is 'Optional local-calendar series rule; daily/weekly/monthly/yearly, interval, selected weekdays or monthly date/nth weekday, inclusive until or count. No occurrence rows are stored.';
