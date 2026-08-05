-- LIFEOS - MIGRACAO 028: LEITURA AUTOMATICA DOS PDFs
-- Guarda somente os campos encontrados. O texto integral do documento nao e salvo.

alter table public.contas_email_caixa
  add column if not exists dados_extraidos jsonb not null default '{}'::jsonb,
  add column if not exists extracao_status text not null default 'pendente',
  add column if not exists extracao_em timestamptz,
  add column if not exists extracao_erro text;

alter table public.contas_email_caixa
  drop constraint if exists contas_email_caixa_extracao_status_check;

alter table public.contas_email_caixa
  add constraint contas_email_caixa_extracao_status_check
  check (extracao_status in ('pendente', 'sucesso', 'parcial', 'falha'));
