alter table public.contas
  add column if not exists origem text not null default 'manual',
  add column if not exists fornecedor text,
  add column if not exists descricao_pagamento text,
  add column if not exists linha_digitavel text,
  add column if not exists pix_copia_cola text,
  add column if not exists qr_code_url text,
  add column if not exists documento_url text,
  add column if not exists email_message_id text,
  add column if not exists email_assunto text,
  add column if not exists importada_em timestamptz,
  add column if not exists revisada boolean not null default true,
  add column if not exists pago_por uuid,
  add column if not exists atualizado_em timestamptz not null default now();

create index if not exists contas_casa_vencimento_paga_idx
  on public.contas (casa_id, paga, vencimento);

create unique index if not exists contas_email_message_uq
  on public.contas (casa_id, email_message_id)
  where email_message_id is not null;

grant select, insert, update, delete on table public.contas to authenticated;
