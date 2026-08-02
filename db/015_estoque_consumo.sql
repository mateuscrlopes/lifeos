-- ===================================================================
-- LIFEOS - MIGRACAO 015: ESTOQUE FATIA 4 — TAXA DE CONSUMO
-- Adiciona campos de consumo estimado ao estoque.
-- ===================================================================

-- taxa_consumo: quantidade consumida por periodo
-- taxa_periodo: 'dia' | 'semana' | 'mes'
-- alerta_dias: avisar quando restar menos que X dias de estoque
alter table estoque add column if not exists taxa_consumo  numeric;
alter table estoque add column if not exists taxa_periodo  text;   -- 'dia' | 'semana' | 'mes'
alter table estoque add column if not exists alerta_dias   integer default 7;
