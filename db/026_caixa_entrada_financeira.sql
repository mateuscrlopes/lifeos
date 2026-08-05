-- LIFEOS - MIGRACAO 026: CAIXA DE ENTRADA FINANCEIRA
-- Registra contas detectadas no Gmail antes de virarem contas oficiais.

create table if not exists public.contas_email_caixa (
  id                 uuid primary key default gen_random_uuid(),
  casa_id            uuid not null references public.casa(id) on delete cascade,
  fornecedor         text not null,
  chave_cobranca     text not null,
  competencia        text,
  email_message_id   text not null,
  email_thread_id    text,
  remetente          text,
  assunto            text,
  recebido_em        timestamptz,
  anexos              jsonb not null default '[]'::jsonb,
  status              text not null default 'aguardando'
                      check (status in ('aguardando', 'importado', 'ignorado')),
  conta_id            uuid references public.contas(id) on delete set null,
  criada_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (casa_id, chave_cobranca),
  unique (casa_id, email_message_id)
);

create index if not exists contas_email_caixa_status_idx
  on public.contas_email_caixa (casa_id, status, recebido_em desc);

alter table public.contas_email_caixa enable row level security;

drop policy if exists contas_email_caixa_ler on public.contas_email_caixa;
create policy contas_email_caixa_ler
  on public.contas_email_caixa
  for select to authenticated
  using (true);

drop policy if exists contas_email_caixa_inserir on public.contas_email_caixa;
create policy contas_email_caixa_inserir
  on public.contas_email_caixa
  for insert to authenticated
  with check (true);

drop policy if exists contas_email_caixa_atualizar on public.contas_email_caixa;
create policy contas_email_caixa_atualizar
  on public.contas_email_caixa
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists contas_email_caixa_remover on public.contas_email_caixa;
create policy contas_email_caixa_remover
  on public.contas_email_caixa
  for delete to authenticated
  using (true);

grant select, insert, update, delete
  on table public.contas_email_caixa
  to authenticated;
