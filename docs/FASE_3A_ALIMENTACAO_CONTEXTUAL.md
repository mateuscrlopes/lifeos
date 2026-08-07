# Fase 3A — Alimentação contextual

## Escopo

Esta fase reutiliza integralmente as tabelas já existentes:

- `refeicoes`;
- `refeicao_ingredientes`;
- `planejamento_semana`;
- `planejamento_dias`.

Não há migração de banco.

## Tablet

A Home recebe uma faixa contextual antes dos indicadores.

Horário considerado:

- das 05h às 14h59: almoço;
- das 15h às 04h59: jantar.

A faixa apresenta:

- momento atual;
- tipo da refeição;
- nome;
- responsável;
- quantidade de ingredientes cadastrados.

Ao tocar, abre um painel com:

- refeição atual;
- ingredientes;
- quantidades;
- observação;
- porções;
- planejamento de segunda a sexta.

Quando a refeição não estiver definida, a faixa mostra o estado vazio e
permite abrir a visão semanal.

## Celular

O cartão antigo “Cardápio de hoje” é substituído por um destaque compacto
no topo da lista da tela Hoje.

Ao tocar, abre a subaba de Cardápio que já existe.

Não há duplicação visual.

## Limites mantidos

A estrutura atual permite somente:

- almoço;
- jantar;
- segunda a sexta;
- um responsável geral por planejamento.

Não entram nesta fase:

- café da manhã;
- lanches;
- receitas com modo de preparo;
- plano alimentar individual;
- horários configuráveis;
- envio de ingredientes para compras.
