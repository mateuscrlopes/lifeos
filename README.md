# LifeOS

Sistema operacional pessoal e doméstico de Mateus e Ghustavo.

## Estado atual

**Onda 1 concluída — v0.16.0**

Módulos funcionando:
- Lista de compras compartilhada (tempo real)
- Estoque (3 tipos de medição + inventário rotativo + ponte com a lista)
- Contas (status por vencimento + recorrência)
- Tarefas e rotinas (responsável + recorrência)
- Rituais (pauta + sessões + histórico + gera tarefas)
- Alimentação (cardápio semanal + geração de lista)
- Tela Hoje (painel que reúne tudo)

Publicado em: https://lifeos-6rib.onrender.com

## Estrutura

```
src/
  server.js       — backend Node (serve a tela e a rota /config)
  config.js       — lê e valida as variáveis de ambiente
  supabase.js     — conexão com o banco

public/
  app.js          — lógica da tela (frontend)
  index.html      — a tela
  hoje.js         — monta os dados da Tela Hoje
  status-estoque.js  — calcula status dos itens de estoque
  status-conta.js    — calcula status das contas
  ponte-estoque.js   — sincroniza estoque ↔ lista
  inventario.js      — lógica do inventário rotativo

db/
  001_nucleo.sql         — tabelas base (casa, usuarios, eventos)
  002_perfis.sql         — perfis de Mateus e Ghustavo
  003_lista_compras.sql  — lista de compras
  004_estoque.sql        — estoque
  005_ponte_estoque_lista.sql — ponte estoque ↔ lista
  006_contas.sql         — contas
  007_tarefas.sql        — tarefas
  008_estoque_tipos.sql  — tipos de medição do estoque
  009_inventario.sql     — inventário rotativo
  010_alimentacao.sql    — refeições e cardápio
  011_rituais.sql        — rituais e sessões
```

## Como rodar localmente

1. Instale as dependências: `npm install`
2. Crie o `.env` a partir do `.env.example` e preencha as chaves do Supabase
3. Inicie: `npm start`
4. Abra: http://localhost:3000

## Deploy

O Render republica automaticamente a cada `git push` na branch `main`.
As variáveis de ambiente (SUPABASE_URL e SUPABASE_ANON_KEY) ficam
configuradas no painel do Render — nunca no código.

## Segurança

- `.env` nunca vai para o Git (ver `.gitignore`)
- A chave `service_role` do Supabase nunca deve ser usada no frontend
- RLS ativado em todas as tabelas
