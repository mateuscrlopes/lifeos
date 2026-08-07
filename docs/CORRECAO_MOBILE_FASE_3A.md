# Correção mobile da Fase 3A

## Causa

O tablet carregava `alimentacao-contextual.js` diretamente por um loader
próprio. No celular, o mesmo módulo era importado indiretamente por
`status-estoque.js`, arquivo que já fazia parte da cadeia antiga do
aplicativo e podia permanecer em cache.

A tela Hoje também possuía uma regra anterior que escolhia:

```text
almoço || jantar
```

Isso permitia que, à noite, o almoço fosse mostrado como Destaque do dia
quando não existisse jantar.

## Ajuste

A correção:

- é importada diretamente por `app.js`;
- consulta apenas a refeição correspondente ao horário atual;
- garante o cartão compacto no início de `cardsHoje`;
- remove o cartão antigo “Cardápio de hoje”;
- corrige o Hero apenas quando ele estiver usando a regra genérica antiga;
- não modifica o fluxo do tablet.
