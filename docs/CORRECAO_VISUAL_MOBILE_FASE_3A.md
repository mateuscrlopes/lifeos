# Correção visual mobile da Fase 3A

## Problema

O módulo mobile foi carregado diretamente por `app.js`, mas a importação
anterior também era responsável por carregar o CSS base do cartão.

Sem essas regras, o botão foi renderizado como HTML cru. Os SVGs herdaram
regras globais e ocuparam grande parte da tela.

## Solução

O arquivo `alimentacao-contextual-mobile-fix.css` passa a conter todas as
regras necessárias, com escopo limitado a `#acMobileDestaque`.

Os ícones recebem dimensões máximas explícitas:

- ícone da refeição: 21 × 21 px;
- seta: 18 × 18 px.

O carregador passa de `v=1` para `v=2`, forçando o navegador a buscar a
versão corrigida após o deploy.
