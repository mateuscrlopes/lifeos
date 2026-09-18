-- LIFEOS - MIGRACAO 061: HARDENING DO FINANCEIRO PESSOAL
-- A RPC de movimentacao nao precisa elevar privilegios: as politicas RLS
-- e os grants do usuario autenticado ja permitem a operacao no proprio dado.

alter function public.lifeos_movimentar_fundo_pessoal(uuid,text,numeric,text)
  security invoker;

revoke all on function public.lifeos_movimentar_fundo_pessoal(uuid,text,numeric,text) from public;
revoke all on function public.lifeos_movimentar_fundo_pessoal(uuid,text,numeric,text) from anon;
grant execute on function public.lifeos_movimentar_fundo_pessoal(uuid,text,numeric,text) to authenticated;
