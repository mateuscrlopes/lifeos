# Auditoria — Alimentação no Ritmo e Cardápio da Casa

## Diagnóstico

O fluxo atual divide a mesma decisão entre três estruturas: receitas salvas (`refeicoes`), planejamento semanal (`planejamento_semana`/`planejamento_dias`) e consumo pessoal (`ritmo_consumos`/check-ins). Isso gera duplicação e deixa o usuário responsável por conhecer calorias e macros ao registrar algo diferente do planejado.

## Problemas encontrados

1. O card principal do Ritmo mostra uma sugestão ou planejamento, mas o caminho para trocar não reutiliza de forma direta o catálogo de refeições salvas.
2. O registro manual de consumo pressupõe conhecimento nutricional do usuário.
3. Aceitar ou trocar uma refeição no Ritmo não é tratado como a mesma ação de atualizar o Cardápio da semana.
4. O Cardápio da Casa já suporta nome livre, calorias, proteína e carboidrato, mas essa capacidade não é aproveitada no registro guiado do Ritmo.
5. Existem 32 refeições e 87 ingredientes no banco, mas eles não funcionam como biblioteca de decisão rápida dentro do Ritmo.
6. Receitas sem macros preenchidos ficam menos úteis apesar de seus ingredientes poderem permitir uma estimativa determinística.
7. A experiência mistura “planejar”, “registrar” e “fazer check-in” como ações separadas, embora para o uso diário elas frequentemente sejam a mesma decisão.

## Direção implementada

A nova jornada transforma a pergunta de “quantas calorias?” em “o que você comeu?”. O usuário pode:

- aceitar a sugestão;
- escolher uma refeição já salva;
- montar a refeição por componentes e gramas;
- ver calorias, proteína e carboidrato calculados automaticamente;
- confirmar uma única vez.

A confirmação atualiza o planejamento semanal pessoal e registra o consumo no Ritmo, mantendo as duas telas sincronizadas.

## Regras

- Sem IA ou estimativa por texto livre.
- Catálogo nutricional determinístico por 100 g para alimentos frequentes.
- Refeições salvas com macros próprios usam os valores cadastrados.
- Refeições salvas sem macros tentam estimativa somente quando ingredientes e unidades podem ser associados ao catálogo local.
- Alteração feita no Ritmo cria/atualiza o slot da semana do usuário atual, sem sobrescrever automaticamente o planejamento compartilhado de “Ambos”.
- O consumo do mesmo tipo no mesmo dia usa `referencia_chave`, evitando duplicação quando o usuário altera a escolha.

## Próximos refinamentos recomendados

Depois de uso real, o catálogo local pode migrar para uma tabela editável e ganhar favoritos/itens recentes. Isso não é necessário para o primeiro uso funcional e evita complexidade prematura.