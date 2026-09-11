# NFC-e — biblioteca de produtos do LifeOS

## Regra principal

Uma NFC-e é evidência de uma compra já realizada. Importar a nota não significa “colocar no carrinho”: significa **registrar a compra**, preservar o que havia sido planejado e encaminhar apenas os itens controláveis para a conferência do estoque.

Fluxo oficial:

`PDF/QR → leitura fiscal → normalização → conferência dos nomes → registrar compra → conferência de estoque`

## O que fica separado

- **Descrição fiscal:** texto original da nota, preservado para auditoria.
- **Nome canônico:** nome que o LifeOS usa no dia a dia.
- **Quantidade fiscal:** quantidade/unidade em que o estabelecimento vendeu o item.
- **Quantidade de estoque:** quantidade/unidade que deve entrar no estoque.
- **Planejado:** o que estava na lista antes da compra.

Exemplo: `ARR CARRET PARB 5kg`, `1 UN`, pode ser entendido como `Arroz`, comprado como `1 un` e entrando no estoque como `5 kg`.

## Prioridade de reconhecimento

1. Código fiscal + CNPJ do estabelecimento já aprendidos.
2. Descrição fiscal exata já aprendida.
3. Correspondência segura com um item que já estava na lista.
4. Correspondência segura com o estoque.
5. Item não reconhecido: a tela pede revisão do nome; ao confirmar, o LifeOS aprende para a próxima compra.

Modificadores de produto são preservados. `Iogurte`, `Iogurte grego`, `zero`, `integral`, `light` e equivalentes não podem ser mesclados silenciosamente.

## Estoque

A biblioteca pode armazenar um fator de conversão. Exemplos:

- pacote de arroz 5 kg: `1 UN` fiscal → `5 kg` de estoque;
- café 500 g: `1 UN` fiscal → `0,5 kg` de estoque;
- ovos 20 unidades: `1 UN` fiscal → `20 un` de estoque;
- produto pesado: `0,908 KG` fiscal → `0,908 kg` de estoque.

Itens duráveis ou que não devem ser controlados podem ser marcados como `ignorar`; a compra continua no histórico, mas não cria conferência de estoque.

## Idempotência

A chave da NFC-e identifica a compra. Uma chave já registrada não pode gerar uma segunda sessão de compra.

## Primeira biblioteca — Assaí São Gonçalo

O primeiro conjunto foi aprendido a partir da NFC-e de 08/09/2026 da SENDAS DISTRIBUIDORA S/A, CNPJ `06.057.223/0438-14`. Os mapeamentos confirmados ficam em `nfce_produto_mapeamentos` e podem ser ampliados com novas notas.

Ainda precisam de confirmação humana os códigos/descritivos abaixo:

- `63427` — `PAO ORIGIN 480G PLU`
- `1052208` — `LING T CAL ALEGR FC`
- `1251055` — `KIT SK S325+C200 ABA`
- `40308` — `BL LIPEX 35G RF C/2`
- `1015119` — `SC CRU GUAPEX 75X50`
- `1117422` — `SC XADREZ GUAPEX`
