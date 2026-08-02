-- ===================================================================
-- LIFEOS - MIGRACAO 013: MODULO PLANTAS
-- Estrutura: especies, plantas, planta_rotinas, planta_eventos, planta_fotos
-- Dados iniciais: 23 especies e 40 plantas reais de Mateus
-- Seguro rodar de novo (usa IF NOT EXISTS e WHERE NOT EXISTS)
-- ===================================================================

-- -------------------------------------------------------------------
-- TABELA: especies
-- Conhecimento compartilhado sobre cada tipo de planta.
-- Serve como padrao; cada planta individual pode sobrescrever.
-- -------------------------------------------------------------------
create table if not exists especies (
  id                    uuid primary key default gen_random_uuid(),
  casa_id               uuid references casa(id),
  nome_popular          text not null,
  nome_cientifico       text,
  perfil_hidrico        text not null default 'medio',  -- 'alto' | 'medio' | 'baixo'
  metodo_cultivo        text not null default 'substrato', -- 'substrato' | 'agua' | 'kokedama'
  rotina_principal      text,          -- titulo padrao da rotina, ex.: 'Verificar e regar'
  intervalo_dias        integer,       -- intervalo padrao em dias
  observacoes           text,
  criado_em             timestamptz not null default now()
);

create index if not exists especies_casa_idx on especies (casa_id);

-- -------------------------------------------------------------------
-- TABELA: plantas
-- Cada individuo. Codigo permanente (PL-001, PL-002...).
-- -------------------------------------------------------------------
create table if not exists plantas (
  id                uuid primary key default gen_random_uuid(),
  casa_id           uuid references casa(id),
  codigo            text not null unique,        -- ex.: 'PL-001'
  numero_etiqueta   integer not null unique,     -- ex.: 1
  especie_id        uuid references especies(id),
  nome_personalizado text,                       -- apelido opcional
  status            text not null default 'ativa', -- 'ativa' | 'em_recuperacao' | 'falecida' | 'doada'
  comodo            text,                        -- ex.: 'Sala', 'Cozinha'
  posicao           text,                        -- ex.: 'Mesa de plantas', 'Chao'
  metodo_cultivo    text not null default 'substrato',
  perfil_hidrico    text not null default 'medio',
  cor_etiqueta      text,                        -- 'verde' | 'laranja' | 'azul' | null
  origem            text,                        -- ex.: 'comprada', 'muda', 'presente'
  data_aquisicao    date,
  data_cadastro     date not null default current_date,
  planta_origem_id  uuid references plantas(id), -- se veio de muda de outra planta
  observacoes       text,
  criado_por        uuid references usuarios(id),
  criado_em         timestamptz not null default now()
);

create index if not exists plantas_casa_idx on plantas (casa_id, status);
create index if not exists plantas_especie_idx on plantas (especie_id);

-- -------------------------------------------------------------------
-- TABELA: planta_rotinas
-- Cada planta pode ter uma ou mais rotinas de cuidado.
-- Gera tarefas no modulo de tarefas existente.
-- -------------------------------------------------------------------
create table if not exists planta_rotinas (
  id                uuid primary key default gen_random_uuid(),
  planta_id         uuid references plantas(id) on delete cascade,
  tipo              text not null,     -- 'Verificar e regar' | 'Trocar a água' | 'Fazer imersão' | 'Adubação' | 'Poda' etc.
  intervalo_dias    integer not null,
  ultima_realizacao date,
  proxima_realizacao date,
  responsavel       text default 'ambos',
  ativa             boolean not null default true,
  observacoes       text,
  criado_em         timestamptz not null default now()
);

create index if not exists rotinas_planta_idx on planta_rotinas (planta_id, ativa);
create index if not exists rotinas_proxima_idx on planta_rotinas (proxima_realizacao) where ativa = true;

-- -------------------------------------------------------------------
-- TABELA: planta_eventos
-- Linha do tempo de cada planta. Tudo que aconteceu fica aqui.
-- -------------------------------------------------------------------
create table if not exists planta_eventos (
  id              uuid primary key default gen_random_uuid(),
  planta_id       uuid references plantas(id) on delete cascade,
  tipo            text not null,
  -- tipos: cadastro | rega | troca_agua | imersao | adubacao | poda |
  --        limpeza_folhas | troca_vaso | mudanca_local | alteracao_status |
  --        observacao | muda_retirada | falecimento | doacao
  data            timestamptz not null default now(),
  notas           text,
  usuario_id      uuid references usuarios(id),
  tarefa_id       uuid references tarefas(id), -- quando veio de conclusao de tarefa
  planta_muda_id  uuid references plantas(id)  -- para registrar muda gerada
);

create index if not exists eventos_planta_idx on planta_eventos (planta_id, data desc);

-- -------------------------------------------------------------------
-- TABELA: planta_fotos
-- Galeria. Criada agora; interface de upload vem depois.
-- -------------------------------------------------------------------
create table if not exists planta_fotos (
  id          uuid primary key default gen_random_uuid(),
  planta_id   uuid references plantas(id) on delete cascade,
  url         text not null,
  legenda     text,
  principal   boolean not null default false,
  data        timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- CAMPO planta_id e rotina_id nas tarefas (para integracao)
-- -------------------------------------------------------------------
alter table tarefas add column if not exists planta_id  uuid references plantas(id);
alter table tarefas add column if not exists rotina_id  uuid references planta_rotinas(id);

-- -------------------------------------------------------------------
-- RLS — todas as tabelas compartilhadas da Casa
-- -------------------------------------------------------------------
alter table especies       enable row level security;
alter table plantas        enable row level security;
alter table planta_rotinas enable row level security;
alter table planta_eventos enable row level security;
alter table planta_fotos   enable row level security;

-- Especies
drop policy if exists esp_ler on especies;
create policy esp_ler on especies for select to authenticated using (true);
drop policy if exists esp_ins on especies;
create policy esp_ins on especies for insert to authenticated with check (true);
drop policy if exists esp_upd on especies;
create policy esp_upd on especies for update to authenticated using (true);
drop policy if exists esp_del on especies;
create policy esp_del on especies for delete to authenticated using (true);

-- Plantas
drop policy if exists pla_ler on plantas;
create policy pla_ler on plantas for select to authenticated using (true);
drop policy if exists pla_ins on plantas;
create policy pla_ins on plantas for insert to authenticated with check (true);
drop policy if exists pla_upd on plantas;
create policy pla_upd on plantas for update to authenticated using (true);
drop policy if exists pla_del on plantas;
create policy pla_del on plantas for delete to authenticated using (true);

-- Rotinas
drop policy if exists rot_ler on planta_rotinas;
create policy rot_ler on planta_rotinas for select to authenticated using (true);
drop policy if exists rot_ins on planta_rotinas;
create policy rot_ins on planta_rotinas for insert to authenticated with check (true);
drop policy if exists rot_upd on planta_rotinas;
create policy rot_upd on planta_rotinas for update to authenticated using (true);
drop policy if exists rot_del on planta_rotinas;
create policy rot_del on planta_rotinas for delete to authenticated using (true);

-- Eventos
drop policy if exists ev_ler on planta_eventos;
create policy ev_ler on planta_eventos for select to authenticated using (true);
drop policy if exists ev_ins on planta_eventos;
create policy ev_ins on planta_eventos for insert to authenticated with check (true);

-- Fotos
drop policy if exists fot_ler on planta_fotos;
create policy fot_ler on planta_fotos for select to authenticated using (true);
drop policy if exists fot_ins on planta_fotos;
create policy fot_ins on planta_fotos for insert to authenticated with check (true);
drop policy if exists fot_del on planta_fotos;
create policy fot_del on planta_fotos for delete to authenticated using (true);

-- ===================================================================
-- DADOS INICIAIS — 23 ESPECIES
-- ===================================================================
do $$
declare v_casa_id uuid;
begin
  select id into v_casa_id from casa order by criada_em limit 1;

  insert into especies (casa_id, nome_popular, nome_cientifico, perfil_hidrico, metodo_cultivo, rotina_principal, intervalo_dias)
  select v_casa_id, nome_popular, nome_cientifico, perfil_hidrico, metodo_cultivo, rotina_principal, intervalo_dias
  from (values
    ('Cacto (espécie não identificada)',    null,                               'baixo',  'substrato', 'Verificar e regar', 21),
    ('Peperômia-cupido variegata',          'Peperomia scandens ''Variegata''', 'medio',  'substrato', 'Verificar e regar', 7),
    ('Samambaia',                           null,                               'alto',   'agua',      'Trocar a água',     7),
    ('Jiboia-dourada',                      'Epipremnum aureum',                'medio',  'substrato', 'Verificar e regar', 7),
    ('Filodendro jovem (a confirmar)',      null,                               'medio',  'substrato', 'Verificar e regar', 7),
    ('Dinheiro-em-penca',                   null,                               'alto',   'agua',      'Trocar a água',     7),
    ('Lírio-da-paz',                        'Spathiphyllum',                    'alto',   'substrato', 'Verificar e regar', 4),
    ('Comigo-ninguém-pode',                 'Dieffenbachia',                    'medio',  'substrato', 'Verificar e regar', 7),
    ('Abacaxi-roxo',                        'Tradescantia spathacea',           'medio',  'substrato', 'Verificar e regar', 7),
    ('Flor-de-maio',                        'Schlumbergera',                    'medio',  'substrato', 'Verificar e regar', 10),
    ('Aglaonema Silver Bay',                'Aglaonema ''Silver Bay''',         'medio',  'substrato', 'Verificar e regar', 7),
    ('Dracena',                             'Dracaena sp.',                     'baixo',  'substrato', 'Verificar e regar', 10),
    ('Coqueirinho-de-salão',               'Chamaedorea elegans',              'alto',   'substrato', 'Verificar e regar', 5),
    ('Bambu-da-sorte',                      'Dracaena sanderiana',              'medio',  'substrato', 'Verificar e regar', 7),
    ('Singônio',                            'Syngonium podophyllum',            'medio',  'substrato', 'Verificar e regar', 6),
    ('Espada-de-São-Jorge',                 'Dracaena trifasciata',             'baixo',  'substrato', 'Verificar e regar', 15),
    ('Jiboia N''Joy',                       'Epipremnum aureum ''N''Joy''',     'medio',  'kokedama',  'Fazer imersão',     5),
    ('Costela-de-eva',                      'Monstera adansonii',               'medio',  'substrato', 'Verificar e regar', 7),
    ('Zamioculca',                          'Zamioculcas zamiifolia',           'baixo',  'substrato', 'Verificar e regar', 15),
    ('Lambari-tricolor',                    'Tradescantia spathacea ''Tricolor''','alto', 'substrato', 'Verificar e regar', 4),
    ('Clorofito / gravatinha',             'Chlorophytum comosum',             'alto',   'agua',      'Trocar a água',     7),
    ('Alecrim',                             'Salvia rosmarinus',                'baixo',  'substrato', 'Verificar e regar', 7),
    ('Suculenta (espécie não identificada)', null,                              'baixo',  'substrato', 'Verificar e regar', 15)
  ) as t(nome_popular, nome_cientifico, perfil_hidrico, metodo_cultivo, rotina_principal, intervalo_dias)
  where not exists (select 1 from especies where casa_id = v_casa_id and nome_popular = t.nome_popular);
end $$;

-- ===================================================================
-- DADOS INICIAIS — 40 PLANTAS
-- ===================================================================
do $$
declare
  v_casa_id uuid;
  v_esp     uuid;
begin
  select id into v_casa_id from casa order by criada_em limit 1;

  -- Funcao auxiliar inline: pega id da especie pelo nome
  -- Usamos subselect direto abaixo

  -- PL-001 Cacto 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Cacto (espécie não identificada)' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-001',1,v_esp,'Sala','Prateleira de plantas','substrato','baixo','azul','ativa','Cacto do vasinho azul nº 1'
  where not exists (select 1 from plantas where codigo='PL-001');

  -- PL-002 Cacto 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-002',2,v_esp,'Sala','Prateleira de plantas','substrato','baixo','azul','ativa','Cacto do vasinho azul nº 2'
  where not exists (select 1 from plantas where codigo='PL-002');

  -- PL-003 Peperomia 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Peperômia-cupido variegata' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-003',3,v_esp,'Sala','Prateleira','substrato','medio','laranja','ativa','Peperômia da prateleira'
  where not exists (select 1 from plantas where codigo='PL-003');

  -- PL-004 Peperomia 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-004',4,v_esp,'Sala','Em cima da TV / pendente','substrato','medio','laranja','ativa','Peperômia ao lado da costela-de-eva'
  where not exists (select 1 from plantas where codigo='PL-004');

  -- PL-005 Samambaia 1 (água)
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Samambaia' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-005',5,v_esp,'Sala','Prateleira','agua','alto',null,'ativa','Samambaia maior cultivada na água'
  where not exists (select 1 from plantas where codigo='PL-005');

  -- PL-006 Samambaia 2 (água)
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-006',6,v_esp,'Sala','Mesa de plantas','agua','alto',null,'ativa','Mudinha de samambaia no copo'
  where not exists (select 1 from plantas where codigo='PL-006');

  -- PL-007 Jiboia-dourada substrato
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Jiboia-dourada' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-007',7,v_esp,'Sala','Mesa de plantas','substrato','medio','laranja','ativa','Jiboia em vaso sobre a mesa'
  where not exists (select 1 from plantas where codigo='PL-007');

  -- PL-008 Filodendro jovem
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Filodendro jovem (a confirmar)' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-008',8,v_esp,'Sala','Mesa de plantas','substrato','medio','laranja','ativa','Planta inicialmente confundida com uma segunda jiboia'
  where not exists (select 1 from plantas where codigo='PL-008');

  -- PL-009 Jiboia água
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Jiboia-dourada' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-009',9,v_esp,'Sala','Mesa de plantas','agua','medio',null,'ativa','Mudinha de jiboia na água'
  where not exists (select 1 from plantas where codigo='PL-009');

  -- PL-010 Dinheiro-em-penca água
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Dinheiro-em-penca' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-010',10,v_esp,'Sala','Mesa de plantas','agua','alto',null,'ativa','Mudinha na água junto das outras mudas'
  where not exists (select 1 from plantas where codigo='PL-010');

  -- PL-011 Lírio-da-paz mesa 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Lírio-da-paz' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-011',11,v_esp,'Sala','Mesa de plantas','substrato','alto','verde','ativa','Lírio-da-paz da mesa nº 1'
  where not exists (select 1 from plantas where codigo='PL-011');

  -- PL-012 Lírio-da-paz mesa 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-012',12,v_esp,'Sala','Mesa de plantas','substrato','alto','verde','ativa','Lírio-da-paz da mesa nº 2'
  where not exists (select 1 from plantas where codigo='PL-012');

  -- PL-013 Lírio-da-paz mesa 3
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-013',13,v_esp,'Sala','Mesa de plantas','substrato','alto','verde','ativa','Lírio-da-paz da mesa nº 3'
  where not exists (select 1 from plantas where codigo='PL-013');

  -- PL-014 Comigo-ninguém-pode pequena
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Comigo-ninguém-pode' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-014',14,v_esp,'Sala','Mesa de plantas','substrato','medio','laranja','ativa','Comigo-ninguém-pode pequena'
  where not exists (select 1 from plantas where codigo='PL-014');

  -- PL-015 Abacaxi-roxo
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Abacaxi-roxo' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-015',15,v_esp,'Sala','Mesa de plantas','substrato','medio','laranja','ativa','Vaso branco; também conhecido como manto-de-moisés'
  where not exists (select 1 from plantas where codigo='PL-015');

  -- PL-016 Flor-de-maio
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Flor-de-maio' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-016',16,v_esp,'Sala','Mesa de plantas','substrato','medio','laranja','ativa',null
  where not exists (select 1 from plantas where codigo='PL-016');

  -- PL-017 Aglaonema
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Aglaonema Silver Bay' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-017',17,v_esp,'Sala','Mesa de plantas','substrato','medio','laranja','ativa','Aglaonema do vaso branco'
  where not exists (select 1 from plantas where codigo='PL-017');

  -- PL-018 Dracena
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Dracena' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-018',18,v_esp,'Sala','Mesa de plantas','substrato','baixo','azul','ativa','Planta jovem de caule fino'
  where not exists (select 1 from plantas where codigo='PL-018');

  -- PL-019 Coqueirinho 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Coqueirinho-de-salão' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-019',19,v_esp,'Sala','Chão','substrato','alto','verde','ativa','Coqueirinho nº 1'
  where not exists (select 1 from plantas where codigo='PL-019');

  -- PL-020 Coqueirinho 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-020',20,v_esp,'Sala','Chão','substrato','alto','verde','ativa','Coqueirinho nº 2'
  where not exists (select 1 from plantas where codigo='PL-020');

  -- PL-021 Lírio-da-paz chão 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Lírio-da-paz' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-021',21,v_esp,'Sala','Chão','substrato','alto','verde','ativa','Lírio-da-paz do chão nº 1'
  where not exists (select 1 from plantas where codigo='PL-021');

  -- PL-022 Lírio-da-paz chão 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-022',22,v_esp,'Sala','Chão','substrato','alto','verde','ativa','Lírio-da-paz do chão nº 2'
  where not exists (select 1 from plantas where codigo='PL-022');

  -- PL-023 Bambu-da-sorte
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Bambu-da-sorte' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-023',23,v_esp,'Sala','Chão','substrato','medio','laranja','ativa',null
  where not exists (select 1 from plantas where codigo='PL-023');

  -- PL-024 Jiboia no tutor
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Jiboia-dourada' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-024',24,v_esp,'Sala','Chão','substrato','medio','laranja','ativa','Jiboia no tutor de fibra de coco'
  where not exists (select 1 from plantas where codigo='PL-024');

  -- PL-025 Singônio 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Singônio' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-025',25,v_esp,'Sala','Chão','substrato','medio','laranja','ativa','Singônio de folhas mais escuras e nervuras claras'
  where not exists (select 1 from plantas where codigo='PL-025');

  -- PL-026 Singônio 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-026',26,v_esp,'Sala','Chão','substrato','medio','laranja','ativa','Singônio de folhas mais claras'
  where not exists (select 1 from plantas where codigo='PL-026');

  -- PL-027 Espada 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Espada-de-São-Jorge' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-027',27,v_esp,'Sala','Atrás da porta','substrato','baixo','azul','ativa','Vaso nº 1'
  where not exists (select 1 from plantas where codigo='PL-027');

  -- PL-028 Espada 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-028',28,v_esp,'Sala','Ao lado da porta','substrato','baixo','azul','ativa','Vaso nº 2'
  where not exists (select 1 from plantas where codigo='PL-028');

  -- PL-029 Comigo maior
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Comigo-ninguém-pode' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-029',29,v_esp,'Sala','Ao lado da poltrona','substrato','medio','laranja','ativa','Comigo-ninguém-pode maior'
  where not exists (select 1 from plantas where codigo='PL-029');

  -- PL-030 Jiboia N'Joy kokedama
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Jiboia N''Joy' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-030',30,v_esp,'Sala','Suspensa','kokedama','medio','laranja','ativa','Jiboia cultivada na bola de kokedama'
  where not exists (select 1 from plantas where codigo='PL-030');

  -- PL-031 Costela-de-eva suspensa substrato
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Costela-de-eva' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-031',31,v_esp,'Sala','Suspensa','substrato','medio','laranja','ativa','Costela-de-eva pendurada'
  where not exists (select 1 from plantas where codigo='PL-031');

  -- PL-032 Zamioculca
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Zamioculca' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-032',32,v_esp,'Sala','Ao lado da TV','substrato','baixo','azul','ativa',null
  where not exists (select 1 from plantas where codigo='PL-032');

  -- PL-033 Costela-de-eva água
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Costela-de-eva' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-033',33,v_esp,'Sala','Mesa de plantas','agua','medio',null,'ativa','Costela-de-eva cultivada na água'
  where not exists (select 1 from plantas where codigo='PL-033');

  -- PL-034 Lambari-tricolor
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Lambari-tricolor' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-034',34,v_esp,'Sala','Mesa de plantas','substrato','alto','verde','ativa','Folhas verdes, brancas e rosadas'
  where not exists (select 1 from plantas where codigo='PL-034');

  -- PL-035 Clorofito água
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Clorofito / gravatinha' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-035',35,v_esp,'Sala','Mesa de plantas','agua','alto',null,'ativa','Muda cultivada na água'
  where not exists (select 1 from plantas where codigo='PL-035');

  -- PL-036 Alecrim
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Alecrim' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-036',36,v_esp,'Cozinha','Em cima da geladeira','substrato','baixo','azul','ativa',null
  where not exists (select 1 from plantas where codigo='PL-036');

  -- PL-037 Suculenta banheiro 1
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Suculenta (espécie não identificada)' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-037',37,v_esp,'Banheiro','A definir','substrato','baixo','azul','ativa','Suculenta do banheiro nº 1'
  where not exists (select 1 from plantas where codigo='PL-037');

  -- PL-038 Suculenta banheiro 2
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-038',38,v_esp,'Banheiro','A definir','substrato','baixo','azul','ativa','Suculenta do banheiro nº 2'
  where not exists (select 1 from plantas where codigo='PL-038');

  -- PL-039 Suculenta escritório
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-039',39,v_esp,'Escritório','A definir','substrato','baixo','azul','ativa','Suculenta do escritório'
  where not exists (select 1 from plantas where codigo='PL-039');

  -- PL-040 Dinheiro-em-penca escritório água
  select id into v_esp from especies where casa_id=v_casa_id and nome_popular='Dinheiro-em-penca' limit 1;
  insert into plantas (casa_id,codigo,numero_etiqueta,especie_id,comodo,posicao,metodo_cultivo,perfil_hidrico,cor_etiqueta,status,observacoes)
  select v_casa_id,'PL-040',40,v_esp,'Escritório','A definir','agua','alto',null,'ativa','Dinheiro-em-penca cultivado na água'
  where not exists (select 1 from plantas where codigo='PL-040');

end $$;

-- ===================================================================
-- ROTINAS INICIAIS — uma por planta, baseadas na planilha
-- ===================================================================
do $$
declare
  v_planta_id uuid;
begin
  -- Para cada planta, insere a rotina se ainda nao existir
  for v_planta_id in select id from plantas where codigo in (
    'PL-001','PL-002','PL-003','PL-004','PL-005','PL-006','PL-007','PL-008',
    'PL-009','PL-010','PL-011','PL-012','PL-013','PL-014','PL-015','PL-016',
    'PL-017','PL-018','PL-019','PL-020','PL-021','PL-022','PL-023','PL-024',
    'PL-025','PL-026','PL-027','PL-028','PL-029','PL-030','PL-031','PL-032',
    'PL-033','PL-034','PL-035','PL-036','PL-037','PL-038','PL-039','PL-040'
  )
  loop
    if not exists (select 1 from planta_rotinas where planta_id = v_planta_id) then
      insert into planta_rotinas (planta_id, tipo, intervalo_dias, proxima_realizacao, ativa, observacoes)
      select
        v_planta_id,
        p.rotina_tipo,
        p.intervalo,
        current_date + p.intervalo,
        true,
        'Cadência inicial de teste; ajustar conforme resposta da planta e ambiente'
      from (
        select
          pl.id,
          case pl.metodo_cultivo
            when 'agua'     then 'Trocar a água'
            when 'kokedama' then 'Fazer imersão'
            else 'Verificar e regar'
          end as rotina_tipo,
          coalesce(e.intervalo_dias, 7) as intervalo
        from plantas pl
        left join especies e on e.id = pl.especie_id
        where pl.id = v_planta_id
      ) p;
    end if;
  end loop;
end $$;

-- ===================================================================
-- EVENTO DE CADASTRO INICIAL para cada planta
-- ===================================================================
insert into planta_eventos (planta_id, tipo, notas)
select p.id, 'cadastro', 'Cadastro inicial via importação da planilha'
from plantas p
where not exists (
  select 1 from planta_eventos pe
  where pe.planta_id = p.id and pe.tipo = 'cadastro'
);
