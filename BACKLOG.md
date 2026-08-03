# LifeOS — Backlog Vivo

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 02/08/2026 — Aba de Configurações v0.24+

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
| v0.18 | Módulo Plantas (40 plantas, rotinas, ficha, histórico) | Sim |
| v0.19 | Plantas: cadastro de novas plantas + edição de rotinas | Sim |
| v0.20 | Plantas: cuidado manual, remover planta, editar/remover eventos | Sim |
| v0.21 | Contas: histórico mensal, variação mês a mês, retroativo manual | Sim |
| v0.22 | Projetos pessoais — Onda 2 fechada | Sim |
| v0.23 | Estoque Fatia 4: taxa de consumo, estimativa, sugestão automática | Sim |
| v0.23+ | Geolocalização: /atalho/chegada + 6 locais mapeados | Sim |
| v0.24 | Editar e excluir com histórico: Tarefas, Contas, Estoque, Lista, Plantas, Rituais | Sim |
| v0.25 | Configurações: tokens Siri, locais estoque/compra configuráveis, histórico excluídos | Sim |
| — | UptimeRobot, teste de concorrência | Sim |

---

## 🕒 Onda 3 — restante

### Tablet da Casa
- Aguardando hardware (Mateus vai avisar quando chegar)
- Conteúdo: Tela Hoje sem projetos pessoais e sem tarefas privadas
- Layout a definir quando o tablet estiver em mãos

---

## 💭 Onda 4+ — integrações futuras

- **GhuMat** (IA) — resumos, sugestões, perguntas sobre o LifeOS
- **NFC** (seção 27.1) — tags em objetos e locais
- **Gmail** (seção 28) — leitura automática de boletos
- **Apple Saúde** (seção 29.3)
- **Refinamento de privacidade** — "pessoal protegido" (seção 8)

---

## Dívidas técnicas

- Os selects de local nos modais de inventário ainda usam lista hardcoded no HTML
  (o app.js já atualiza os selects de estoque dinamicamente, mas o modal de
  inventário precisa ser atualizado para usar a mesma função atualizarSelectsLocais)
- Arquivos temporários em `public/` podem ser removidos: `locais.js`, `patch_html.txt`, `patch_app.js`, `index_patch.js`
- README.md desatualizado
