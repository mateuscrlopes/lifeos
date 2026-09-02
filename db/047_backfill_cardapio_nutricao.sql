-- LIFEOS - MIGRACAO 047: BACKFILL NUTRICIONAL POR NOME
-- Planejamentos antigos podiam guardar apenas o nome da refeicao.
-- Recupera kcal/proteina da biblioteca da mesma Casa quando o nome coincide.

update public.planejamento_dias pd
set calorias = coalesce(pd.calorias, r.calorias_por_porcao),
    proteina_g = coalesce(pd.proteina_g, r.proteina_por_porcao),
    refeicao_id = coalesce(pd.refeicao_id, r.id)
from public.planejamento_semana ps,
     public.refeicoes r
where pd.planejamento_id = ps.id
  and r.casa_id = ps.casa_id
  and lower(trim(coalesce(pd.refeicao_nome, ''))) = lower(trim(r.nome))
  and (pd.calorias is null or pd.proteina_g is null or pd.refeicao_id is null);
