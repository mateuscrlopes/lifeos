# Painel da Casa v3

## Escopo

Esta entrega é deliberadamente pequena:

- eleva a legibilidade das informações abaixo do contexto principal;
- mantém a saudação e o topo aprovados;
- torna os cuidados das plantas acionáveis no tablet;
- não antecipa o fluxo financeiro do tablet.

## Cuidados das plantas

O painel consulta plantas ativas e suas rotinas. São apresentadas rotinas:

- sem próxima data; ou
- com próxima data igual ou anterior ao dia atual.

O registro utiliza a RPC `registrar_cuidado_planta`, criada na migration 029. Dessa forma, a atualização da rotina e a criação do evento continuam atômicas.

Cada rotina é concluída separadamente. Plantas com mais de um cuidado pendente mostram todos eles no painel.

## Legibilidade

As regras específicas de telas baixas em paisagem estavam reduzindo novamente os textos para 15 px e os metadados para 11 px. A v3 eleva:

- nomes principais para 17 px;
- metadados para 13 px;
- títulos de seção para 21 px;
- valores e etiquetas proporcionalmente.

O topo contextual não é ampliado porque já foi aprovado no tablet físico.
