# LifeOS — Política oficial de arquitetura do frontend

Status: **norma de engenharia**

Esta política existe para impedir que o frontend volte a crescer por sobreposição de correções. A regra central é simples:

> Cada superfície visual, comportamento ou regra de negócio tem um único dono.

Uma correção não pode ser implementada criando uma segunda camada que observa, intercepta ou redesenha a primeira. O defeito deve ser corrigido no proprietário da funcionalidade.

## 1. Responsabilidades por tecnologia

- **HTML**: estrutura semântica e pontos de montagem estáveis.
- **CSS**: aparência, responsividade, tokens e estados visuais.
- **JavaScript de tela**: renderização e eventos da tela.
- **JavaScript de domínio**: regras que não dependem do DOM.
- **Services**: acesso a Supabase, APIs e integrações.
- **JSON**: transporte/configuração de dados; nunca é proprietário da aparência.

## 2. Fonte oficial de cada decisão

| Alteração | Proprietário |
| --- | --- |
| Cores, raios, sombras, espaçamento e tipografia | `public/tokens.css` |
| Aparência de componentes compartilhados | `public/styles/components.css` |
| Ícones compartilhados | `public/ui/icons.js` |
| Toasts | `public/ui/toast.js` |
| Confirmações | `public/ui/confirm.js` |
| Ciclo de vida de modal/overlay | `public/ui/modal.js` |
| Ordem de inicialização do mobile | `public/app-bootstrap.js` |
| Navegação | módulo proprietário da navegação; nunca um patch visual |
| Regra de estoque | `public/status-estoque.js` e domínio correspondente |
| Regra de conta | domínio de contas |
| Regra do Ritmo | módulo do Ritmo correspondente |
| Banco/schema/RLS | `db/NNN_*.sql` |
| APIs e integrações privilegiadas | `src/` |

## 3. Regra de propriedade de DOM

Um nó de montagem tem apenas um renderer proprietário. Outros módulos entregam **dados**, não reescrevem o DOM desse nó depois.

Superfícies oficiais:

| Superfície | Dono |
| --- | --- |
| `#cardsHoje` / `#metricasHoje` / hero do Hoje | Hoje |
| `#ritmoMount` | Ritmo |
| `#listaPlantas` | Plantas |
| Central Financeira | Financeiro |
| Acertos | Acertos |
| `#itens`, `#itensEstoque`, `#itensTarefas` | Casa |
| Tablet | shell/telas do tablet; nunca a interface mobile comprimida |

Um módulo pode solicitar navegação para outro, mas não pode editar o DOM interno do outro.

## 4. Componentes

### Botões

O HTML/renderer escolhe apenas a intenção (`primary`, `secondary`, `danger`, `ghost`, ícone). A aparência vem do componente compartilhado. Não criar uma nova classe de botão só para mudar cor, altura ou raio.

### Modais

Todo overlay deve respeitar o mesmo ciclo de vida:

1. abre;
2. bloqueia somente o fundo necessário;
3. mantém foco dentro do diálogo;
4. fecha por ação explícita, backdrop quando permitido ou `Escape`;
5. remove o bloqueio do fundo;
6. devolve foco ao elemento que abriu;
7. não deixa overlay invisível interceptando cliques.

### Ícones

SVG compartilhado deve estar no catálogo de ícones. Não copiar o mesmo `path` para telas diferentes.

## 5. Proibições

A partir desta política, é proibido introduzir em produção:

- novos arquivos permanentes `*-fix.js`, `*-polish.js`, `phase*-polish.js` ou equivalentes;
- `MutationObserver` global usado para "corrigir" interface depois da renderização;
- listener global em fase de captura para substituir uma ação normal de tela;
- CSS injetado por JavaScript como forma normal de carregar estilos;
- novo `onclick="..."` inline;
- novo SVG duplicado dentro de uma tela quando o ícone é reutilizável;
- acesso a DOM de outro módulo para reorganizar, ocultar ou substituir sua interface;
- `!important` como solução padrão de especificidade;
- uma regra de negócio nova dentro de uma camada chamada QA/refinement/polish;
- exclusão permanente sem passar pela política de histórico quando o domínio exigir restauração.

Código legado pode existir temporariamente durante a migração, mas não pode receber novas responsabilidades. Cada migração deve reduzir, nunca aumentar, a quantidade de camadas.

## 6. Inicialização

`status-estoque.js` é domínio e deve ser livre de efeitos colaterais. Importar cálculo de estoque nunca pode inicializar Financeiro, Ritmo, QA ou estilos.

O mobile tem um único ponto de entrada: `app-bootstrap.js`.

Ordem conceitual:

1. compatibilidade legada estritamente necessária;
2. aguardar estilos já solicitados;
3. instalar UI compartilhada oficial;
4. inicializar a aplicação;
5. disparar sinal de prontidão.

O objetivo da migração é reduzir progressivamente a etapa 1 até ela desaparecer.

## 7. Eventos

- Event handlers com argumentos devem usar wrappers explícitos: `() => abrirEditor(null)` e não `addEventListener('click', abrirEditor)` quando a função aceita um parâmetro de domínio.
- Evento do navegador nunca deve ser confundido com entidade de negócio.
- A tela é responsável por ligar e desligar seus eventos.
- Não usar timers, microtasks ou `requestAnimationFrame` para "ganhar uma corrida" contra outro renderer. Se houver corrida, há dois donos e a arquitetura deve ser corrigida.

## 8. Dados

Meta final:

`Tela → Service → regra de domínio → Supabase/API`

A migração será incremental. Enquanto houver CRUD legado direto no frontend, ele permanece no módulo proprietário, sem ser transferido para uma camada de refinamento.

## 9. Qualidade mínima

Nenhuma fase de consolidação é concluída somente porque o JavaScript compila.

A saída deve verificar, conforme aplicável:

- testes unitários;
- validação sintática;
- contratos arquiteturais;
- ausência de erro de console nos fluxos exercitados;
- modal abre e fecha sem overlay residual;
- navegação mantém estado esperado e reinicia scroll quando apropriado;
- ações críticas continuam clicáveis após abrir/fechar modais;
- layout sem overflow horizontal nas larguras suportadas;
- mobile e tablet não compartilham uma tela apenas por compressão visual.

## 10. Política de alteração futura

Antes de alterar qualquer elemento, responder internamente:

1. Quem é o dono?
2. A mudança pertence a estrutura, estilo, comportamento, domínio ou dados?
3. Existe componente/tela oficial para isso?
4. Estou corrigindo a origem ou criando uma camada posterior?
5. Depois da alteração, existe menos ou a mesma quantidade de donos? Se a resposta for "mais", a mudança não deve entrar.

Esta política prevalece sobre padrões antigos ainda presentes no repositório.