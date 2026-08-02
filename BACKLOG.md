# LifeOS — Backlog Vivo

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 02/08/2026 — Onda 2 em andamento

---

## ✅ Concluído (Onda 1 + início da Onda 2)

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
| v0.11.0 | Deploy no Render | Sim — dois iPhones |
| v0.12.0 | Estoque Fatia 1.5: três tipos + anti-duplicata | Sim |
| v0.13.0 | Faxina técnica: backend limpo | Sim |
| v0.14.0 | Estoque Fatia 3: inventário rotativo | Sim |
| v0.15.0 | Alimentação: refeições, cardápio, lista de ingredientes | Sim |
| v0.16.0 | Rituais: pauta, sessões, histórico, gera tarefas | Sim — Onda 1 fechada |
| v0.17.0 | Atalhos Siri: /atalho/lista + /atalho/tarefa + /atalho/estoque | Sim — testados local e Render |
| — | UptimeRobot: ping periódico evita cold start | Sim — configurado |
| — | Teste de concorrência | Sim — passou |

---

## 📋 Próximo — Módulo Plantas (decisão arquitetural alinhada)

Arquitetura decidida em conversa, ainda não implementada.

### Modelo de dados acordado (4 tabelas)

**`especies`** — conhecimento compartilhado:
- id, nome popular, nome científico, família
- luz necessária, frequência de rega sugerida, frequência de adubação sugerida
- substrato recomendado, observações gerais

**`plantas`** — o indivíduo:
- id, especie_id (opcional), apelido, origem, data de aquisição
- cômodo, posicionamento (chão/mesa/prateleira/janela/suspenso/outro)
- tipo/material/tamanho do vaso, substrato atual
- frequência de rega real (herda da espécie, pode ser sobrescrita)
- frequência de adubação real (idem)
- estado atual, nível de saúde, data da última avaliação
- observações livres

**`planta_eventos`** — linha do tempo:
- id, planta_id, tipo, data, notas
- tipos: rega, adubação, poda, troca_vaso, troca_substrato,
  mudança_ambiente, praga, muda, floresceu, morreu, observação

**`planta_fotos`** — galeria:
- id, planta_id, url, data, legenda
- tabela criada desde o início; interface de upload vem depois

### Decisões tomadas
- Separar Espécie e Planta desde o início (evita duplicação para quem tem várias da mesma espécie)
- Frequência de rega: sugestão na espécie, override por planta
- Integração com tarefas: campo `planta_id` opcional na tabela `tarefas`
- Fotos: tabela criada agora, interface de upload em versão futura
- Primeira versão sem fotos não é bloqueio para uso

### Pergunta em aberto (responder antes de implementar)
- Ciclo automático: ao concluir tarefa de rega, registrar evento em `planta_eventos` automaticamente?
  (Mateus não respondeu ainda — responder antes de começar o SQL)

### Fatia 2 futura — Mapa da Casa (decisão arquitetural tomada)
- O mapa é apenas uma camada visual; localização pertence ao cadastro da planta
- Implementar após o módulo Plantas estar estável
- Estrutura: campo `comodo` e `posicionamento` já na tabela `plantas`
- Mapa SVG interativo: versão futura, não agora

---

## 🕒 Onda 2 — restante

- **Atalhos Siri adicionais**: configurar "Tarefa da Casa" e "Acabou da Casa" no iPhone (endpoints prontos)
- **Estoque Fatia 4**: estimativa por consumo e confiança (seção 18.5)
- **Contas avançadas**: leitura por Gmail, histórico, variação mês a mês
- **Projetos pessoais** (seção 24)

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
- **Mapa da Casa** — camada visual sobre o módulo Plantas (após Plantas estável)

---

## Dívidas técnicas

- Arquivos temporários em `public/`: `locais.js`, `patch_html.txt`, `patch_app.js` podem ser removidos
- README.md pode ser atualizado para refletir v0.17.0
