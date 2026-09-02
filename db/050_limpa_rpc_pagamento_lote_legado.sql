-- LIFEOS - MIGRACAO 050: LIMPEZA DO RPC LEGADO DE PAGAMENTO EM LOTE
-- Mantem apenas a assinatura atual, que permite confirmar o valor efetivamente recebido.

drop function if exists public.revisar_pagamento_lote(uuid, boolean, text);

revoke all on function public.revisar_pagamento_lote(uuid, boolean, numeric, text)
  from public, anon;
grant execute on function public.revisar_pagamento_lote(uuid, boolean, numeric, text)
  to authenticated;
