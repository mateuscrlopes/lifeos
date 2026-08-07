# Contas no Painel da Casa

## Propósito

Permitir que as contas da Casa sejam consultadas e preparadas para pagamento diretamente no tablet da cozinha, sem copiar a interface do celular.

## Fluxo

1. Abrir **Contas**.
2. Visualizar pendentes ou pagas.
3. Abrir uma conta.
4. Exibir Pix, boleto, instruções ou documento.
5. Realizar o pagamento no aplicativo do banco.
6. Confirmar **Marcar como paga** no LifeOS.

O LifeOS não executa transações bancárias.

## Dados reutilizados

O módulo usa os mesmos campos da Central Financeira do celular:

- `fornecedor`
- `descricao_pagamento`
- `linha_digitavel`
- `pix_copia_cola`
- `qr_code_url`
- `documento_url`

A marcação de pagamento segue a mesma regra existente:

- `paga = true`
- `paga_em = agora`
- `pago_por = usuário atual`
- `atualizado_em = agora`

A atualização é limitada ao `id` da conta e à `casa_id` autenticada.

## Código visual

O módulo usa a mesma biblioteca já adotada pela Central Financeira:

- QR Code para Pix;
- Interleaved 2 of 5 para boletos compatíveis.

Caso a biblioteca externa não carregue, os botões de copiar continuam disponíveis.

## Limites desta versão

- Não edita dados de pagamento no tablet.
- Não abre aplicativos bancários.
- Não realiza agendamento ou transferência.
- Contas sem dados de pagamento orientam o cadastro pelo celular.
