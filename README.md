# LifeOS

Sistema operacional pessoal e domestico de Mateus e Ghustavo.
Assistente: GhuMat.

Este repositorio contem o **backend** do LifeOS.

## Estado atual

Fundacao (Onda 1) - primeira entrega. O backend sobe localmente e confirma
conexao com o banco Supabase. Ainda nao ha compras, estoque, contas ou telas.

## Como rodar localmente

Pre-requisitos: Node.js (LTS) e Git instalados.

1. Instale as dependencias (so na primeira vez, ou quando elas mudarem):

   ```
   npm install
   ```

2. Crie o arquivo de configuracao a partir do modelo e preencha os valores:

   ```
   Copy-Item .env.example .env
   ```

   Abra o `.env` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

3. Inicie o backend:

   ```
   npm start
   ```

4. Teste no navegador: abra `http://localhost:3000/saude`.
   Deve responder com `status: ok` e `banco: conectado`.

## Estrutura

- `src/config.js` - le e valida a configuracao do `.env`.
- `src/supabase.js` - conexao com o banco (isolada aqui).
- `src/server.js` - o servidor e as rotas.

## Seguranca

- O arquivo `.env` guarda as chaves e **nunca** vai para o Git (ver `.gitignore`).
- A chave `service_role` do Supabase nunca deve ser usada aqui nem compartilhada.
