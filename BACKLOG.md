# LifeOS — Backlog Vivo

Este arquivo é a **fonte de verdade** sobre o que já foi feito, o que está em
andamento e o que ficou registrado para depois. Ele existe para que nada
"deixado para depois" se perca. Regra: quando uma decisão de escopo é tomada
na conversa, ela é registrada AQUI antes ou junto da implementação.

> Sempre que uma nova sessão começar, este arquivo deve ser lido primeiro,
> junto do Documento Mestre. Ele reflete o estado real do projeto.

Última atualização: 18/07/2026 (Tela Hoje — painel que reúne os módulos — concluída)

---

## Legenda de status

- ✅ **Concluído** — implementado, testado em uso real, versionado no Git.
- 🔨 **Em andamento** — sendo construído agora.
- 📋 **Próximo** — decidido, é o que vem logo em seguida.
- 🕒 **Adiado (na fila)** — faz parte do produto, tem lugar definido, ainda não construído.
- 💭 **Futuro/ideia** — previsto no Documento Mestre, sem posição definida na fila ainda.

---

## ✅ Concluído

| Versão | Entrega | Testado em uso real |
|--------|---------|---------------------|
| v0.1.0 | Fundação: backend Node + conexão Supabase | Sim — rota /saude |
| v0.2.0 | Núcleo: tabelas casa/usuarios/eventos, RLS, perfis, login | Sim — login real dos dois |
| v0.3.0 | Lista de compras: adicionar/listar/comprar/editar/remover + log de eventos | Sim — ciclo completo |
| v0.4.0 | Primeira tela: login com token + lista no navegador | Sim — Mateus e Ghustavo |
| v0.5.0 | Lista em tempo real (sem F5) | Sim — duas telas simultâneas |
| v0.6.0 | Estoque Fatia 1: itens contáveis, status, ajuste +/−, abas | Sim — status muda por quantidade |
| v0.7.0 | Estoque Fatia 2: ponte com a lista (sugestão + reposição na compra) | Sim — ciclo baixo→sugestão→compra→repõe |
| v0.8.0 | Contas: cadastro manual, status por vencimento, recorrência | Sim — status por cor + recorrência |
| v0.9.0 | Tela Hoje: painel que reúne compras/estoque/contas (só o que precisa atenção) | Sim — resumo + tudo em dia + cards clicáveis |
| —      | Teste de concorrência (dois usuários na lista) | Sim — passou |

---

## 🔨 / 📋 Em foco agora

**Módulo: Estoque** — Fatia 1 concluída (v0.6.0). Próximas fatias abaixo.

### ✅ Fatia 1 — Estoque manual e honesto (CONCLUÍDA)
- Tabela de itens controlados: produto, categoria, quantidade atual, mínimo, status.
- Status calculado: suficiente / atenção / baixo / conferir / acabou.
- Tela com abas (Compras / Estoque), ajuste +/−, tempo real, log de eventos.
- Apenas o tipo "unidade contável", conforme planejado.

### 📋 Fatia 1.5 — Os quatro tipos de medição (PRÓXIMA)
Registrado explicitamente para NÃO se perder. O Documento Mestre (seção 18.4)
define quatro tipos; a Fatia 1 fez o primeiro. Os outros três entram aqui:
- **Peso/volume** (ex.: arroz, feijão, frango) — peso aproximado ou embalagem.
- **Nível visual** (ex.: shampoo, creme) — cheio / 75% / metade / 25% / quase acabando / acabou.
- **Presença simples** (ex.: itens de baixa relevância) — tem / não tem.

### ✅ Fatia 2 — Conexão estoque ↔ lista (CONCLUÍDA)
- Item baixo/acabou vira sugestão na lista, marcada como "sugestão do estoque".
- Sugestão some sozinha quando o estoque volta a ficar suficiente.
- Ao comprar item ligado, pergunta a quantidade real e repõe o estoque
  (caso "12 vs 24 rolos" do Documento Mestre, seção 16.1). Nunca compra sozinho.

### 🕒 Fatia 3 — Inventário rotativo (ADIADO — na fila)
- Tarefas curtas por ambiente (banheiro, cozinha...) para recalibrar o estoque.
- Seleção de itens por risco/confiança (Documento Mestre, seção 19).

### 🕒 Fatia 4 — Estimativa por consumo e confiança (ADIADO — mais à frente)
- Estimar saldo por histórico de compra e tempo; nível de confiança.
- O fluxo "arroz pode estar acabando" (Documento Mestre, seção 18.5).

---

## 🕒 Módulos adiados (na fila, ordem a confirmar com Mateus)

Todos fazem parte do produto (estão no Documento Mestre). Ainda não construídos.

- **Tarefas, rotinas e rituais** (seção 21) — divisão de responsabilidades da Casa.
- **Contas e finanças** (seção 20) — ✅ cadastro manual concluído (v0.8.0).
  Próximos passos deste módulo (adiados): leitura por e-mail/Gmail, histórico e
  variação mês a mês, orçamento disponível, contas pessoais + privacidade.
- **Alimentação e refeições** (seção 22) — planos e cardápio que geram compras.
- **Tela Hoje** (seção 10.2) — ✅ concluída (v0.9.0) com compras, estoque e contas.
  Cresce conforme novos módulos nascem: cada um (tarefas, refeições, saúde,
  projetos, agenda) vira um card novo no lugar que o protótipo já prevê.
- **Projetos pessoais** (seção 24).

---

## 💭 Futuro / integrações (previstos, dependem de validação)

Do Documento Mestre, Partes V e VI. Nenhum destes é da fase atual; ficam
registrados para não sumirem do radar.

- **GhuMat** (assistente/IA) — resumos, sugestões, perguntas. Onda 3+.
- **Siri e Atalhos** (seção 27).
- **NFC** (seção 27.1) — tags em objetos/locais.
- **Geolocalização** (seção 26) — chegada ao mercado.
- **Gmail / contas por e-mail** (seção 28) — leitura de vencimentos.
- **Apple Saúde** (seção 29.3) — passos, treino, água.
- **Deploy no Render** — publicar o backend para os iPhones acessarem fora de casa.
- **Notificações** (seção 14).
- **Tablet da Casa** (seção 11) — painel doméstico.
- **Refinamento de privacidade** — o nível "pessoal protegido" (seção 8);
  hoje todo logado vê os dados compartilhados.

---

## Dívidas técnicas registradas

Pequenas coisas a arrumar quando fizer sentido, para não esquecer:

- As rotas de lista no backend (`/lista/...` em server.js) não são mais usadas
  pela tela (que fala direto com o Supabase). Podem ser removidas numa faxina futura.
- Autenticação em fase de testes já virou token na tela; o backend ainda tem
  o padrão antigo de senha por chamada nas rotas `/lista/...` (ligado ao item acima).
