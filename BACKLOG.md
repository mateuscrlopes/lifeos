# LifeOS — Backlog Vivo

Este arquivo é a **fonte de verdade** sobre o que já foi feito, o que está em
andamento e o que ficou registrado para depois.

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 18/07/2026 (Estoque Fatia 3 — inventário rotativo — concluída)

---

## Legenda de status

- ✅ **Concluído** — implementado, testado em uso real, versionado no Git.
- 🕒 **Adiado (na fila)** — faz parte do produto, tem lugar definido, ainda não construído.
- 💭 **Futuro/ideia** — previsto no Documento Mestre, sem posição definida na fila ainda.

---

## ✅ Concluído

| Versão | Entrega | Testado em uso real |
|--------|---------|---------------------|
| v0.1.0 | Fundação: backend Node + conexão Supabase | Sim — rota /saude |
| v0.2.0 | Núcleo: tabelas casa/usuarios/eventos, RLS, perfis, login | Sim — login real dos dois |
| v0.3.0 | Lista de compras: adicionar/listar/comprar/editar/remover + log | Sim — ciclo completo |
| v0.4.0 | Primeira tela: login com token + lista no navegador | Sim — Mateus e Ghustavo |
| v0.5.0 | Lista em tempo real (sem F5) | Sim — duas telas simultâneas |
| v0.6.0 | Estoque Fatia 1: itens contáveis, status, ajuste +/−, abas | Sim — status muda por quantidade |
| v0.7.0 | Estoque Fatia 2: ponte com a lista (sugestão + reposição) | Sim — ciclo baixo→sugestão→compra→repõe |
| v0.8.0 | Contas: cadastro manual, status por vencimento, recorrência | Sim — status por cor + recorrência |
| v0.9.0 | Tela Hoje: painel que reúne compras/estoque/contas/tarefas | Sim — resumo + tudo em dia + cards clicáveis |
| v0.10.0 | Tarefas Fatia 1: responsável, conclusão, rotina recorrente | Sim — cria/conclui/rotina oferece próxima |
| v0.11.0 | Deploy no Render: LifeOS publicado nos dois iPhones | Sim — Mateus e Ghustavo abriram no celular |
| v0.12.0 | Estoque Fatia 1.5: três tipos + anti-duplicata | Sim — três tipos + aviso de duplicata |
| v0.13.0 | Faxina técnica: remove rotas obsoletas do backend | Sim — backend limpo |
| v0.14.0 | Estoque Fatia 3: inventário rotativo por ambiente (local, crítico, modal) | Sim — seleciona itens certos, grava inventário |
| — | Teste de concorrência (dois usuários na lista) | Sim — passou |

---

## Módulo Estoque — fatias

### ✅ Fatia 1 — Estoque manual e honesto (CONCLUÍDA)
### ✅ Fatia 1.5 — Três tipos de medição (CONCLUÍDA)
### ✅ Fatia 2 — Conexão estoque ↔ lista (CONCLUÍDA)
### ✅ Fatia 3 — Inventário rotativo (CONCLUÍDA — v0.14.0)
- Local por ambiente (12 opções definidas com Mateus).
- Campo crítico: item sempre entra no inventário.
- Critérios: crítico, última atualização >15 dias, status baixo/acabou.
- Modal de conferência: ajusta valor e grava quem conferiu quando.
- Critérios adiados para Fatia 4: confiança, consumo histórico, criticidade dinâmica.

### 🕒 Fatia 4 — Estimativa por consumo e confiança (ADIADA)
- Estimar saldo por histórico de compra e tempo; nível de confiança.
- O fluxo "arroz pode estar acabando" (Documento Mestre, seção 18.5).

---

## 🕒 Módulos adiados (na fila)

- **Tarefas Fatia 2 — rituais** (seção 21.3): planejamento semanal, revisão financeira,
  alinhamento do casal. Atenção: conteúdo do casal não expor no tablet.
- **Contas** — próximos passos: leitura por Gmail, histórico/variação, orçamento, contas pessoais.
- **Alimentação e refeições** (seção 22) — cardápio que gera compras.
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

- `locais.js` e `patch_*.txt/js` criados durante o desenvolvimento da Fatia 3 podem ser removidos da pasta `public/` — são arquivos de trabalho, não de produção.
- README.md desatualizado (ainda descreve a fundação).
