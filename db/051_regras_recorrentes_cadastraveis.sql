-- LIFEOS - MIGRACAO 051: REGRAS RECORRENTES CADASTRAVEIS
-- Permite criar novas cobranças mensais pela interface e cadastra El Hub.

create or replace function public.criar_regra_acerto_recorrente(
  p_titulo text,
  p_valor numeric,
  p_devedor_id uuid,
  p_credor_id uuid,
  p_gerar_dia integer default 1,
  p_vencimento_tipo text default 'dia_mes',
  p_vencimento_valor integer default 5,
  p_inicia_em date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
  v_regra uuid;
begin
  select casa_id into v_casa
  from public.usuarios
  where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.' using errcode = '42501';
  end if;

  if coalesce(trim(p_titulo), '') = ''
     or p_valor <= 0
     or p_gerar_dia not between 1 and 28
     or p_vencimento_valor not between 1 and 28
     or p_vencimento_tipo not in ('dia_mes','dia_util')
     or p_devedor_id = p_credor_id then
    raise exception 'Configuracao invalida.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.usuarios u
    where u.id = p_devedor_id and u.casa_id = v_casa
  ) or not exists (
    select 1 from public.usuarios u
    where u.id = p_credor_id and u.casa_id = v_casa
  ) then
    raise exception 'Participantes invalidos.' using errcode = '22023';
  end if;

  insert into public.acerto_regras (
    casa_id, titulo, devedor_id, credor_id, valor, frequencia,
    gerar_dia, vencimento_tipo, vencimento_valor,
    inicia_em, ativo, criada_por
  )
  values (
    v_casa, trim(p_titulo), p_devedor_id, p_credor_id, round(p_valor, 2), 'mensal',
    p_gerar_dia, p_vencimento_tipo, p_vencimento_valor,
    coalesce(p_inicia_em, current_date), true, v_usuario
  )
  returning id into v_regra;

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
  )
  values (
    'regra_acerto_criada', 'acerto_regras', v_regra, v_usuario,
    jsonb_build_object(
      'titulo', trim(p_titulo),
      'valor', round(p_valor, 2),
      'devedor_id', p_devedor_id,
      'credor_id', p_credor_id,
      'gerar_dia', p_gerar_dia,
      'vencimento_tipo', p_vencimento_tipo,
      'vencimento_valor', p_vencimento_valor,
      'inicia_em', coalesce(p_inicia_em, current_date)
    ),
    'Regra recorrente criada na Central Financeira.'
  );

  return v_regra;
end;
$$;

revoke all on function public.criar_regra_acerto_recorrente(
  text, numeric, uuid, uuid, integer, text, integer, date
) from public, anon;

grant execute on function public.criar_regra_acerto_recorrente(
  text, numeric, uuid, uuid, integer, text, integer, date
) to authenticated;

-- El Hub: cobrança mensal de Ghustavo para Mateus.
-- O primeiro pagamento real informado ocorreu em 02/09/2026, então
-- o vencimento inicial fica no dia 2 e continua editável no aplicativo.
insert into public.acerto_regras (
  casa_id, titulo, devedor_id, credor_id, valor, frequencia,
  gerar_dia, vencimento_tipo, vencimento_valor, inicia_em, ativo, criada_por
)
select
  m.casa_id,
  'El Hub',
  g.id,
  m.id,
  184.00,
  'mensal',
  1,
  'dia_mes',
  2,
  date '2026-09-01',
  true,
  m.id
from public.usuarios m
join public.usuarios g on g.casa_id = m.casa_id
where lower(m.nome) = 'mateus'
  and lower(g.nome) = 'ghustavo'
  and not exists (
    select 1
    from public.acerto_regras r
    where r.casa_id = m.casa_id
      and lower(r.titulo) = 'el hub'
      and r.devedor_id = g.id
      and r.credor_id = m.id
  )
limit 1;

insert into public.acertos (
  casa_id, regra_id, titulo, devedor_id, credor_id, competencia,
  parcela_numero, parcelas_total, valor_devido, valor_pago,
  vencimento, status, origem, criado_por
)
select
  r.casa_id, r.id, r.titulo, r.devedor_id, r.credor_id,
  date '2026-09-01', 1, 1, r.valor, 0,
  public.lifeos_calcular_vencimento(date '2026-09-01', r.vencimento_tipo, r.vencimento_valor),
  'pendente', 'regra', r.criada_por
from public.acerto_regras r
where lower(r.titulo) = 'el hub'
  and r.inicia_em <= date '2026-09-01'
  and not exists (
    select 1 from public.acertos a
    where a.regra_id = r.id
      and a.competencia = date '2026-09-01'
  );
