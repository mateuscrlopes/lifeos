-- LIFEOS - MIGRACAO 027: PDFs DAS CONTAS RECEBIDAS POR E-MAIL
-- Cria um bucket privado para os documentos financeiros.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'contas-email',
  'contas-email',
  false,
  12582912,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contas_email_arquivos_ler
  on storage.objects;

create policy contas_email_arquivos_ler
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'contas-email');
