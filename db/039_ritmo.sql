-- ===================================================================
-- LIFEOS - MIGRACAO 039: RITMO
-- Modulo pessoal de alimentacao, movimento e evolucao.
-- Dados individuais pertencem ao usuario autenticado; cardapio, estoque
-- e lista de compras continuam sendo estruturas compartilhadas da Casa.
-- ===================================================================

create table if not exists public.ritmo_perfis (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  altura_cm numeric(5,2),
  meta_calorias integer check (meta_calorias is null or meta_calorias between 800 and 6000),
  meta_proteina_g integer check (meta_proteina_g is null or meta_proteina_g between 0 and 500),
  meta_agua_ml integer check (meta_agua_ml is null or meta_agua_ml between 250 and 10000),
  foto_intervalo_dias integer not null default 15 check (foto_intervalo_dias between 1 and 365),
  preferencias jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.ritmo_ciclos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  nome text not null,
  objetivo text,
  fase text,
  inicio date not null,
  fim date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create index if not exists ritmo_ciclos_usuario_idx
  on public.ritmo_ciclos(usuario_id, ativo, inicio desc);

create table if not exists public.ritmo_metas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  ciclo_id uuid references public.ritmo_ciclos(id) on delete cascade,
  indicador text not null,
  estrategia text not null default 'acompanhar'
    check (estrategia in ('reduzir','aumentar','manter','acompanhar')),
  valor_meta numeric(10,2),
  unidade text not null default 'cm',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(usuario_id, ciclo_id, indicador)
);

create table if not exists public.ritmo_medidas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  data date not null default current_date,
  peso_kg numeric(6,2),
  cintura_cm numeric(6,2),
  abdomen_cm numeric(6,2),
  quadril_alto_cm numeric(6,2),
  quadril_max_cm numeric(6,2),
  peito_cm numeric(6,2),
  coxa_d_cm numeric(6,2),
  braco_d_cm numeric(6,2),
  panturrilha_d_cm numeric(6,2),
  observacoes text,
  criado_em timestamptz not null default now(),
  unique(usuario_id, data)
);

create index if not exists ritmo_medidas_usuario_data_idx
  on public.ritmo_medidas(usuario_id, data desc);

create table if not exists public.ritmo_checkins (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  data date not null default current_date,
  tipo text not null check (tipo in ('cafe','almoco','jantar','atividade','agua')),
  referencia_id uuid,
  status text not null check (status in ('conforme','ajustes','nao_feito')),
  valor numeric(10,2),
  observacao text,
  registrado_em timestamptz not null default now()
);

create unique index if not exists ritmo_checkins_unico_idx
  on public.ritmo_checkins(usuario_id, data, tipo, coalesce(referencia_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.ritmo_planos_atividade (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  nome text not null,
  tipo text not null default 'outro',
  local text,
  descricao text,
  ativo boolean not null default true,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.ritmo_plano_itens (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.ritmo_planos_atividade(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  ordem integer not null default 1,
  nome text not null,
  series integer,
  repeticoes text,
  carga_meta numeric(8,2),
  descanso_seg integer,
  observacoes text,
  detalhes jsonb not null default '{}'::jsonb
);

create index if not exists ritmo_plano_itens_plano_idx
  on public.ritmo_plano_itens(plano_id, ordem);

create table if not exists public.ritmo_agenda (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  plano_id uuid references public.ritmo_planos_atividade(id) on delete set null,
  dia_semana integer not null check (dia_semana between 0 and 6),
  horario time,
  titulo text not null,
  opcional boolean not null default false,
  ativo boolean not null default true,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists ritmo_agenda_usuario_dia_idx
  on public.ritmo_agenda(usuario_id, dia_semana, ativo);

create table if not exists public.ritmo_sessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  plano_id uuid references public.ritmo_planos_atividade(id) on delete set null,
  data date not null default current_date,
  inicio timestamptz,
  fim timestamptz,
  duracao_min integer,
  distancia_km numeric(8,2),
  intensidade text,
  observacoes text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists ritmo_sessoes_usuario_data_idx
  on public.ritmo_sessoes(usuario_id, data desc);

create table if not exists public.ritmo_sessao_itens (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.ritmo_sessoes(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  item_plano_id uuid references public.ritmo_plano_itens(id) on delete set null,
  ordem integer not null default 1,
  nome text not null,
  carga numeric(8,2),
  repeticoes text,
  concluido boolean not null default true,
  observacoes text
);

create table if not exists public.ritmo_fotos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  data date not null default current_date,
  posicao text not null check (posicao in ('frente','lado','costas')),
  storage_path text not null,
  criado_em timestamptz not null default now(),
  unique(usuario_id, data, posicao)
);

create table if not exists public.ritmo_planos_alimentares (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  nome text not null,
  origem text not null default 'manual' check (origem in ('manual','pdf')),
  arquivo_nome text,
  conteudo jsonb not null default '{"refeicoes":[]}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Privacidade: todas as tabelas do Ritmo sao pessoais.
alter table public.ritmo_perfis enable row level security;
alter table public.ritmo_ciclos enable row level security;
alter table public.ritmo_metas enable row level security;
alter table public.ritmo_medidas enable row level security;
alter table public.ritmo_checkins enable row level security;
alter table public.ritmo_planos_atividade enable row level security;
alter table public.ritmo_plano_itens enable row level security;
alter table public.ritmo_agenda enable row level security;
alter table public.ritmo_sessoes enable row level security;
alter table public.ritmo_sessao_itens enable row level security;
alter table public.ritmo_fotos enable row level security;
alter table public.ritmo_planos_alimentares enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ritmo_perfis','ritmo_ciclos','ritmo_metas','ritmo_medidas','ritmo_checkins',
    'ritmo_planos_atividade','ritmo_plano_itens','ritmo_agenda','ritmo_sessoes',
    'ritmo_sessao_itens','ritmo_fotos','ritmo_planos_alimentares'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_ler', t);
    execute format('create policy %I on public.%I for select to authenticated using (usuario_id = public.lifeos_usuario_atual_id())', t || '_ler', t);
    execute format('drop policy if exists %I on public.%I', t || '_inserir', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (usuario_id = public.lifeos_usuario_atual_id())', t || '_inserir', t);
    execute format('drop policy if exists %I on public.%I', t || '_atualizar', t);
    execute format('create policy %I on public.%I for update to authenticated using (usuario_id = public.lifeos_usuario_atual_id()) with check (usuario_id = public.lifeos_usuario_atual_id())', t || '_atualizar', t);
    execute format('drop policy if exists %I on public.%I', t || '_excluir', t);
    execute format('create policy %I on public.%I for delete to authenticated using (usuario_id = public.lifeos_usuario_atual_id())', t || '_excluir', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Bucket privado para fotos de evolucao.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ritmo-fotos',
  'ritmo-fotos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ritmo_fotos_storage_ler on storage.objects;
create policy ritmo_fotos_storage_ler
on storage.objects for select to authenticated
using (
  bucket_id = 'ritmo-fotos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists ritmo_fotos_storage_inserir on storage.objects;
create policy ritmo_fotos_storage_inserir
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ritmo-fotos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists ritmo_fotos_storage_atualizar on storage.objects;
create policy ritmo_fotos_storage_atualizar
on storage.objects for update to authenticated
using (
  bucket_id = 'ritmo-fotos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'ritmo-fotos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists ritmo_fotos_storage_excluir on storage.objects;
create policy ritmo_fotos_storage_excluir
on storage.objects for delete to authenticated
using (
  bucket_id = 'ritmo-fotos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Perfil inicial do Mateus e perfil vazio do Ghustavo.
insert into public.ritmo_perfis (
  usuario_id, altura_cm, meta_calorias, meta_proteina_g, meta_agua_ml,
  foto_intervalo_dias, preferencias
)
select
  u.id,
  case when lower(u.nome) like 'mateus%' then 169 else null end,
  case when lower(u.nome) like 'mateus%' then 1900 else null end,
  case when lower(u.nome) like 'mateus%' then 130 else null end,
  case when lower(u.nome) like 'mateus%' then 2000 else null end,
  15,
  case when lower(u.nome) like 'mateus%' then jsonb_build_object(
    'cafe_com_acucar', true,
    'reducao_acucar_progressiva', true,
    'preparo', 'bases_no_domingo',
    'proteinas', jsonb_build_array('frango','ovos','peixe','carne_moida','porco'),
    'legumes_preferidos', jsonb_build_array('brocolis','couve-flor','vagem','couve','cenoura','beterraba','repolho'),
    'frutas_frequentes', jsonb_build_array('banana','maca','pera','tangerina','uva'),
    'observacao', 'Priorizar praticidade, porcoes individuais para doces e acai, e alimentos de baixo atrito.'
  ) else '{}'::jsonb end
from public.usuarios u
where lower(u.nome) like 'mateus%' or lower(u.nome) like 'ghustavo%'
on conflict (usuario_id) do update
set altura_cm = coalesce(public.ritmo_perfis.altura_cm, excluded.altura_cm),
    meta_calorias = coalesce(public.ritmo_perfis.meta_calorias, excluded.meta_calorias),
    meta_proteina_g = coalesce(public.ritmo_perfis.meta_proteina_g, excluded.meta_proteina_g),
    meta_agua_ml = coalesce(public.ritmo_perfis.meta_agua_ml, excluded.meta_agua_ml),
    preferencias = case
      when public.ritmo_perfis.preferencias = '{}'::jsonb then excluded.preferencias
      else public.ritmo_perfis.preferencias
    end;

insert into public.ritmo_ciclos (usuario_id, nome, objetivo, fase, inicio, fim, ativo)
select u.id, 'Ciclo Nordeste', 'Reducao de gordura e definicao', 'ataque', '2026-09-01', '2026-10-31', true
from public.usuarios u
where lower(u.nome) like 'mateus%'
  and not exists (
    select 1 from public.ritmo_ciclos c
    where c.usuario_id = u.id and c.nome = 'Ciclo Nordeste'
  );

insert into public.ritmo_medidas (
  usuario_id, data, peso_kg, cintura_cm, abdomen_cm, quadril_alto_cm,
  quadril_max_cm, peito_cm, coxa_d_cm, braco_d_cm, panturrilha_d_cm
)
select u.id, '2026-08-11', 70.7, 87, 85, 92, 96, 90, 54, 32, 39
from public.usuarios u
where lower(u.nome) like 'mateus%'
on conflict (usuario_id, data) do nothing;

insert into public.ritmo_medidas (usuario_id, data, peso_kg, observacoes)
select u.id, '2026-08-31', 72, 'Peso informado no inicio do Ciclo Nordeste.'
from public.usuarios u
where lower(u.nome) like 'mateus%'
on conflict (usuario_id, data) do update set peso_kg = excluded.peso_kg;

insert into public.ritmo_metas (usuario_id, ciclo_id, indicador, estrategia, valor_meta, unidade)
select u.id, c.id, x.indicador, x.estrategia, null, x.unidade
from public.usuarios u
join public.ritmo_ciclos c on c.usuario_id = u.id and c.nome = 'Ciclo Nordeste'
cross join (values
  ('peso','reduzir','kg'),
  ('cintura','reduzir','cm'),
  ('abdomen','reduzir','cm'),
  ('quadril_max','acompanhar','cm'),
  ('peito','acompanhar','cm'),
  ('coxa_d','acompanhar','cm'),
  ('braco_d','acompanhar','cm'),
  ('panturrilha_d','acompanhar','cm')
) as x(indicador, estrategia, unidade)
where lower(u.nome) like 'mateus%'
on conflict (usuario_id, ciclo_id, indicador) do nothing;

-- Planos iniciais de movimento do Mateus.
with mateus as (
  select id from public.usuarios where lower(nome) like 'mateus%' limit 1
)
insert into public.ritmo_planos_atividade (usuario_id, nome, tipo, local, descricao, detalhes)
select mateus.id, v.nome, v.tipo, v.local, v.descricao, v.detalhes
from mateus
cross join (values
  ('Ultra A','academia','Ultra Academia','Treino de forca A', '{}'::jsonb),
  ('Ultra B','academia','Ultra Academia','Treino de forca B', '{}'::jsonb),
  ('Ultra C','academia','Ultra Academia','Treino de forca C', '{}'::jsonb),
  ('Condominio Full Body','academia','Academia do condominio','Treino completo usando os equipamentos disponiveis', '{}'::jsonb),
  ('Condominio Pernas','academia','Academia do condominio','Treino complementar de membros inferiores', '{}'::jsonb),
  ('Cardio intervalado','corrida','Rua ou condominio','Aquecimento + blocos de 1 min forte e 2 min leve', '{"duracao_min":30}'::jsonb),
  ('Corrida leve','corrida','Rua','Caminhada ou trote em ritmo confortavel', '{"duracao_min_min":45,"duracao_min_max":60}'::jsonb)
) as v(nome,tipo,local,descricao,detalhes)
where not exists (
  select 1 from public.ritmo_planos_atividade p
  where p.usuario_id = mateus.id and p.nome = v.nome
);

with mateus as (
  select id from public.usuarios where lower(nome) like 'mateus%' limit 1
),
itens(plano,ordem,nome,series,repeticoes,descanso) as (
  values
  ('Ultra A',1,'Leg press',3,'8-12',90),
  ('Ultra A',2,'Supino maquina ou halteres',3,'8-12',90),
  ('Ultra A',3,'Remada sentada',3,'8-12',90),
  ('Ultra A',4,'Stiff / RDL',3,'8-12',90),
  ('Ultra A',5,'Elevacao lateral',3,'12-15',60),
  ('Ultra A',6,'Abdominal na polia',3,'12-15',60),
  ('Ultra B',1,'Agachamento ou hack',3,'8-12',90),
  ('Ultra B',2,'Puxada alta',3,'8-12',90),
  ('Ultra B',3,'Supino inclinado',3,'8-12',90),
  ('Ultra B',4,'Elevacao pelvica',3,'8-12',90),
  ('Ultra B',5,'Rosca de biceps',3,'10-15',60),
  ('Ultra B',6,'Triceps na polia',3,'10-15',60),
  ('Ultra B',7,'Prancha',3,'30-60 s',60),
  ('Ultra C',1,'Afundo ou bulgaro',3,'8-12 por perna',90),
  ('Ultra C',2,'Mesa flexora',3,'10-15',75),
  ('Ultra C',3,'Chest press ou crucifixo',3,'10-12',75),
  ('Ultra C',4,'Remada maquina',3,'8-12',90),
  ('Ultra C',5,'Desenvolvimento',3,'8-12',75),
  ('Ultra C',6,'Panturrilha',3,'12-20',60),
  ('Ultra C',7,'Elevacao de joelhos ou pernas',3,'10-15',60),
  ('Condominio Full Body',1,'Agachamento na maquina',3,'8-12',90),
  ('Condominio Full Body',2,'Cadeira extensora',3,'10-15',75),
  ('Condominio Full Body',3,'Cadeira flexora',3,'10-15',75),
  ('Condominio Full Body',4,'Remada baixa na polia com triangulo',3,'8-12',90),
  ('Condominio Full Body',5,'Puxada alta na polia',3,'8-12',90),
  ('Condominio Full Body',6,'Supino com halteres',3,'8-12',90),
  ('Condominio Full Body',7,'Desenvolvimento com halteres',3,'8-12',75),
  ('Condominio Full Body',8,'Elevacao lateral',3,'12-15',60),
  ('Condominio Full Body',9,'Triceps corda',3,'10-15',60),
  ('Condominio Full Body',10,'Rosca biceps',3,'10-15',60),
  ('Condominio Pernas',1,'Agachamento na maquina',3,'8-12',90),
  ('Condominio Pernas',2,'Stiff com halteres',3,'8-12',90),
  ('Condominio Pernas',3,'Cadeira flexora',3,'10-15',75),
  ('Condominio Pernas',4,'Cadeira extensora',3,'10-15',75),
  ('Condominio Pernas',5,'Abdutora',3,'12-20',60),
  ('Condominio Pernas',6,'Adutora',3,'12-20',60),
  ('Condominio Pernas',7,'Afundo com halteres',3,'8-12 por perna',90),
  ('Condominio Pernas',8,'Panturrilha com halteres',3,'15-20',60)
)
insert into public.ritmo_plano_itens (plano_id, usuario_id, ordem, nome, series, repeticoes, descanso_seg)
select p.id, mateus.id, i.ordem, i.nome, i.series, i.repeticoes, i.descanso
from mateus
join itens i on true
join public.ritmo_planos_atividade p on p.usuario_id = mateus.id and p.nome = i.plano
where not exists (
  select 1 from public.ritmo_plano_itens pi
  where pi.plano_id = p.id and pi.nome = i.nome
);

with mateus as (
  select id from public.usuarios where lower(nome) like 'mateus%' limit 1
),
agenda(dia, plano, titulo, opcional) as (
  values
    (1,'Ultra A','Ultra A + caminhada/trote ate a academia',false),
    (2,'Cardio intervalado','Cardio intervalado + core',false),
    (3,'Ultra B','Ultra B + caminhada/trote ate a academia',false),
    (4,'Condominio Full Body','Treino no condominio',false),
    (5,'Ultra C','Ultra C + caminhada/trote ate a academia',false),
    (6,'Corrida leve','Corrida ou caminhada longa leve',true)
)
insert into public.ritmo_agenda (usuario_id, plano_id, dia_semana, titulo, opcional)
select mateus.id, p.id, a.dia, a.titulo, a.opcional
from mateus
join agenda a on true
join public.ritmo_planos_atividade p on p.usuario_id = mateus.id and p.nome = a.plano
where not exists (
  select 1 from public.ritmo_agenda ag
  where ag.usuario_id = mateus.id and ag.dia_semana = a.dia and ag.titulo = a.titulo
);
