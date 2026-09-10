-- LifeOS — comprovante/recibo de origem da despesa compartilhada
-- Mantém o documento privado no bucket já usado pelos Acertos e guarda apenas
-- metadados no banco. Sugestões extraídas sempre passam por revisão humana.

alter table public.despesas_compartilhadas
  add column if not exists categoria text,
  add column if not exists data_despesa date,
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text,
  add column if not exists comprovante_tipo text,
  add column if not exists comprovante_dados jsonb not null default '{}'::jsonb,
  add column if not exists comprovante_atualizado_em timestamptz;

create or replace function public.atualizar_metadados_despesa_compartilhada(
  p_despesa_id uuid,
  p_categoria text default null,
  p_data_despesa date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario public.usuarios%rowtype;
begin
  select * into v_usuario
  from public.usuarios
  where auth_id = auth.uid();

  if v_usuario.id is null then
    raise exception 'Perfil do LifeOS não encontrado.';
  end if;

  update public.despesas_compartilhadas
  set categoria = nullif(trim(p_categoria), ''),
      data_despesa = p_data_despesa,
      atualizado_em = now()
  where id = p_despesa_id
    and casa_id = v_usuario.casa_id;

  if not found then
    raise exception 'Despesa não encontrada nesta Casa.';
  end if;
end;
$$;

revoke all on function public.atualizar_metadados_despesa_compartilhada(uuid,text,date) from public;
grant execute on function public.atualizar_metadados_despesa_compartilhada(uuid,text,date) to authenticated;

comment on column public.despesas_compartilhadas.comprovante_path is
  'Caminho privado do documento original da despesa no bucket comprovantes-acertos.';
comment on column public.despesas_compartilhadas.comprovante_dados is
  'Sugestões determinísticas extraídas do documento; nunca substituem a revisão do usuário.';
