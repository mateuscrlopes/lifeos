-- LIFEOS - MIGRACAO 038: EXCLUSAO SEGURA DE ACERTOS E PONTE REVERSA
-- "Excluir" no produto significa retirar do fluxo ativo preservando trilha de auditoria.

alter table public.acertos
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references public.usuarios(id),
  add column if not exists cancelamento_motivo text;

alter table public.despesas_compartilhadas
  add column if not exists cancelada_em timestamptz,
  add column if not exists cancelada_por uuid references public.usuarios(id),
  add column if not exists cancelamento_motivo text;

create index if not exists acertos_cancelado_por_idx
  on public.acertos (cancelado_por);

create index if not exists despesas_compartilhadas_cancelada_por_idx
  on public.despesas_compartilhadas (cancelada_por);

create or replace function public.lifeos_obter_segredo_servidor(
  p_nome text
)
returns text
language sql
security definer
set search_path = vault, public
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_nome
  limit 1;
$$;

revoke all on function public.lifeos_obter_segredo_servidor(text)
  from public, anon, authenticated;
grant execute on function public.lifeos_obter_segredo_servidor(text)
  to service_role;
