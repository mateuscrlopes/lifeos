# LifeOS — Backlog Vivo

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 18/07/2026 (Alimentação e refeições — v0.15.0 — concluída)

---

## ✅ Concluído

| Versão | Entrega | Testado em uso real |
|--------|---------|---------------------|
| v0.1.0 | Fundação: backend Node + conexão Supabase | Sim |
| v0.2.0 | Núcleo: tabelas, RLS, perfis, login | Sim |
| v0.3.0 | Lista de compras: CRUD + log | Sim |
| v0.4.0 | Primeira tela: login com token | Sim — Mateus e Ghustavo |
| v0.5.0 | Lista em tempo real | Sim |
| v0.6.0 | Estoque Fatia 1: itens contáveis, status, ajuste | Sim |
| v0.7.0 | Estoque Fatia 2: ponte estoque ↔ lista | Sim |
| v0.8.0 | Contas: cadastro manual, status, recorrência | Sim |
| v0.9.0 | Tela Hoje: painel unificado | Sim |
| v0.10.0 | Tarefas Fatia 1: responsável, conclusão, rotinas | Sim |
| v0.11.0 | Deploy no Render: LifeOS nos dois iPhones | Sim |
| v0.12.0 | Estoque Fatia 1.5: três tipos + anti-duplicata | Sim |
| v0.13.0 | Faxina técnica: remove rotas obsoletas | Sim |
| v0.14.0 | Estoque Fatia 3: inventário rotativo por ambiente | Sim |
| v0.15.0 | Alimentação: refeições, cardápio semanal, lista de ingredientes, card no Hoje | Sim |
| — | Teste de concorrência | Sim — passou |

---

## 🕒 Módulos adiados (na fila)

- **Tarefas Fatia 2 — rituais** (seção 21.3): planejamento semanal, revisão
  financeira, alinhamento do casal. Atenção: conteúdo do casal não expor no tablet.
- **Estoque Fatia 4** — estimativa por consumo e confiança (seção 18.5).
- **Contas** — leitura por Gmail, histórico/variação, orçamento, contas pessoais.
- **Projetos pessoais** (seção 24).

---

## 💭 Futuro / integrações

- **GhuMat** (IA) — Onda 3+.
- **Siri e Atalhos** (seção 27).
- **NFC** (seção 27.1).
- **Geolocalização** (seção 26).
- **Gmail / contas por e-mail** (seção 28).
- **Apple Saúde** (seção 29.3).
- **Notificações** (seção 14).
- **Tablet da Casa** (seção 11).
- **Refinamento de privacidade** — "pessoal protegido" (seção 8).

---

## Dívidas técnicas

- `locais.js`, `patch_html.txt`, `patch_app.js` na pasta `public/` podem ser removidos.
- README.md desatualizado (ainda descreve a fundação).
