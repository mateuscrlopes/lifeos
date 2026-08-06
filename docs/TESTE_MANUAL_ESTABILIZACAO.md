# Roteiro manual — estabilização

Execute os casos com dois dispositivos autenticados na mesma Casa quando o roteiro indicar atualização externa.

| Fluxo | Ação | Resultado esperado | Sinal de falha |
| --- | --- | --- | --- |
| Excluir conta | Em Casa > Contas, confirme a exclusão de uma conta. | A conta desaparece da lista e os indicadores da tela Hoje são atualizados. | A conta continua visível, o painel Hoje mantém a contagem anterior ou o botão trava. |
| Contas com nomes iguais | Cadastre duas contas com o mesmo nome e exclua a segunda. | Somente a ocorrência clicada é excluída; a outra permanece. | A primeira ocorrência, ou ambas, são removidas. |
| Falha ao excluir conta | Simule indisponibilidade de rede antes de confirmar a exclusão. | A conta permanece na lista, uma mensagem de erro é mostrada e o botão pode ser usado novamente. | A conta some sem confirmação no banco, não há mensagem ou o botão fica desabilitado. |
| Cuidar de planta | Em Plantas, use Cuidar em uma planta vencida ou para hoje. | As rotinas vencidas são registradas, a planta é atualizada e a tela Hoje é recarregada. | O status aparenta sucesso sem evento/data atualizada ou o botão fica travado. |
| Cuidar na ficha | Abra uma planta vencida e use Cuidar em uma rotina. | O botão mostra “Registrando…”, a ficha é reaberta com a próxima data e a tela Hoje é atualizada. | O botão vira apenas um ícone, fica desabilitado ou a data permanece antiga. |
| Falha ao cuidar | Simule indisponibilidade de rede e use Cuidar. | A tela informa falha, não apresenta sucesso e o botão é reabilitado. | O botão continua desabilitado ou a planta é exibida como cuidada sem gravação. |
| Tarefa no início do tablet | No painel inicial do tablet, conclua uma tarefa pública. | A tarefa some do painel, os indicadores e a tela de espera são atualizados. | A tarefa permanece no painel ou a contagem não muda. |
| Tarefa na página completa | Abra Tarefas no tablet e conclua uma tarefa. | A linha é removida/atualizada também na página Tarefas, além do painel inicial. | A página Tarefas permanece com a linha antiga. |
| Limpeza de destaques | Cuide da última planta urgente e aguarde a atualização. | A área de plantas é ocultada e Destaques mostra “Sem destaques no momento”. | O destaque de planta continua sendo mostrado. |
| Alteração em outro aparelho | Em outro aparelho, altere uma tarefa, conta, compra, estoque ou rotina de planta. | O tablet atualiza o painel e, se estiver aberta, a página correspondente. | Dados antigos continuam visíveis após o evento Realtime. |
