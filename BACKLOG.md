# LifeOS — Backlog Vivo

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 02/08/2026 — Estoque Fatia 4 concluída (v0.23.0)

---

## ✅ Concluído (Onda 1 + Onda 2)

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
| v0.18 | Módulo Plantas (40 plantas, rotinas, ficha, histórico) | Sim |
| v0.19 | Plantas: cadastro de novas plantas + edição de rotinas | Sim |
| v0.20 | Plantas: cuidado manual, remover planta, editar/remover eventos | Sim |
| v0.21 | Contas: histórico mensal, variação mês a mês, retroativo manual | Sim |
| v0.22 | Projetos pessoais: privado por usuário, objetivos, tarefas, itens, progresso — Onda 2 fechada | Sim |
| v0.23 | Estoque Fatia 4: taxa de consumo, estimativa de dias, sugestão automática na lista | Sim |
| — | UptimeRobot (cold start resolvido) | Sim |
| — | Teste de concorrência | Sim |

---

## 📋 O que foi entregue na Onda 2

**Atalhos Siri (v0.17)**
- Endpoint `/atalho/lista` — adicionar item à lista por voz
- Endpoint `/atalho/tarefa` — criar tarefa por voz
- Endpoint `/atalho/estoque` — marcar item como acabou por voz
- Autenticação por token por usuário

**Módulo Plantas (v0.18–0.20)**
- 40 plantas reais cadastradas com espécies e rotinas
- Lista agrupada por cômodo com filtros de urgência
- Ficha individual com dados, rotinas e linha do tempo
- Cuidado manual por método (rega, troca de água, imersão, adubação, poda)
- Cadastro de novas plantas e espécies
- Edição de intervalos de rotina
- Remover planta (histórico preservado)
- Editar e remover eventos da linha do tempo
- Card na Tela Hoje

**Contas avançadas (v0.21)**
- Histórico mensal por conta (clicando na conta)
- Variação mês a mês (▲/▼)
- Retroativo manual por mês

**Projetos pessoais (v0.22)**
- Privacidade por usuário (Mateus só vê os seus)
- Objetivos (metas descritivas)
- Tarefas com visibilidade pública/privada
- Itens necessários com envio para lista de compras
- Progresso em % por tarefas concluídas
- Separação clara entre tarefas gerais e tarefas de projeto

---

## 🕒 Onda 3 — próxima fase (priorizada)

### ✅ 1. Estoque Fatia 4 — estimativa por consumo (v0.23.0)
- Taxa de consumo manual por item (ex: "1 rolo/semana")
- Sistema calcula quando o item vai acabar com base na taxa + quantidade atual
- Badge "Atenção" / "Acabando" no item
- Sugestão automática na lista com etiqueta "consumo" quando atingir o alerta

### 2. Geolocalização
- Notificação ao chegar em um local cadastrado (ex: mercado, farmácia)
- Verifica se há itens na lista com categoria correspondente ao local
- Se houver, envia notificação: "Você está no mercado. Tem X itens na lista."
- Requer: permissão de geolocalização no iPhone + lógica de matching por categoria
- Decisão pendente: como associar item da lista a um local? (por categoria? por tag?)

### 3. Tablet da Casa
- Sempre aberto no LifeOS, tela grande
- Exibe basicamente a Tela Hoje — sem projetos pessoais, sem tarefas privadas
- Layout adaptado para tela maior (definir quando o tablet chegar)
- Mateus vai revisar o layout quando tiver o hardware em mãos

---

## 💭 Onda 4+ — integrações futuras

- **GhuMat** (IA) — resumos, sugestões, perguntas sobre o LifeOS
- **NFC** (seção 27.1) — tags em objetos e locais
- **Gmail** (seção 28) — leitura automática de boletos
- **Apple Saúde** (seção 29.3)
- **Contas: Gmail** — leitura automática de boletos
- **Refinamento de privacidade** — "pessoal protegido" (seção 8)

---

## Dívidas técnicas

- Arquivos temporários em `public/`: `locais.js`, `patch_html.txt`, `patch_app.js`, `index_patch.js` podem ser removidos
- README.md desatualizado (ainda descreve a fundação)
