# LifeOS — Backlog Vivo

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 18/07/2026 — Onda 1 CONCLUÍDA 🎉

---

## ✅ Concluído (Onda 1)

| Versão | Entrega | Testado |
|--------|---------|---------|
| v0.1.0 | Fundação: backend Node + Supabase | Sim |
| v0.2.0 | Núcleo: tabelas, RLS, perfis, login | Sim |
| v0.3.0 | Lista de compras: CRUD + log | Sim |
| v0.4.0 | Primeira tela: login com token | Sim — dois usuários |
| v0.5.0 | Lista em tempo real | Sim |
| v0.6.0 | Estoque Fatia 1: itens contáveis, status | Sim |
| v0.7.0 | Estoque Fatia 2: ponte estoque ↔ lista | Sim |
| v0.8.0 | Contas: cadastro manual, status, recorrência | Sim |
| v0.9.0 | Tela Hoje: painel unificado | Sim |
| v0.10.0 | Tarefas Fatia 1: responsável, conclusão, rotinas | Sim |
| v0.11.0 | Deploy no Render: LifeOS nos dois iPhones | Sim |
| v0.12.0 | Estoque Fatia 1.5: três tipos + anti-duplicata | Sim |
| v0.13.0 | Faxina técnica: backend limpo | Sim |
| v0.14.0 | Estoque Fatia 3: inventário rotativo | Sim |
| v0.15.0 | Alimentação: refeições, cardápio, lista de ingredientes | Sim |
| v0.16.0 | Rituais: pauta, sessões, histórico, gera tarefas | Sim |
| — | Teste de concorrência | Sim — passou |

---

## 🕒 Onda 2 — Integrações e refinamentos (próxima fase)

### Módulos incompletos (fatias adiadas)
- **Estoque Fatia 4** — estimativa por consumo e confiança (seção 18.5).
- **Tarefas Fatia 2 — rituais avançados**: pauta dinâmica, integração com Calendar.
- **Contas avançadas**: leitura por Gmail, histórico, variação mês a mês, orçamento.

### Módulos novos
- **Projetos pessoais** (seção 24).
- **Saúde e bem-estar** (seção 23): passos, treino, água via Apple Saúde/Atalhos.

### Integrações
- **Siri e Atalhos** (seção 27): "adicionar leite à lista", "abrir inventário do banheiro".
- **NFC** (seção 27.1): tags em objetos e locais.
- **Geolocalização** (seção 26): chegada ao mercado.
- **Gmail** (seção 28): leitura de contas por e-mail.
- **Apple Saúde** (seção 29.3).
- **GhuMat** (IA — Onda 3+): resumos, sugestões, perguntas.
- **Notificações** (seção 14).
- **Tablet da Casa** (seção 11): painel doméstico.
- **Refinamento de privacidade**: "pessoal protegido" (seção 8).

---

## Dívidas técnicas

- Arquivos temporários em `public/`: `locais.js`, `patch_html.txt`, `patch_app.js` podem ser removidos.
- README.md desatualizado.
