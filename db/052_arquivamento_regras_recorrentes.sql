-- LIFEOS - MIGRACAO 052: ARQUIVAMENTO DE REGRAS RECORRENTES
-- Diferencia pausa de arquivamento sem apagar a regra nem os acertos já gerados.

alter table public.acerto_regras
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_por uuid references public.usuarios(id),
  add column if not exists ativo_antes_arquivar boolean;

create index if not exists acerto_regras_casa_arquivada_idx
  on public.acerto_regras (casa_id, arquivado_em, criada_em);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'acerto_regras_arquivada_inativa_ck'
      and conrelid = 'public.acerto_regras'::regclass
  ) then
    alter table public.acerto_regras
      add constraint acerto_regras_arquivada_inativa_ck
      check (arquivado_em is null or ativo = false);
  end if;
end;
$$;

create or replace function public.arquivar_regra_acerto(p_regra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
  v_regra public.acerto_regras%rowtype;
begin
  select casa_id into v_casa
  from public.usuarios
  where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.' using errcode = '42501';
  end if;

  select *
  into v_regra
  from public.acerto_regras
  where id = p_regra_id
    and casa_id = v_casa
  for update;

  if not found then
    raise exception 'Regra nao encontrada.' using errcode = 'P0002';
  end if;

  if v_regra.arquivado_em is not null then
    return;
  end if;

  update public.acerto_regras
  set ativo_antes_arquivar = ativo,
      ativo = false,
      arquivado_em = now(),
      arquivado_por = v_usuario,
      atualizado_em = now()
  where id = p_regra_id
    and casa_id = v_casa;

  -- Acertos já gerados permanecem intactos, inclusive os ainda em aberto.
  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_anterior, valor_novo, detalhe
  )
  values (
    'regra_acerto_arquivada',
    'acerto_regras',
    p_regra_id,
    v_usuario,
    jsonb_build_object(
      'ativo', v_regra.ativo,
      'arquivado_em', v_regra.arquivado_em
    ),
    jsonb_build_object(
      'ativo', false,
      'arquivado_em', now()
    ),
    'Regra recorrente arquivada. Acertos já gerados foram preservados.'
  );
end;
$$;

create or replace function public.restaurar_regra_acerto(p_regra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
  v_regra public.acerto_regras%rowtype;
  v_ativo_restaurado boolean;
begin
  select casa_id into v_casa
  from public.usuarios
  where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.' using errcode = '42501';
  end if;

  select *
  into v_regra
  from public.acerto_regras
  where id = p_regra_id
    and casa_id = v_casa
  for update;

  if not found then
    raise exception 'Regra nao encontrada.' using errcode = 'P0002';
  end if;

  if v_regra.arquivado_em is null then
    return;
  end if;

  v_ativo_restaurado := coalesce(v_regra.ativo_antes_arquivar, false);

  update public.acerto_regras
  set ativo = v_ativo_restaurado,
      arquivado_em = null,
      arquivado_por = null,
      ativo_antes_arquivar = null,
      atualizado_em = now()
  where id = p_regra_id
    and casa_id = v_casa;

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_anterior, valor_novo, detalhe
  )
  values (
    'regra_acerto_restaurada',
    'acerto_regras',
    p_regra_id,
    v_usuario,
    jsonb_build_object(
      'ativo', false,
      'arquivado_em', v_regra.arquivado_em
    ),
    jsonb_build_object(
      'ativo', v_ativo_restaurado,
      'arquivado_em', null
    ),
    'Regra recorrente restaurada com o status que possuía antes do arquivamento.'
  );
end;
$$;

revoke all on function public.arquivar_regra_acerto(uuid) from public, anon;
revoke all on function public.restaurar_regra_acerto(uuid) from public, anon;

grant execute on function public.arquivar_regra_acerto(uuid) to authenticated;
grant execute on function public.restaurar_regra_acerto(uuid) to authenticated;
