-- LIFEOS - MIGRACAO 033: ARQUIVOS DE COMPROVANTES DE ACERTOS

alter table public.acerto_pagamentos
  add column if not exists arquivo_tipo text;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'comprovantes-acertos',
  'comprovantes-acertos',
  false,
  12582912,
  array['application/pdf','image/png','image/jpeg']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
