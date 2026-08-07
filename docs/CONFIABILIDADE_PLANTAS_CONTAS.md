# Confiabilidade: plantas e contas

## Plantas

### Causa

A versão anterior observava toda a árvore da Home com `MutationObserver`.
Enquanto a Home carregava e reorganizava componentes, cada alteração
reiniciava o temporizador de sincronização. Isso adiava a consulta que
transformava as plantas em controles clicáveis.

### Correção

A versão 4:

- aguarda diretamente o contexto autenticado;
- consulta as plantas assim que `supa` e `usuario` ficam disponíveis;
- integra a sincronização à função `carregarPlantasHome`;
- não observa toda a Home;
- usa delegação de eventos para que os controles respondam imediatamente;
- mostra um estado de carregamento quando o modal é aberto antes do término
  da consulta.

## Contas duplicadas

### Regra de identificação

A proteção segue esta ordem:

1. mesmo `email_message_id`;
2. mesma linha digitável, ignorando pontuação;
3. mesmo Pix Copia e Cola, ignorando espaços e diferenças de caixa;
4. conta existente sem código com o mesmo fornecedor, vencimento e valor.

Uma conta com código diferente não é bloqueada apenas por ter o mesmo nome
e vencimento.

### Proteção no banco

A migração 030 cria:

- normalização de linha digitável;
- normalização de Pix;
- índices únicos para boleto e Pix dentro da mesma Casa;
- RPC transacional `adicionar_conta_email_protegida`;
- trava transacional por cobrança para impedir duas importações simultâneas.

### Limpeza existente

A migração consolida somente duplicidades exatas de boleto ou Pix.

Ela:

- preserva uma conta paga quando houver;
- caso contrário, mantém a conta mais antiga;
- redireciona referências da caixa financeira;
- combina campos ausentes;
- remove a cópia.

Não há exclusão automática baseada apenas em nome ou vencimento.
