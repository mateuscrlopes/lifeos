-- LIFEOS - MIGRACAO 050: LIMPEZA DO FLUXO DE PAGAMENTOS EM LOTE
-- Remove a assinatura temporária da RPC e corrige leituras antigas de imagem
-- que haviam sido persistidas como R$ 0,00 por coerção de null.

drop function if exists public.revisar_pagamento_lote(uuid, boolean, text);

update public.acerto_pagamentos
set valor_extraido = null,
    dados_extraidos = jsonb_set(
      jsonb_set(coalesce(dados_extraidos, '{}'::jsonb), '{valor}', 'null'::jsonb, true),
      '{divergencia_valor}', 'false'::jsonb, true
    ),
    atualizado_em = now()
where valor_extraido = 0
  and coalesce(dados_extraidos->>'codigo','') in ('imagem_sem_ocr','ocr_sem_valor');

update public.acerto_pagamento_lotes
set valor_extraido = null,
    dados_extraidos = jsonb_set(
      coalesce(dados_extraidos, '{}'::jsonb),
      '{divergencia_valor_informado}', 'false'::jsonb, true
    ),
    atualizado_em = now()
where valor_extraido = 0
  and coalesce(dados_extraidos->>'codigo','') in ('imagem_sem_ocr','ocr_sem_valor');
