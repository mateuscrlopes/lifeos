# Gumate — Assistente virtual da Casa

## Estado desta entrega

**Gumate Lab v0.1**: prova de conceito mãos livres para validar o Moto E 2ª geração com Android 6.0.

O laboratório já define o fluxo completo:

1. o aparelho escuta uma expressão de ativação;
2. captura o comando falado;
3. envia somente o texto ao backend do LifeOS;
4. o backend interpreta por regras e, quando necessário, pela API Gemini;
5. apenas uma ação autorizada é executada;
6. o aparelho fala a resposta;
7. o backend registra o resultado, sem armazenar áudio.

## Escopo v0.1

- Palavra provisória configurável: `Gumate`, `Gumete`, `Jarvis` ou `Assistente`.
- Ação disponível: adicionar um ou vários itens à lista de compras.
- Proteção contra itens pendentes duplicados.
- Token individual por aparelho, armazenado como hash no Supabase.
- Limite de 20 comandos por minuto por dispositivo.
- IA opcional: comandos simples funcionam sem custo, por regras locais.
- Resposta falada com o mecanismo de voz do Android.

## O que ainda não está nesta versão

- Modelo próprio e preciso para a palavra `Gumate`.
- Tarefas, contas, estoque, plantas e cardápio.
- Conversa com memória de várias falas.
- Identificação automática de quem falou.
- Funcionamento garantido com a tela apagada em todos os Androids.

## Segurança

- A chave do Gemini e a chave administrativa do Supabase ficam somente no Render.
- O aplicativo possui apenas um token revogável de aparelho.
- O token puro não é salvo no banco.
- O backend aceita somente ações cadastradas no código.
- O Gumate não acessa banco, não movimenta dinheiro e não paga contas.
- O áudio não é enviado ao LifeOS nem salvo no histórico.

## Custo de IA

A interpretação usa primeiro regras gratuitas. A API só é chamada quando a frase não bate em um padrão seguro. O provedor é configurável por variável de ambiente, começando por `gemini-2.5-flash-lite`.

## Próximas fases

### v0.2 — validar hardware

- instalar no Moto E;
- medir demora, aquecimento e estabilidade;
- avaliar reconhecimento com TV e ventilador ligados;
- escolher a expressão provisória mais confiável.

### v0.3 — palavra própria

- coletar gravações de Mateus e Gustavo;
- treinar um modelo local específico para `Gumate`;
- medir falsos acionamentos e falhas de detecção.

### v0.4 — catálogo doméstico

- tarefas;
- consultas de pendências;
- contas com confirmação;
- estoque;
- cuidado de plantas;
- cardápio.

### v1.0 — assistente integrado

- contexto curto de conversa;
- perguntas de esclarecimento;
- cruzamento de módulos;
- perfis e níveis de privacidade;
- satélites no tablet e no escritório.
