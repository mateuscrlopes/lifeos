-- ===================================================================
-- LIFEOS - MIGRACAO 063: CONTRIBUICOES DA CASA
-- Regras de contribuição são da Casa e não geram Acertos pessoais.
-- Mantém histórico por vigência e permite valor fixo, percentual ou restante.
-- ===================================================================

alter table public.contas
  add column if not exists entra_contribuicao_casa boolean not null default true;

create table if not exists public.financeiro_casa_contribuicao_regras (
  id           uuid primary key default gen_random_uuid(),
  casa_id      uuid not null references public.casa(id) on delete cascade,
  usuario_id   uuid not null references public.usuarios(id) on delete cascade,
  tipo         text not null check (tipo in ('fixa','percentual','restante')),
  valor        numeric(12,2),
  percentual   numeric(7,4),
  inicio       date not null,
  fim          date,
  observacoes  text,
  criado_por   uuid references public.usuarios(id) on delete set null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint financeiro_casa_contribuicao_regra_valores_ck check (
    (tipo = 'fixa' and valor is not null and valor >= 0 and percentual is null)
    or
    (tipo = 'percentual' and percentual is not null and percentual >= 0 and percentual <= 100 and valor is null)
    or
    (tipo = 'restante' and valor is null and percentual is null)
  ),
  constraint financeiro_casa_contribuicao_regra_datas_ck check (fim is null or fim >= inicio)
);

create index if not exists financeiro_casa_contribuicao_regras_casa_idx
  on public.financeiro_casa_contribuicao_regras (casa_id, inicio desc);

create index if not exists financeiro_casa_contribuicao_regras_usuario_idx
  on public.financeiro_casa_contribuicao_regras (usuario_id, inicio desc);

create unique index if not exists financeiro_casa_contribuicao_regra_aberta_uidx
  on public.financeiro_casa_contribuicao_regras (usuario_id)
  where fim is null;

alter table public.financeiro_casa_contribuicao_regras enable row level security;

drop policy if exists financeiro_casa_contribuicao_regras_ler
  on public.financeiro_casa_contribuicao_regras;
create policy financeiro_casa_contribuicao_regras_ler
  on public.financeiro_casa_contribuicao_regras
  for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists financeiro_casa_contribuicao_regras_inserir
  on public.financeiro_casa_contribuicao_regras;
create policy financeiro_casa_contribuicao_regras_inserir
  on public.financeiro_casa_contribuicao_regras
  for insert to authenticated
  with check (
    public.lifeos_usuario_na_casa(casa_id)
    and exists (
      select 1
      from public.usuarios u
      where u.id = usuario_id
        and u.casa_id = casa_id
        and lower(trim(u.nome)) <> 'casa'
    )
  );

drop policy if exists financeiro_casa_contribuicao_regras_atualizar
  on public.financeiro_casa_contribuicao_regras;
create policy financeiro_casa_contribuicao_regras_atualizar
  on public.financeiro_casa_contribuicao_regras
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));

grant select, insert, update on public.financeiro_casa_contribuicao_regras to authenticated;

create or replace function public.lifeos_definir_contribuicao_casa(
  p_usuario_id uuid,
  p_tipo text,
  p_valor numeric default null,
  p_percentual numeric default null,
  p_inicio date default current_date,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_casa_id uuid;
  v_atual_id uuid;
  v_inicio date := coalesce(p_inicio, current_date);
begin
  select u.casa_id into v_casa_id
  from public.usuarios u
  where u.id = p_usuario_id
    and lower(trim(u.nome)) <> 'casa';

  if v_casa_id is null or not public.lifeos_usuario_na_casa(v_casa_id) then
    raise exception 'Usuario fora da Casa';
  end if;

  if p_tipo not in ('fixa','percentual','restante') then
    raise exception 'Tipo de contribuicao invalido';
  end if;

  if p_tipo = 'fixa' and (p_valor is null or p_valor < 0) then
    raise exception 'Valor fixo invalido';
  end if;

  if p_tipo = 'percentual' and (p_percentual is null or p_percentual < 0 or p_percentual > 100) then
    raise exception 'Percentual invalido';
  end if;

  -- Regras futuras ainda não iniciadas são substituídas, sem apagar histórico já vigente.
  delete from public.financeiro_casa_contribuicao_regras r
  where r.usuario_id = p_usuario_id
    and r.inicio >= v_inicio
    and r.inicio > current_date;

  update public.financeiro_casa_contribuicao_regras r
     set fim = v_inicio - 1,
         atualizado_em = now()
   where r.usuario_id = p_usuario_id
     and r.inicio < v_inicio
     and (r.fim is null or r.fim >= v_inicio);

  select r.id into v_atual_id
  from public.financeiro_casa_contribuicao_regras r
  where r.usuario_id = p_usuario_id
    and r.inicio = v_inicio
  order by r.criado_em desc
  limit 1;

  if v_atual_id is not null then
    update public.financeiro_casa_contribuicao_regras
       set tipo = p_tipo,
           valor = case when p_tipo = 'fixa' then p_valor else null end,
           percentual = case when p_tipo = 'percentual' then p_percentual else null end,
           observacoes = nullif(trim(coalesce(p_observacoes,'')), ''),
           fim = null,
           atualizado_em = now()
     where id = v_atual_id;
    return v_atual_id;
  end if;

  insert into public.financeiro_casa_contribuicao_regras (
    casa_id, usuario_id, tipo, valor, percentual, inicio, observacoes, criado_por
  )
  values (
    v_casa_id,
    p_usuario_id,
    p_tipo,
    case when p_tipo = 'fixa' then p_valor else null end,
    case when p_tipo = 'percentual' then p_percentual else null end,
    v_inicio,
    nullif(trim(coalesce(p_observacoes,'')), ''),
    public.lifeos_usuario_atual_id()
  )
  returning id into v_atual_id;

  return v_atual_id;
end;
$$;

revoke all on function public.lifeos_definir_contribuicao_casa(uuid,text,numeric,numeric,date,text) from public;
grant execute on function public.lifeos_definir_contribuicao_casa(uuid,text,numeric,numeric,date,text) to authenticated;

create or replace function public.lifeos_contribuicoes_casa_mes(p_competencia date default current_date)
returns table (
  usuario_id uuid,
  nome text,
  regra_id uuid,
  tipo text,
  valor_regra numeric,
  percentual_regra numeric,
  base_contas numeric,
  contribuicao_prevista numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with parametros as (
    select
      date_trunc('month', coalesce(p_competencia,current_date))::date as inicio_mes,
      (date_trunc('month', coalesce(p_competencia,current_date)) + interval '1 month - 1 day')::date as fim_mes,
      public.lifeos_usuario_atual_id() as usuario_atual
  ),
  casa_atual as (
    select u.casa_id
    from public.usuarios u, parametros p
    where u.id = p.usuario_atual
  ),
  base as (
    select coalesce(sum(c.valor),0)::numeric as valor
    from public.contas c, parametros p, casa_atual ca
    where c.casa_id = ca.casa_id
      and c.entra_contribuicao_casa = true
      and c.vencimento between p.inicio_mes and p.fim_mes
  ),
  moradores as (
    select u.id, u.nome
    from public.usuarios u, casa_atual ca
    where u.casa_id = ca.casa_id
      and lower(trim(u.nome)) <> 'casa'
  ),
  regra as (
    select distinct on (m.id)
      m.id as usuario_id,
      m.nome,
      r.id as regra_id,
      r.tipo,
      r.valor,
      r.percentual
    from moradores m
    left join parametros p on true
    left join public.financeiro_casa_contribuicao_regras r
      on r.usuario_id = m.id
     and r.inicio <= p.fim_mes
     and (r.fim is null or r.fim >= p.inicio_mes)
    order by m.id, r.inicio desc nulls last, r.criado_em desc nulls last
  ),
  valores_diretos as (
    select
      r.*,
      b.valor as base_contas,
      case
        when r.tipo = 'fixa' then coalesce(r.valor,0)
        when r.tipo = 'percentual' then round(b.valor * coalesce(r.percentual,0) / 100.0, 2)
        else 0
      end::numeric as direto
    from regra r cross join base b
  ),
  totais as (
    select
      coalesce(sum(direto),0)::numeric as soma_direta,
      count(*) filter (where tipo = 'restante')::numeric as qtd_restante
    from valores_diretos
  )
  select
    v.usuario_id,
    v.nome,
    v.regra_id,
    v.tipo,
    v.valor,
    v.percentual,
    v.base_contas,
    case
      when v.tipo = 'restante' and t.qtd_restante > 0
        then round(greatest(v.base_contas - t.soma_direta,0) / t.qtd_restante, 2)
      else v.direto
    end::numeric as contribuicao_prevista
  from valores_diretos v cross join totais t
  order by v.nome;
$$;

revoke all on function public.lifeos_contribuicoes_casa_mes(date) from public;
grant execute on function public.lifeos_contribuicoes_casa_mes(date) to authenticated;
