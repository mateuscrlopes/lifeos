-- LIFEOS - MIGRACAO 035: HARDENING DOS ACERTOS FINANCEIROS
-- Remove execução anônima dos RPCs novos, fixa search_path e cobre FKs.

revoke execute on function public.lifeos_usuario_atual_id() from anon;
revoke execute on function public.lifeos_usuario_na_casa(uuid) from anon;
revoke execute on function public.gerar_acertos_recorrentes(date) from anon;
revoke execute on function public.criar_despesa_compartilhada(
  text, numeric, uuid, jsonb, integer, date, text, text, text, text, text
) from anon;
revoke execute on function public.revisar_pagamento_acerto(uuid, boolean, text) from anon;
revoke execute on function public.atualizar_regra_acerto(
  uuid, text, numeric, uuid, uuid, integer, text, integer, boolean
) from anon;

grant execute on function public.lifeos_usuario_atual_id() to authenticated;
grant execute on function public.lifeos_usuario_na_casa(uuid) to authenticated;
grant execute on function public.gerar_acertos_recorrentes(date) to authenticated;
grant execute on function public.criar_despesa_compartilhada(
  text, numeric, uuid, jsonb, integer, date, text, text, text, text, text
) to authenticated;
grant execute on function public.revisar_pagamento_acerto(uuid, boolean, text) to authenticated;
grant execute on function public.atualizar_regra_acerto(
  uuid, text, numeric, uuid, uuid, integer, text, integer, boolean
) to authenticated;

alter function public.lifeos_feriado_nacional_fixo(date)
  set search_path = public;

alter function public.lifeos_calcular_vencimento(date, text, integer)
  set search_path = public;

create index if not exists financeiro_recebimento_config_casa_idx
  on public.financeiro_recebimento_config (casa_id);

create index if not exists acerto_regras_casa_idx
  on public.acerto_regras (casa_id);

create index if not exists acerto_regras_devedor_idx
  on public.acerto_regras (devedor_id);

create index if not exists acerto_regras_credor_idx
  on public.acerto_regras (credor_id);

create index if not exists acerto_regras_criada_por_idx
  on public.acerto_regras (criada_por);

create index if not exists despesas_compartilhadas_casa_idx
  on public.despesas_compartilhadas (casa_id);

create index if not exists despesas_compartilhadas_pago_por_idx
  on public.despesas_compartilhadas (pago_por);

create index if not exists despesas_compartilhadas_criada_por_idx
  on public.despesas_compartilhadas (criada_por);

create index if not exists despesa_compartilhada_partes_usuario_idx
  on public.despesa_compartilhada_partes (usuario_id);

create index if not exists acertos_despesa_idx
  on public.acertos (despesa_id);

create index if not exists acertos_devedor_idx
  on public.acertos (devedor_id);

create index if not exists acertos_credor_idx
  on public.acertos (credor_id);

create index if not exists acertos_criado_por_idx
  on public.acertos (criado_por);

create index if not exists acerto_pagamentos_casa_idx
  on public.acerto_pagamentos (casa_id);

create index if not exists acerto_pagamentos_enviado_por_idx
  on public.acerto_pagamentos (enviado_por);

create index if not exists acerto_pagamentos_revisado_por_idx
  on public.acerto_pagamentos (revisado_por);

create index if not exists notificacoes_casa_idx
  on public.notificacoes (casa_id);
