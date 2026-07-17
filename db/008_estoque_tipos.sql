-- ===================================================================
-- LIFEOS - MIGRACAO 008: ESTOQUE FATIA 1.5 - tipos de medicao
-- Adiciona a coluna "tipo" a tabela estoque para suportar os quatro
-- tipos de medicao previstos no Documento Mestre (secao 18.4):
--   contavel   | peso_volume | nivel_visual | presenca
-- Itens existentes (criados na Fatia 1) ficam como 'contavel'.
-- Seguro rodar de novo.
-- ===================================================================

alter table estoque
  add column if not exists tipo text not null default 'contavel';

-- Para nivel_visual, a quantidade guarda o nivel como texto:
-- 'cheio' | '75' | 'metade' | '25' | 'quase_acabando' | 'acabou'
-- Para presenca, quantidade guarda '1' (tem) ou '0' (nao tem).
-- Para contavel e peso_volume, quantidade continua numerica (em texto).
-- Optamos por manter quantidade como numeric e criar nivel_visual como
-- coluna separada para nao misturar semantica.
alter table estoque
  add column if not exists nivel text;   -- so preenchido para nivel_visual

alter table estoque
  add column if not exists minimo_nivel text default '25';  -- nivel de alerta para nivel_visual

-- Para peso_volume: unidade ja existe (ex.: 'g', 'kg', 'ml', 'l').
-- Nada a adicionar - unidade cobre esse caso.
