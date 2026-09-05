# LifeOS

Sistema operacional pessoal e doméstico de Mateus e Ghustavo.

O LifeOS reúne a rotina da Casa e os módulos pessoais em uma única aplicação: Hoje, Casa, Financeiro, Plantas, Ritmo, projetos, rituais, configurações e uma experiência própria para o tablet da Casa.

## Arquitetura do frontend

A política oficial está em [`docs/ARQUITETURA_FRONTEND.md`](docs/ARQUITETURA_FRONTEND.md).

Princípio central:

> Cada superfície visual, comportamento ou regra de negócio tem um único dono.

Baseline atual:

- `public/app-bootstrap.js`: único bootstrap do mobile;
- `public/hoje-view.js` + `public/hoje.css`: owner da tela Hoje;
- `public/casa-view.js`: navegação interna da Casa;
- `public/navigation.js`: navegação mobile e seções do Mais;
- `public/plantas-view.js`: lista visual de Plantas;
- `public/central-financeira.js`: Central Financeira, sem reescrever a tela Hoje;
- `public/tablet-house-v4.js`: experiência nativa do tablet da Casa;
- `public/status-estoque.js`: regra de estoque sem efeitos colaterais;
- `public/ui/`: ícones, toast, confirmação e ciclo de vida de modais compartilhados.

Camadas antigas ainda listadas em `app-bootstrap.js` existem somente como compatibilidade durante a migração. Elas não devem receber novas responsabilidades.

## Desenvolvimento

Requer Node.js 22 ou superior.

```bash
npm ci
npm test
npm run check
npm start
```

`npm test` executa os testes de regressão e contratos arquiteturais. `npm run check` valida sintaxe dos módulos críticos e owners consolidados.

## Estrutura principal

- `public/`: frontend mobile e tablet;
- `src/`: servidor, APIs e integrações privilegiadas;
- `db/`: migrations, funções e políticas do banco;
- `test/`: testes funcionais, de regressão e arquitetura;
- `docs/`: documentação técnica e de produto;
- `android-gumate/`: cliente Android do Gumate.

## Qualidade

O workflow `LifeOS quality` roda testes e validação estática em pull requests. Mudanças arquiteturais devem manter os contratos de ownership em `test/architecture-policy.test.js` verdes.
