-- ===================================================================
-- LIFEOS - MIGRACAO 002: PERFIS DOS MORADORES
-- Cria o perfil de Mateus e de Ghustavo na tabela usuarios, ligando
-- cada um ao seu login (auth_id) e a Casa.
-- Seguro rodar de novo: nao duplica se o perfil ja existir.
-- ===================================================================

-- Mateus
insert into usuarios (auth_id, nome, casa_id)
select
  '766a0f68-a554-4257-a93c-83059ebdc018',   -- login de Mateus
  'Mateus',
  (select id from casa order by criada_em limit 1)  -- a Casa
where not exists (
  select 1 from usuarios
  where auth_id = '766a0f68-a554-4257-a93c-83059ebdc018'
);

-- Ghustavo
insert into usuarios (auth_id, nome, casa_id)
select
  '506e79ed-2ca3-45e6-9f33-9ba74deaf081',   -- login de Ghustavo
  'Ghustavo',
  (select id from casa order by criada_em limit 1)
where not exists (
  select 1 from usuarios
  where auth_id = '506e79ed-2ca3-45e6-9f33-9ba74deaf081'
);
