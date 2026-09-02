# Auditoria — Alimentação no Ritmo e Cardápio da Casa

## Diagnóstico

O fluxo anterior dividia a mesma decisão entre três estruturas: receitas salvas (`refeicoes`), planejamento semanal (`planejamento_semana`/`planejamento_dias`) e consumo pessoal (`ritmo_consumos`/check-ins). Isso gerava duplicação e deixava o usuário responsável por conhecer calorias e macros ao registrar algo diferente do planejado.

## Evidências do banco de produção

- 32 refeições salvas.
- 30 das 32 já possuem calorias, proteína e carboidratos cadastrados.
- 87 ingredientes associados às refeições.
- `planejamento_dias` já suporta receita vinculada ou nome livre, além de calorias, proteína e carboidratos.
- `ritmo_consumos` já suporta vínculo com o planejamento e uma `referencia_chave` para atualização sem duplicar registros.

## Problemas encontrados

1. O card principal do Ritmo mostrava uma sugestão ou planejamento, mas o caminho para trocar não reutilizava de forma direta o catálogo de refeições salvas.
2. O registro manual de consumo pressupunha conhecimento nutricional do usuário.
3. Aceitar ou trocar uma refeição no Ritmo não era tratado como a mesma ação de atualizar o Cardápio da semana.
4. O Cardápio da Casa já suportava nome livre e macros, mas essa capacidade não era aproveitada no registro guiado do Ritmo.
5. O acervo de refeições e ingredientes não funcionava como biblioteca de decisão rápida dentro do Ritmo.
6. A experiência misturava “planejar”, “registrar” e “fazer check-in” como ações concorrentes, embora para almoço e jantar elas normalmente representem a mesma decisão.
7. Os controles alimentares apareciam em mais de um bloco na mesma tela, aumentando carga cognitiva e dúvida sobre onde alterar uma refeição.

## Direção implementada

A nova jornada transforma a pergunta de “quantas calorias?” em “o que você comeu?”. Para almoço e jantar, o usuário pode:

- aceitar a sugestão do acervo quando o dia ainda não tem cardápio;
- escolher outra refeição já salva;
- buscar uma refeição pelo nome;
- montar uma refeição por componentes e gramas;
- combinar proteína, carboidrato, legumes/salada e extras;
- acompanhar calorias, proteína e carboidratos sendo calculados durante a montagem;
- confirmar uma única vez.

A confirmação cria ou atualiza o slot pessoal do Cardápio daquela semana e registra o mesmo consumo no Ritmo. Se o usuário trocar a escolha depois, o registro do dia é atualizado em vez de duplicado.

## Simplificação da tela

Durante almoço e jantar, o novo card substitui os blocos antigos de “refeição de agora”, “plano de hoje” e registro manual de alimentação. O restante da tela continua mostrando água, movimento e demais informações do Ritmo. Um resumo compacto mostra calorias, proteína e carboidratos já registrados no dia.

Café da manhã e lanches permanecem no fluxo do plano alimentar pessoal nesta etapa. O construtor por componentes foi deliberadamente limitado a almoço e jantar, pois são os slots compartilhados com o Cardápio semanal. Isso evita misturar dois modelos de planejamento diferentes.

## Regras

- Sem IA ou inferência nutricional a partir de texto livre.
- Catálogo nutricional determinístico por 100 g para alimentos frequentes.
- Os valores calculados pelo construtor são estimativas práticas e variam conforme marca, corte e preparo.
- Refeições salvas com macros próprios usam os valores já cadastrados.
- Refeições salvas sem macros só recebem estimativa quando ingredientes e unidades podem ser associados ao catálogo local.
- Alteração feita no Ritmo cria/atualiza o slot da semana do usuário atual, sem sobrescrever silenciosamente o planejamento compartilhado de “Ambos”.
- O consumo do mesmo tipo no mesmo dia usa `referencia_chave`, evitando duplicação quando a escolha é alterada.

## Próximos refinamentos depois de uso real

O catálogo local pode futuramente migrar para uma tabela editável e ganhar recentes, favoritos e porções personalizadas por alimento. Isso deve ser guiado pelo uso real para não voltar a tornar a experiência mais complexa que a tarefa que ela resolve.