# Contas recebidas por e-mail

A Central Financeira possui uma caixa de entrada intermediária para contas detectadas no Gmail. O PDF é enviado para o backend do LifeOS, lido localmente e permanece disponível para conferência antes de a cobrança virar uma conta oficial.

## Fornecedores automáticos

O Google Apps Script em `apps-script/financeiro-gmail/Code.gs` procura atualmente contas da Enel, EI Fiber, QuintoAndar e Naturgy pelos remetentes conhecidos.

## Boleto de condomínio recebido no WhatsApp

Para documentos que chegam fora do e-mail, como o boleto encaminhado pela proprietária no WhatsApp, o fluxo manual deve exigir o mínimo possível de passos.

1. Compartilhar o PDF do WhatsApp para o Gmail/Mail.
2. Enviar o arquivo para a própria conta de e-mail monitorada pelo LifeOS.
3. Usar um assunto que contenha **LifeOS** e **Condomínio**. O padrão recomendado é exatamente:

   `LifeOS: Condomínio`

4. O corpo do e-mail pode ficar vazio.

Na próxima sincronização, o Apps Script identifica a mensagem pelo assunto e pelo anexo, envia o PDF ao LifeOS e aciona a extração automática.

O LifeOS tenta identificar no PDF:

- valor;
- vencimento;
- linha digitável do boleto;
- Pix copia e cola, quando existir.

Na Central Financeira, a cobrança aparece em **Novas contas recebidas** com:

- nome sugerido: `Condomínio`;
- categoria sugerida: `Moradia`;
- PDF disponível para abrir;
- dados extraídos preenchidos quando a leitura for bem-sucedida.

A conta só é efetivada depois da conferência do usuário. Se a leitura automática falhar, o PDF continua disponível e os campos podem ser preenchidos manualmente.

## Segurança e duplicidade

O assunto contém um marcador explícito (`LifeOS`) para que qualquer PDF comum recebido no Gmail não seja importado por engano. A entrada aceita somente PDFs e mantém o limite existente de 12 MB.

A chave mensal da cobrança continua sendo baseada em fornecedor + competência. Assim, reenviar o mesmo condomínio do mesmo mês não deve criar uma segunda cobrança na caixa de entrada.

## Sincronização

O gatilho atual do Apps Script executa `sincronizarContasLifeOS` uma vez por hora. O botão **Atualizar** da Central Financeira atualiza o que já chegou ao Supabase, mas não dispara o Apps Script do Gmail.

Importante: o arquivo `Code.gs` deste repositório é a fonte oficial do código, mas o projeto do Google Apps Script não está ligado ao GitHub por um processo automático de publicação. Depois de mudanças neste arquivo, é necessário sincronizar o código no projeto do Apps Script que possui as propriedades `LIFEOS_URL` e `LIFEOS_IMPORT_TOKEN` e o gatilho instalado.
