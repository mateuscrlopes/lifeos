-- LIFEOS - MIGRACAO 046: CHECK-IN DE LANCHE NO RITMO
-- O cardapio passou a trabalhar com quatro momentos principais do dia.

alter table public.ritmo_checkins
  drop constraint if exists ritmo_checkins_tipo_check;

alter table public.ritmo_checkins
  add constraint ritmo_checkins_tipo_check
  check (tipo in ('cafe','almoco','lanche','jantar','atividade','agua'));
