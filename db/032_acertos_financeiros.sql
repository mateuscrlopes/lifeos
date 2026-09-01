-- ===================================================================
-- LIFEOS - MIGRACAO 032: ACERTOS FINANCEIROS ENTRE MORADORES
-- Separa contas externas de obrigacoes entre pessoas da Casa.
-- Inclui regras recorrentes, despesas compartilhadas, pagamentos,
-- aprovacao pelo recebedor, notificacoes e dados de recebimento.
-- ===================================================================

create table if not exists public.financeiro_recebimento_config (
  id            uuid primary key default gen_random_uuid(),
  casa_id       uuid not null references public.casa(id) on delete cascade,
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  banco         text,
  pix_tipo      text check (pix_tipo is null or pix_tipo in ('cpf','email','telefone','aleatoria','outro')),
  pix_chave     text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id)
);

create table if not exists public.acerto_regras (
  id                 uuid primary key default gen_random_uuid(),
  casa_id            uuid not null references public.casa(id) on delete cascade,
  titulo             text not null,
  devedor_id         uuid not null references public.usuarios(id),
  credor_id          uuid not null references public.usuarios(id),
  valor              numeric(12,2) not null check (valor > 0),
  frequencia         text not null default 'mensal' check (frequencia in ('mensal')),
  gerar_dia          integer not null default 1 check (gerar_dia between 1 and 28),
  vencimento_tipo    text not null default 'dia_mes' check (vencimento_tipo in ('dia_mes','dia_util')),
  vencimento_valor   integer not null default 5 check (vencimento_valor between 1 and 28),
  inicia_em          date not null default current_date,
  termina_em         date,
  ativo              boolean not null default true,
  criada_por         uuid references public.usuarios(id),
  criada_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  check (devedor_id <> credor_id)
);

create table if not exists public.despesas_compartilhadas (
  id                   uuid primary key default gen_random_uuid(),
  casa_id              uuid not null references public.casa(id) on delete cascade,
  titulo               text not null,
  valor_total          numeric(12,2) not null check (valor_total > 0),
  pago_por             uuid not null references public.usuarios(id),
  meio_pagamento       text not null default 'credit_card'
                       check (meio_pagamento in ('credit_card','pix','debit','cash','other')),
  parcelas             integer not null default 1 check (parcelas between 1 and 60),
  primeiro_vencimento  date not null,
  origem               text not null default 'manual'
                       check (origem in ('manual','nordestrip','outro')),
  origem_externa_id    text,
  origem_url           text,
  observacoes          text,
  criada_por           uuid references public.usuarios(id),
  criada_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create unique index if not exists despesas_compartilhadas_origem_uq
  on public.despesas_compartilhadas (casa_id, origem, origem_externa_id)
  where origem_externa_id is not null;

create table if not exists public.despesa_compartilhada_partes (
  id          uuid primary key default gen_random_uuid(),
  despesa_id  uuid not null references public.despesas_compartilhadas(id) on delete cascade,
  usuario_id  uuid not null references public.usuarios(id),
  valor       numeric(12,2) not null check (valor >= 0),
  percentual  numeric(7,4),
  criada_em   timestamptz not null default now(),
  unique (despesa_id, usuario_id)
);

create table if not exists public.acertos (
  id                  uuid primary key default gen_random_uuid(),
  casa_id             uuid not null references public.casa(id) on delete cascade,
  regra_id            uuid references public.acerto_regras(id) on delete set null,
  despesa_id          uuid references public.despesas_compartilhadas(id) on delete set null,
  titulo              text not null,
  devedor_id          uuid not null references public.usuarios(id),
  credor_id           uuid not null references public.usuarios(id),
  competencia         date,
  parcela_numero      integer not null default 1 check (parcela_numero >= 1),
  parcelas_total      integer not null default 1 check (parcelas_total >= 1),
  valor_devido        numeric(12,2) not null check (valor_devido > 0),
  valor_pago          numeric(12,2) not null default 0 check (valor_pago >= 0),
  vencimento          date not null,
  status              text not null default 'pendente'
                      check (status in ('pendente','parcial','pago','vencido','cancelado')),
  origem              text not null default 'manual'
                      check (origem in ('manual','regra','nordestrip','outro')),
  origem_externa_id   text,
  criado_por          uuid references public.usuarios(id),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (devedor_id <> credor_id),
  check (valor_pago <= valor_devido)
);

create index if not exists acertos_casa_status_venc_idx
  on public.acertos (casa_id, status, vencimento);

create index if not exists acertos_pessoas_idx
  on public.acertos (casa_id, devedor_id, credor_id, vencimento);

create unique index if not exists acertos_regra_competencia_uq
  on public.acertos (regra_id, competencia)
  where regra_id is not null;

create unique index if not exists acertos_origem_parcela_uq
  on public.acertos (casa_id, origem, origem_externa_id, devedor_id, parcela_numero)
  where origem_externa_id is not null;

create table if not exists public.acerto_pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  casa_id             uuid not null references public.casa(id) on delete cascade,
  acerto_id           uuid not null references public.acertos(id) on delete cascade,
  enviado_por         uuid not null references public.usuarios(id),
  valor_informado     numeric(12,2) not null check (valor_informado > 0),
  valor_extraido      numeric(12,2),
  pago_em_extraido    timestamptz,
  arquivo_nome        text,
  comprovante_path    text,
  dados_extraidos     jsonb not null default '{}'::jsonb,
  status              text not null default 'aguardando_confirmacao'
                      check (status in ('aguardando_confirmacao','aprovado','recusado')),
  revisado_por        uuid references public.usuarios(id),
  revisado_em         timestamptz,
  motivo_recusa       text,
  enviado_em          timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index if not exists acerto_pagamentos_acerto_idx
  on public.acerto_pagamentos (acerto_id, enviado_em desc);

create table if not exists public.notificacoes (
  id             uuid primary key default gen_random_uuid(),
  casa_id        uuid not null references public.casa(id) on delete cascade,
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  tipo           text not null,
  titulo         text not null,
  mensagem       text,
  entidade       text,
  entidade_id    uuid,
  lida           boolean not null default false,
  criada_em      timestamptz not null default now(),
  lida_em        timestamptz
);

create index if not exists notificacoes_usuario_lida_idx
  on public.notificacoes (usuario_id, lida, criada_em desc);

-- -------------------------------------------------------------------
-- Contexto autenticado e seguranca por Casa
-- -------------------------------------------------------------------

create or replace function public.lifeos_usuario_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1;
$$;

create or replace function public.lifeos_usuario_na_casa(p_casa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_id = auth.uid()
      and u.casa_id = p_casa_id
  );
$$;

revoke all on function public.lifeos_usuario_atual_id() from public;
revoke all on function public.lifeos_usuario_na_casa(uuid) from public;
grant execute on function public.lifeos_usuario_atual_id() to authenticated;
grant execute on function public.lifeos_usuario_na_casa(uuid) to authenticated;

alter table public.financeiro_recebimento_config enable row level security;
alter table public.acerto_regras enable row level security;
alter table public.despesas_compartilhadas enable row level security;
alter table public.despesa_compartilhada_partes enable row level security;
alter table public.acertos enable row level security;
alter table public.acerto_pagamentos enable row level security;
alter table public.notificacoes enable row level security;

drop policy if exists financeiro_recebimento_ler on public.financeiro_recebimento_config;
create policy financeiro_recebimento_ler
  on public.financeiro_recebimento_config for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists financeiro_recebimento_inserir on public.financeiro_recebimento_config;
create policy financeiro_recebimento_inserir
  on public.financeiro_recebimento_config for insert to authenticated
  with check (
    public.lifeos_usuario_na_casa(casa_id)
    and usuario_id = public.lifeos_usuario_atual_id()
  );

drop policy if exists financeiro_recebimento_atualizar on public.financeiro_recebimento_config;
create policy financeiro_recebimento_atualizar
  on public.financeiro_recebimento_config for update to authenticated
  using (usuario_id = public.lifeos_usuario_atual_id())
  with check (usuario_id = public.lifeos_usuario_atual_id());

drop policy if exists acerto_regras_ler on public.acerto_regras;
create policy acerto_regras_ler
  on public.acerto_regras for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists acerto_regras_inserir on public.acerto_regras;
create policy acerto_regras_inserir
  on public.acerto_regras for insert to authenticated
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists acerto_regras_atualizar on public.acerto_regras;
create policy acerto_regras_atualizar
  on public.acerto_regras for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists despesas_compartilhadas_ler on public.despesas_compartilhadas;
create policy despesas_compartilhadas_ler
  on public.despesas_compartilhadas for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists despesas_compartilhadas_inserir on public.despesas_compartilhadas;
create policy despesas_compartilhadas_inserir
  on public.despesas_compartilhadas for insert to authenticated
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists despesa_partes_ler on public.despesa_compartilhada_partes;
create policy despesa_partes_ler
  on public.despesa_compartilhada_partes for select to authenticated
  using (exists (
    select 1 from public.despesas_compartilhadas d
    where d.id = despesa_id
      and public.lifeos_usuario_na_casa(d.casa_id)
  ));

drop policy if exists acertos_ler on public.acertos;
create policy acertos_ler
  on public.acertos for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists pagamentos_ler on public.acerto_pagamentos;
create policy pagamentos_ler
  on public.acerto_pagamentos for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists notificacoes_ler on public.notificacoes;
create policy notificacoes_ler
  on public.notificacoes for select to authenticated
  using (usuario_id = public.lifeos_usuario_atual_id());

drop policy if exists notificacoes_atualizar on public.notificacoes;
create policy notificacoes_atualizar
  on public.notificacoes for update to authenticated
  using (usuario_id = public.lifeos_usuario_atual_id())
  with check (usuario_id = public.lifeos_usuario_atual_id());

grant select, insert, update on public.financeiro_recebimento_config to authenticated;
grant select, insert, update on public.acerto_regras to authenticated;
grant select on public.despesas_compartilhadas to authenticated;
grant select on public.despesa_compartilhada_partes to authenticated;
grant select on public.acertos to authenticated;
grant select on public.acerto_pagamentos to authenticated;
grant select, update on public.notificacoes to authenticated;

-- -------------------------------------------------------------------
-- Datas de vencimento recorrente
-- -------------------------------------------------------------------

create or replace function public.lifeos_feriado_nacional_fixo(p_data date)
returns boolean
language sql
immutable
as $$
  select to_char(p_data, 'MM-DD') in (
    '01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'
  );
$$;

create or replace function public.lifeos_calcular_vencimento(
  p_competencia date,
  p_tipo text,
  p_valor integer
)
returns date
language plpgsql
immutable
as $$
declare
  v_inicio date := date_trunc('month', p_competencia)::date;
  v_fim date := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;
  v_data date;
  v_contagem integer := 0;
begin
  if p_tipo = 'dia_mes' then
    return least(v_inicio + (greatest(1, p_valor) - 1), v_fim);
  end if;

  v_data := v_inicio;
  loop
    if extract(isodow from v_data) between 1 and 5
       and not public.lifeos_feriado_nacional_fixo(v_data) then
      v_contagem := v_contagem + 1;
      if v_contagem >= greatest(1, p_valor) then
        return v_data;
      end if;
    end if;

    v_data := v_data + 1;
    if v_data > v_fim then
      return v_fim;
    end if;
  end loop;
end;
$$;

-- -------------------------------------------------------------------
-- Gera as contribuicoes recorrentes do mes quando o LifeOS e aberto.
-- Idempotente: a mesma regra/competencia nunca e criada duas vezes.
-- -------------------------------------------------------------------

create or replace function public.gerar_acertos_recorrentes(p_data date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
  v_mes date := date_trunc('month', p_data)::date;
  v_regra record;
  v_criados integer := 0;
begin
  select casa_id into v_casa
  from public.usuarios
  where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.'
      using errcode = '42501';
  end if;

  for v_regra in
    select *
    from public.acerto_regras r
    where r.casa_id = v_casa
      and r.ativo
      and r.frequencia = 'mensal'
      and r.inicia_em <= (v_mes + interval '1 month - 1 day')::date
      and (r.termina_em is null or r.termina_em >= v_mes)
      and extract(day from p_data)::integer >= r.gerar_dia
  loop
    if not exists (
      select 1
      from public.acertos a
      where a.regra_id = v_regra.id
        and a.competencia = v_mes
    ) then
      insert into public.acertos (
        casa_id, regra_id, titulo, devedor_id, credor_id, competencia,
        parcela_numero, parcelas_total, valor_devido, vencimento,
        status, origem, criado_por
      )
      values (
        v_regra.casa_id, v_regra.id, v_regra.titulo,
        v_regra.devedor_id, v_regra.credor_id, v_mes,
        1, 1, v_regra.valor,
        public.lifeos_calcular_vencimento(v_mes, v_regra.vencimento_tipo, v_regra.vencimento_valor),
        'pendente', 'regra', v_usuario
      );

      v_criados := v_criados + 1;
    end if;
  end loop;

  return v_criados;
end;
$$;

revoke all on function public.gerar_acertos_recorrentes(date) from public;
grant execute on function public.gerar_acertos_recorrentes(date) to authenticated;

-- -------------------------------------------------------------------
-- Cria uma despesa compartilhada e suas obrigacoes parceladas.
-- p_partes = [{"usuario_id":"uuid","valor":100.00}, ...]
-- -------------------------------------------------------------------

create or replace function public.criar_despesa_compartilhada(
  p_titulo text,
  p_valor_total numeric,
  p_pago_por uuid,
  p_partes jsonb,
  p_parcelas integer default 1,
  p_primeiro_vencimento date default current_date,
  p_meio_pagamento text default 'credit_card',
  p_origem text default 'manual',
  p_origem_externa_id text default null,
  p_origem_url text default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_casa uuid;
  v_despesa uuid;
  v_parte record;
  v_soma numeric(12,2);
  v_total_parte numeric(12,2);
  v_base numeric(12,2);
  v_valor_parcela numeric(12,2);
  v_indice integer;
begin
  select casa_id into v_casa from public.usuarios where id = v_usuario;

  if v_usuario is null or v_casa is null then
    raise exception 'Usuario autenticado nao encontrado.' using errcode = '42501';
  end if;

  if coalesce(trim(p_titulo), '') = '' or p_valor_total <= 0 then
    raise exception 'Titulo e valor sao obrigatorios.' using errcode = '22023';
  end if;

  if p_parcelas < 1 or p_parcelas > 60 then
    raise exception 'Quantidade de parcelas invalida.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.usuarios u
    where u.id = p_pago_por and u.casa_id = v_casa
  ) then
    raise exception 'Pagador nao pertence a esta Casa.' using errcode = '42501';
  end if;

  select round(coalesce(sum((item->>'valor')::numeric), 0), 2)
    into v_soma
  from jsonb_array_elements(coalesce(p_partes, '[]'::jsonb)) item;

  if abs(v_soma - round(p_valor_total, 2)) > 0.01 then
    raise exception 'A divisao precisa somar o valor total da despesa.' using errcode = '22023';
  end if;

  for v_parte in
    select
      (item->>'usuario_id')::uuid as usuario_id,
      round((item->>'valor')::numeric, 2) as valor
    from jsonb_array_elements(coalesce(p_partes, '[]'::jsonb)) item
  loop
    if not exists (
      select 1 from public.usuarios u
      where u.id = v_parte.usuario_id and u.casa_id = v_casa
    ) then
      raise exception 'Participante nao pertence a esta Casa.' using errcode = '42501';
    end if;
  end loop;

  insert into public.despesas_compartilhadas (
    casa_id, titulo, valor_total, pago_por, meio_pagamento, parcelas,
    primeiro_vencimento, origem, origem_externa_id, origem_url,
    observacoes, criada_por
  )
  values (
    v_casa, trim(p_titulo), round(p_valor_total, 2), p_pago_por,
    p_meio_pagamento, p_parcelas, p_primeiro_vencimento,
    coalesce(p_origem, 'manual'), p_origem_externa_id, p_origem_url,
    p_observacoes, v_usuario
  )
  returning id into v_despesa;

  for v_parte in
    select
      (item->>'usuario_id')::uuid as usuario_id,
      round((item->>'valor')::numeric, 2) as valor
    from jsonb_array_elements(p_partes) item
  loop
    insert into public.despesa_compartilhada_partes (
      despesa_id, usuario_id, valor, percentual
    )
    values (
      v_despesa,
      v_parte.usuario_id,
      v_parte.valor,
      case when p_valor_total > 0
        then round((v_parte.valor / p_valor_total) * 100, 4)
        else null end
    );

    if v_parte.usuario_id <> p_pago_por and v_parte.valor > 0 then
      v_total_parte := v_parte.valor;
      v_base := round(v_total_parte / p_parcelas, 2);

      for v_indice in 1..p_parcelas loop
        if v_indice = p_parcelas then
          v_valor_parcela := round(v_total_parte - (v_base * (p_parcelas - 1)), 2);
        else
          v_valor_parcela := v_base;
        end if;

        insert into public.acertos (
          casa_id, despesa_id, titulo, devedor_id, credor_id,
          competencia, parcela_numero, parcelas_total, valor_devido,
          vencimento, status, origem, origem_externa_id, criado_por
        )
        values (
          v_casa, v_despesa, trim(p_titulo),
          v_parte.usuario_id, p_pago_por,
          date_trunc('month', (p_primeiro_vencimento + ((v_indice - 1) || ' month')::interval))::date,
          v_indice, p_parcelas, v_valor_parcela,
          (p_primeiro_vencimento + ((v_indice - 1) || ' month')::interval)::date,
          'pendente',
          case when p_origem = 'nordestrip' then 'nordestrip' else 'manual' end,
          case when p_origem_externa_id is null then null
               else p_origem_externa_id || ':p' || v_indice::text end,
          v_usuario
        );
      end loop;
    end if;
  end loop;

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
  )
  values (
    'despesa_compartilhada_criada', 'despesas_compartilhadas', v_despesa,
    v_usuario,
    jsonb_build_object('titulo', p_titulo, 'valor_total', p_valor_total, 'parcelas', p_parcelas),
    'Despesa compartilhada criada na Central Financeira.'
  );

  return v_despesa;
end;
$$;

revoke all on function public.criar_despesa_compartilhada(
  text, numeric, uuid, jsonb, integer, date, text, text, text, text, text
) from public;

grant execute on function public.criar_despesa_compartilhada(
  text, numeric, uuid, jsonb, integer, date, text, text, text, text, text
) to authenticated;

-- -------------------------------------------------------------------
-- Aprova ou recusa um pagamento. Somente o credor pode revisar.
-- -------------------------------------------------------------------

create or replace function public.revisar_pagamento_acerto(
  p_pagamento_id uuid,
  p_aprovar boolean,
  p_motivo text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := public.lifeos_usuario_atual_id();
  v_pagamento public.acerto_pagamentos%rowtype;
  v_acerto public.acertos%rowtype;
  v_pago numeric(12,2);
  v_status text;
begin
  select * into v_pagamento
  from public.acerto_pagamentos
  where id = p_pagamento_id
  for update;

  if not found then
    raise exception 'Pagamento nao encontrado.' using errcode = 'P0002';
  end if;

  select * into v_acerto
  from public.acertos
  where id = v_pagamento.acerto_id
  for update;

  if v_usuario is null or v_acerto.credor_id <> v_usuario then
    raise exception 'Somente o recebedor pode confirmar este pagamento.'
      using errcode = '42501';
  end if;

  if v_pagamento.status <> 'aguardando_confirmacao' then
    return v_pagamento.status;
  end if;

  if p_aprovar then
    select round(coalesce(sum(valor_informado), 0), 2)
      into v_pago
    from public.acerto_pagamentos
    where acerto_id = v_acerto.id
      and status = 'aprovado';

    v_pago := round(v_pago + v_pagamento.valor_informado, 2);

    if v_pago > v_acerto.valor_devido + 0.01 then
      raise exception 'O pagamento ultrapassa o saldo do acerto.'
        using errcode = '22023';
    end if;

    update public.acerto_pagamentos
    set status = 'aprovado',
        revisado_por = v_usuario,
        revisado_em = now(),
        motivo_recusa = null,
        atualizado_em = now()
    where id = p_pagamento_id;

    v_status := case
      when v_pago >= v_acerto.valor_devido - 0.01 then 'pago'
      else 'parcial'
    end;

    update public.acertos
    set valor_pago = least(v_pago, valor_devido),
        status = v_status,
        atualizado_em = now()
    where id = v_acerto.id;

    insert into public.notificacoes (
      casa_id, usuario_id, tipo, titulo, mensagem, entidade, entidade_id
    )
    values (
      v_acerto.casa_id,
      v_acerto.devedor_id,
      'pagamento_aprovado',
      'Pagamento confirmado',
      'O recebedor confirmou seu pagamento de R$ ' ||
        trim(to_char(v_pagamento.valor_informado, 'FM999G999G990D00')) || '.',
      'acerto_pagamentos',
      v_pagamento.id
    );

    insert into public.eventos (
      tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
    )
    values (
      'pagamento_acerto_aprovado', 'acerto_pagamentos', v_pagamento.id,
      v_usuario,
      jsonb_build_object('acerto_id', v_acerto.id, 'valor', v_pagamento.valor_informado, 'status_acerto', v_status),
      'Pagamento aprovado pelo recebedor.'
    );

    return v_status;
  end if;

  update public.acerto_pagamentos
  set status = 'recusado',
      revisado_por = v_usuario,
      revisado_em = now(),
      motivo_recusa = nullif(trim(coalesce(p_motivo, '')), ''),
      atualizado_em = now()
  where id = p_pagamento_id;

  insert into public.notificacoes (
    casa_id, usuario_id, tipo, titulo, mensagem, entidade, entidade_id
  )
  values (
    v_acerto.casa_id,
    v_acerto.devedor_id,
    'pagamento_recusado',
    'Pagamento precisa ser revisto',
    coalesce(nullif(trim(p_motivo), ''), 'O recebedor nao confirmou o pagamento enviado.'),
    'acerto_pagamentos',
    v_pagamento.id
  );

  insert into public.eventos (
    tipo, entidade, entidade_id, usuario_id, valor_novo, detalhe
  )
  values (
    'pagamento_acerto_recusado', 'acerto_pagamentos', v_pagamento.id,
    v_usuario,
    jsonb_build_object('acerto_id', v_acerto.id, 'motivo', p_motivo),
    'Pagamento recusado pelo recebedor.'
  );

  return 'recusado';
end;
$$;

revoke all on function public.revisar_pagamento_acerto(uuid, boolean, text) from public;
grant execute on function public.revisar_pagamento_acerto(uuid, boolean, text) to authenticated;

-- -------------------------------------------------------------------
-- Regra inicial combinada: contribuicao mensal de Ghustavo para Mateus.
-- Configuravel no aplicativo; nenhuma chave Pix e gravada no codigo.
-- -------------------------------------------------------------------

insert into public.acerto_regras (
  casa_id, titulo, devedor_id, credor_id, valor, frequencia,
  gerar_dia, vencimento_tipo, vencimento_valor, inicia_em, ativo
)
select
  m.casa_id,
  'Contribuição da Casa',
  g.id,
  m.id,
  500.00,
  'mensal',
  1,
  'dia_util',
  5,
  date '2026-09-01',
  true
from public.usuarios m
join public.usuarios g on g.casa_id = m.casa_id
where lower(m.nome) = 'mateus'
  and lower(g.nome) = 'ghustavo'
  and not exists (
    select 1
    from public.acerto_regras r
    where r.casa_id = m.casa_id
      and r.titulo = 'Contribuição da Casa'
      and r.devedor_id = g.id
      and r.credor_id = m.id
  )
limit 1;

insert into public.acertos (
  casa_id, regra_id, titulo, devedor_id, credor_id, competencia,
  parcela_numero, parcelas_total, valor_devido, vencimento,
  status, origem
)
select
  r.casa_id, r.id, r.titulo, r.devedor_id, r.credor_id,
  date '2026-09-01', 1, 1, r.valor,
  public.lifeos_calcular_vencimento(date '2026-09-01', r.vencimento_tipo, r.vencimento_valor),
  'pendente', 'regra'
from public.acerto_regras r
where r.titulo = 'Contribuição da Casa'
  and r.inicia_em <= date '2026-09-01'
  and not exists (
    select 1 from public.acertos a
    where a.regra_id = r.id
      and a.competencia = date '2026-09-01'
  );

-- Atualiza status vencido dinamicamente apenas quando necessario por consulta/UI.
