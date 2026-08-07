# Tema automático do Painel da Casa

## Horários

| Faixa | Tema |
|---|---|
| 06:00–17:59 | Claro |
| 18:00–05:59 | Escuro |

O horário utilizado é o horário local configurado no tablet.

## Alternância manual

O botão do cabeçalho mantém somente dois estados: sol e lua.

Ao alternar manualmente, a escolha permanece até o próximo marco automático:

- uma alteração feita durante o dia permanece até 18h;
- uma alteração feita durante a noite permanece até 6h.

Depois desse marco, o painel volta a seguir o horário automaticamente.

## Compatibilidade

O script grava apenas `light` ou `dark` em `lifeos:theme`. O valor antigo `system` é removido, evitando a combinação de fundo claro com componentes escuros que aparecia no tablet.
