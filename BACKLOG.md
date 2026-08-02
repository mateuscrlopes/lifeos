# LifeOS — Backlog Vivo

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 02/08/2026 — Contas v0.21.0 (histórico mensal + variação + retroativo)

---

## ✅ Concluído

| Versão | Entrega | Testado |
|--------|---------|---------|
| v0.1–0.5 | Fundação, núcleo, lista de compras, tela, tempo real | Sim |
| v0.6–0.7 | Estoque (3 tipos + ponte com lista) | Sim |
| v0.8 | Contas (status por vencimento + recorrência) | Sim |
| v0.9 | Tela Hoje (painel unificado) | Sim |
| v0.10 | Tarefas Fatia 1 (responsável + rotinas) | Sim |
| v0.11 | Deploy no Render (dois iPhones) | Sim |
| v0.12 | Estoque Fatia 1.5 (3 tipos + anti-duplicata) | Sim |
| v0.13 | Faxina técnica | Sim |
| v0.14 | Estoque Fatia 3 (inventário rotativo) | Sim |
| v0.15 | Alimentação (cardápio + lista de ingredientes) | Sim |
| v0.16 | Rituais (pauta + sessões + histórico) — Onda 1 fechada | Sim |
| v0.17 | Atalhos Siri: /atalho/lista + /atalho/tarefa + /atalho/estoque | Sim |
| v0.18 | Módulo Plantas (40 plantas, rotinas, ficha, histórico, card no Hoje) | Sim |
| v0.19 | Plantas: cadastro de novas plantas + edição de rotinas | Sim |
| v0.20 | Plantas: cuidado manual, remover planta, editar/remover eventos | Sim |
| v0.21 | Contas: histórico mensal, variação mês a mês, retroativo manual | Sim |
| — | UptimeRobot configurado (cold start resolvido) | Sim |
| — | Teste de concorrência | Sim |

---

## 📋 Módulo Plantas — o que foi entregue (v0.18)

**Banco de dados:**
- `especies` — 23 espécies cadastradas
- `plantas` — 40 plantas reais (PL-001 a PL-040) com código, etiqueta, cômodo, posição, método, perfil hídrico
- `planta_rotinas` — uma rotina por planta (Verificar e regar / Trocar a água / Fazer imersão)
- `planta_eventos` — evento de cadastro registrado para cada planta
- `planta_fotos` — tabela criada, interface de upload futura
- `tarefas` ganhou `planta_id` e `rotina_id` (opcionais)

**Tela (aba 🌿):**
- Lista agrupada por cômodo com filtros (Todas / Vencidas / Hoje / Em breve / Sala / Outros)
- Ponto colorido por perfil hídrico (azul=baixo, verde=alto, laranja=médio)
- Botão "Cuidar" nas plantas com rotina vencida ou vencendo hoje
- Ficha individual com dados, rotinas e linha do tempo de eventos
- Card na Tela Hoje mostrando quantas plantas precisam de cuidado

---

## 🕒 Próximos passos sugeridos

### Módulo Plantas — fatias futuras
- ✅ **Cadastro de novas plantas** — v0.19.0
- ✅ **Edição de rotinas** — v0.19.0
- ✅ **Registro manual de cuidado** — v0.20.0
- ✅ **Remover planta** — v0.20.0 (histórico preservado)
- ✅ **Editar/remover eventos da linha do tempo** — v0.20.0

### Onda 2 — restante
- **Estoque Fatia 4** — estimativa por consumo e confiança
- ✅ **Contas: histórico e variação** — v0.21.0
- **Contas: Gmail** — leitura automática de boletos (Onda 3)
- **Projetos pessoais** — ver descrição detalhada abaixo
- **Projetos pessoais** (seção 24) — decisão arquitetural pendente antes de implementar
  - Aba privada por usuário (não aparece no tablet)
  - Projetos genéricos com nome, objetivo e cronograma
  - Divididos em etapas com prazo (dias/semanas)
  - Etapas viram tarefas do módulo existente (responsável = dono do projeto)
  - Check diário/semanal de execução → gera histórico de evolução
  - Integração com estoque: item de consumo do projeto (ex: whey) → quando check acumula consumo → sugere reposição na lista
  - Perguntas a responder antes de implementar:
    1. Um projeto tem data de início e fim, ou é contínuo?
    2. A evolução é calculada por etapas concluídas ou por tempo?
    3. O check diário é uma tarefa recorrente ou um controle separado?

---

## 💭 Futuro / integrações

- **GhuMat** (IA) — Onda 3+
- **NFC** (seção 27.1)
- **Geolocalização** (seção 26)
- **Gmail** (seção 28)
- **Apple Saúde** (seção 29.3)
- **Notificações** (seção 14)
- **Tablet da Casa** (seção 11)
- **Refinamento de privacidade** — "pessoal protegido" (seção 8)

---

## Dívidas técnicas

- Arquivos temporários em `public/`: `locais.js`, `patch_html.txt`, `patch_app.js`, `index_patch.js` podem ser removidos
- README.md pode ser atualizado para refletir v0.18.0
