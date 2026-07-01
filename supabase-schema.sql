-- =====================================================================
--  #TEACH MOU e-Sign — Supabase schema
--  Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run
--
--  ALREADY DEPLOYED an earlier version? Run just this migration block once
--  to add the new signature-authentication columns to your existing table:
--
--    alter table public.mou_documents
--      add column if not exists audit jsonb not null default '[]'::jsonb,
--      add column if not exists integrity_hash text;
--
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.mou_documents (
  id                uuid primary key default gen_random_uuid(),

  -- Public tokens (used in the district link + optional sender status link)
  recipient_token   text unique not null default replace(gen_random_uuid()::text,'-',''),
  sender_token      text unique not null default replace(gen_random_uuid()::text,'-',''),

  -- Workflow status: 'sent' (awaiting district) | 'signed' (complete) | 'voided'
  status            text not null default 'sent',

  -- Who is sending (your #TEACH staffer) — receives a copy of the signed PDF
  sender_name       text,
  sender_email      text not null,

  -- Where the district link is emailed
  recipient_email   text not null,

  -- Fields the SENDER completes (JSON blob, see index.html SENDER_FIELDS)
  sender_fields     jsonb not null default '{}'::jsonb,

  -- Fields the RECEIVER completes at signing time
  recipient_fields  jsonb default '{}'::jsonb,

  -- Signature capture
  signature_data    text,          -- PNG data URL of drawn/typed signature
  signed_name       text,          -- printed name typed by signer
  signed_title      text,
  signed_ip         text,
  signed_at         timestamptz,

  -- Final rendered PDF (base64, no data: prefix)
  signed_pdf_base64 text,

  -- Signature authentication
  audit             jsonb not null default '[]'::jsonb,   -- chronological event log
  integrity_hash    text,                                  -- SHA-256 of the signed record

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists mou_recipient_token_idx on public.mou_documents (recipient_token);
create index if not exists mou_sender_token_idx    on public.mou_documents (sender_token);
create index if not exists mou_status_idx          on public.mou_documents (status);

-- The Netlify functions use the SERVICE ROLE key (server-side only), which
-- bypasses RLS. We still enable RLS and add NO public policies so that the
-- anon key cannot read the table directly from the browser.
alter table public.mou_documents enable row level security;

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_mou on public.mou_documents;
create trigger trg_touch_mou before update on public.mou_documents
for each row execute function public.touch_updated_at();
