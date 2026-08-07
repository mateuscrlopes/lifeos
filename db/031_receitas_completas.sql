-- LIFEOS - MIGRACAO 031: RECEITAS COMPLETAS
-- Fase 3B: detalhes da receita + envio seletivo de ingredientes para compras.
-- Seguro rodar novamente.

alter table public.refeicoes
  add column if not exists tempo_minutos integer,
  add column if not exists modo_preparo text,
  add column if not exists observacoes text,
  add column if not exists fonte_url text,
  add column if not exists atualizado_em timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'refeicoes_tempo_minutos_check'
      and conrelid = 'public.refeicoes'::regclass
  ) then
    alter table public.refeicoes
      add constraint refeicoes_tempo_minutos_check
      check (tempo_minutos is null or tempo_minutos between 1 and 1440);
  end if;
end
$$;

create or replace function public.adicionar_ingredientes_receita_lista(
  p_refeicao_id uuid,
  p_usuario_id uuid,
  p_ingrediente_ids uuid[]
)
returns table (adicionados integer, ja_existiam integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_casa_id uuid;
  v_adicionados integer := 0;
  v_existentes integer := 0;
  v_ing record;
begin
  select r.casa_id into v_casa_id
  from public.refeicoes r
  where r.id = p_refeicao_id;

  if v_casa_id is null then
    raise exception 'Refeicao nao encontrada.' using errcode = 'P0002';
  end if;

  if auth.uid() is not null and not exists (
    select 1 from public.usuarios u
    where u.id = p_usuario_id
      and u.casa_id = v_casa_id
      and u.auth_id = auth.uid()
  ) then
    raise exception 'Usuario sem acesso a esta Casa.' using errcode = '42501';
  end if;

  if coalesce(array_length(p_ingrediente_ids, 1), 0) = 0 then
    return query select 0, 0;
    return;
  end if;

  for v_ing in
    select ri.id, ri.nome, ri.quantidade, ri.unidade
    from public.refeicao_ingredientes ri
    where ri.refeicao_id = p_refeicao_id
      and ri.id = any(p_ingrediente_ids)
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_casa_id::text || ':lista-receita:' || lower(trim(v_ing.nome)), 0)
    );

    if exists (
      select 1 from public.lista_compras lc
      where lc.casa_id = v_casa_id
        and lc.status = 'pendente'
        and lower(trim(lc.nome)) = lower(trim(v_ing.nome))
    ) then
      v_existentes := v_existentes + 1;
    else
      insert into public.lista_compras (
        casa_id, nome, quantidade, unidade, categoria,
        status, criado_por, origem
      ) values (
        v_casa_id, trim(v_ing.nome), v_ing.quantidade, v_ing.unidade,
        'mercado', 'pendente', p_usuario_id, 'cardapio'
      );
      v_adicionados := v_adicionados + 1;
    end if;
  end loop;

  return query select v_adicionados, v_existentes;
end;
$$;

revoke all on function public.adicionar_ingredientes_receita_lista(uuid, uuid, uuid[]) from public;
grant execute on function public.adicionar_ingredientes_receita_lista(uuid, uuid, uuid[]) to authenticated;
