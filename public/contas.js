export async function excluirContaPorId(supa, contaId) {
  return supa.from('contas').delete().eq('id', contaId);
}
