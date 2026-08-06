# LifeOS Design System — v1

## Princípios

1. Tudo deve parecer parte do mesmo produto.
2. Hierarquia deve ser percebida antes da leitura.
3. Ações devem parecer ações; textos informativos não devem parecer botões.
4. Componentes nativos recebem acabamento visual consistente sem esconder seu comportamento.
5. Nenhum emoji é usado como ícone de interface.
6. O tema segue o sistema por padrão, com suporte futuro a escolha manual.
7. Espaçamento, borda e contraste organizam a página antes de sombras decorativas.

## Hierarquia tipográfica

- Legenda: 11 px
- Metadado: 12 px
- Texto: 14 px
- Título de item: 14–16 px
- Título de seção/modal: 20 px
- Destaque: 26 px ou mais

## Componentes

### Cards

- Superfície própria
- Borda discreta
- Raio consistente
- Separadores internos entre grupos
- Margem de segurança lateral

### Formulários

- Altura mínima de 46 px
- Labels acima do campo
- Foco com borda e halo da cor principal
- Checkbox e radio em 19 px, alinhados ao texto
- Select com indicador de abertura próprio

### Botões

- Primário: salvar, adicionar, concluir
- Secundário: voltar, cancelar, ações alternativas
- Perigo: excluir e remover
- Ícone: ação compacta sem texto

### Modais

- Fundo escurecido com desfoque
- Superfície elevada
- Cabeçalho separado do conteúdo
- Ações agrupadas no final

## Temas

O padrão é `system`, usando `prefers-color-scheme`. A API disponível no navegador é:

```js
window.lifeosTheme.set('system');
window.lifeosTheme.set('light');
window.lifeosTheme.set('dark');
```

## Protetor de tela do tablet

- Ativa após 10 minutos sem interação
- Fundo preto
- Logo em movimento lento
- Relógio com baixo contraste
- Primeiro toque apenas desperta
