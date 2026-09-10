# LifeOS — Fluxo de Compras e Estoque

Este documento é a fonte de verdade da experiência de compras da Casa.

## Princípio

O usuário não deve trabalhar para manter o LifeOS. O fluxo precisa reduzir esforço em três momentos: preparar a compra em casa, registrar o que realmente foi pego no mercado e incorporar a compra ao estoque quando voltar.

## Entidades e responsabilidades

### Estoque
Responde: **quanto existe em casa agora?**

- É o saldo real da Casa.
- Pode subir ou descer manualmente a qualquer momento.
- Nunca é limitado pela quantidade da lista de compras.
- Entradas de compra somam ao saldo existente.
- Saídas por consumo diminuem o saldo existente.

### Quantidade mínima
Responde: **a partir de quando preciso ser alertado?**

Não representa a quantidade que deve ser comprada.

### Quantidade ideal
Responde: **quanto normalmente quero ter em casa?**

Quando configurada, pode apoiar a sugestão de reposição. Exemplo: estoque 1 kg, ideal 4 kg → sugestão de compra 3 kg.

### Lista de compras
Responde: **quanto estou planejando comprar?**

- É uma intenção.
- Não altera o estoque.
- Não substitui o saldo real.
- Um item ligado ao estoque deve reutilizar o mesmo vínculo em vez de criar duplicatas.

### Carrinho / compra
Responde: **quanto eu realmente peguei?**

Planejado e comprado são dados diferentes. Se o usuário planejou 3 e pegou 2, o histórico deve preservar os dois valores.

### Conferência pós-compra
Responde: **o que realmente entrou em casa?**

Para itens quantitativos, a regra é: `novo estoque = estoque atual + quantidade que entrou`.

## Experiência desejada

### 1. Preparar a compra em casa

- Busca instantânea no estoque.
- Busca por qualquer parte do nome, sem exigir acentos ou caixa exata.
- A partir de um item do estoque, ação direta para adicionar/atualizar a lista.
- Se já existir item pendente ligado ao mesmo estoque, atualizar em vez de duplicar.
- Mostrar estoque atual e, quando existir, quantidade ideal.

### 2. Durante a compra

- Busca sempre disponível.
- Um toque em um item planejado coloca a quantidade planejada no carrinho.
- Ajustes de quantidade e preço só são necessários quando algo divergir.
- Preço digitado em centavos da direita para a esquerda.
- Quando houver quantidade maior que 1, o usuário informa preço unitário e o LifeOS calcula subtotal.
- Item inesperado deve procurar primeiro na lista e no estoque antes de criar algo novo.

### 3. Depois da compra

- Finalizar a compra grava o histórico, mas não apaga a distinção entre planejado e comprado.
- Itens vinculados ao estoque ficam disponíveis para conferência.
- A entrada soma ao estoque existente; nunca substitui o saldo real por engano.

## Busca e normalização

A busca deve ser permissiva; a associação automática deve ser conservadora.

Exemplos:

- `iog` encontra `Iogurte` e `Iogurte grego`.
- `grego` encontra `Iogurte grego`.
- `Iogurte` e `Iogurte grego` **não** devem ser fundidos silenciosamente.
- Palavras como `grego`, `integral`, `zero`, `natural`, `sem lactose` e similares podem diferenciar produtos e não devem ser descartadas na normalização de identidade.
- Tamanho de embalagem pode ser ignorado para busca, mas não deve apagar uma diferença sem confirmação.

## Regra dos botões + / − do estoque

O botão representa uma unidade da unidade exibida ao usuário.

- 1 kg + 1 → 2 kg
- 2 un + 1 → 3 un
- 500 g + 1 → 501 g

Mudanças maiores continuam possíveis por edição direta. O botão não deve inferir incrementos ocultos de 100 g ou 100 ml.

## Pendências relacionadas

- Leitor de NFC-e acima de qualquer modal da lista/mercado.
- Fallback de NFC-e por navegador e importação de PDF/print.
- Associação conservadora dos itens da nota com itens conhecidos da Casa.
- Quantidade e preço unitário em itens inesperados.
- Campo monetário em centavos em todos os fluxos de mercado.
- Busca no estoque, lista e modo mercado.
- Redução de toques no mercado.
