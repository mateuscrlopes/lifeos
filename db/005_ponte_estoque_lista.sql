-- ===================================================================
-- LIFEOS - MIGRACAO 005: PONTE ESTOQUE <-> LISTA (Fatia 2)
-- Adiciona a lista_compras a ligacao com o estoque e a marcacao de
-- origem (manual ou sugestao do estoque). Seguro rodar de novo.
-- ===================================================================

-- Coluna que liga um item da lista ao item de estoque que o originou.
-- Nula para itens comuns; preenchida quando o item veio do estoque.
alter table lista_compras
  add column if not exists estoque_id uuid references estoque(id);

-- Origem do item: 'manual' (alguem digitou) ou 'sugestao_estoque'
-- (entrou automaticamente porque o estoque ficou baixo/acabou).
alter table lista_compras
  add column if not exists origem text not null default 'manual';

-- Evita duas sugestoes pendentes para o mesmo item de estoque:
-- so pode haver UMA linha pendente por estoque_id.
create unique index if not exists lista_sugestao_unica
  on lista_compras (estoque_id)
  where estoque_id is not null and status = 'pendente';
