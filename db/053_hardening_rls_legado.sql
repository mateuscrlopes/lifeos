-- LIFEOS - MIGRACAO 053: HARDENING RLS DAS TABELAS LEGADAS
-- Substitui políticas permissivas legadas por isolamento real por Casa.
-- Depende das funções lifeos_usuario_atual_id/lifeos_usuario_na_casa criadas na 032.

alter table public.casa enable row level security;
drop policy if exists casa_ler on public.casa;
create policy casa_ler on public.casa for select to authenticated using (public.lifeos_usuario_na_casa(id));

alter table public.usuarios enable row level security;
drop policy if exists usuarios_ler on public.usuarios;
create policy usuarios_ler on public.usuarios for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));

alter table public.eventos enable row level security;
drop policy if exists eventos_ler on public.eventos;
create policy eventos_ler on public.eventos for select to authenticated using (
  exists (select 1 from public.usuarios u where u.id = eventos.usuario_id and public.lifeos_usuario_na_casa(u.casa_id))
);
drop policy if exists eventos_inserir on public.eventos;
create policy eventos_inserir on public.eventos for insert to authenticated with check (usuario_id = public.lifeos_usuario_atual_id());

do $$
declare r record;
begin
  for r in select * from (values
    ('lista_compras','lista_ler','lista_inserir','lista_atualizar','lista_remover'),
    ('estoque','estoque_ler','estoque_inserir','estoque_atualizar','estoque_remover'),
    ('contas','contas_ler','contas_inserir','contas_atualizar','contas_remover'),
    ('tarefas','tarefas_ler','tarefas_inserir','tarefas_atualizar','tarefas_remover'),
    ('refeicoes','ref_ler','ref_ins','ref_upd','ref_del'),
    ('rituais','rit_ler','rit_ins','rit_upd','rit_del'),
    ('especies','esp_ler','esp_ins','esp_upd','esp_del'),
    ('plantas','pla_ler','pla_ins','pla_upd','pla_del'),
    ('locais_estoque','le_ler','le_ins','le_upd','le_del'),
    ('contas_email_caixa','contas_email_caixa_ler','contas_email_caixa_inserir','contas_email_caixa_atualizar','contas_email_caixa_remover')
  ) as x(tabela,p_select,p_insert,p_update,p_delete)
  loop
    execute format('alter table public.%I enable row level security', r.tabela);
    execute format('drop policy if exists %I on public.%I', r.p_select, r.tabela);
    execute format('create policy %I on public.%I for select to authenticated using (public.lifeos_usuario_na_casa(casa_id))', r.p_select, r.tabela);
    execute format('drop policy if exists %I on public.%I', r.p_insert, r.tabela);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id))', r.p_insert, r.tabela);
    execute format('drop policy if exists %I on public.%I', r.p_update, r.tabela);
    execute format('create policy %I on public.%I for update to authenticated using (public.lifeos_usuario_na_casa(casa_id)) with check (public.lifeos_usuario_na_casa(casa_id))', r.p_update, r.tabela);
    execute format('drop policy if exists %I on public.%I', r.p_delete, r.tabela);
    execute format('create policy %I on public.%I for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id))', r.p_delete, r.tabela);
  end loop;
end $$;

alter table public.inventarios enable row level security;
drop policy if exists inventarios_ler on public.inventarios;
create policy inventarios_ler on public.inventarios for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists inventarios_inserir on public.inventarios;
create policy inventarios_inserir on public.inventarios for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists inventarios_atualizar on public.inventarios;
create policy inventarios_atualizar on public.inventarios for update to authenticated using (public.lifeos_usuario_na_casa(casa_id)) with check (public.lifeos_usuario_na_casa(casa_id));

alter table public.planejamento_semana enable row level security;
drop policy if exists ps_ler on public.planejamento_semana;
create policy ps_ler on public.planejamento_semana for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists ps_ins on public.planejamento_semana;
create policy ps_ins on public.planejamento_semana for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists ps_upd on public.planejamento_semana;
create policy ps_upd on public.planejamento_semana for update to authenticated using (public.lifeos_usuario_na_casa(casa_id)) with check (public.lifeos_usuario_na_casa(casa_id));

alter table public.locais_compra enable row level security;
drop policy if exists lc_ler on public.locais_compra;
create policy lc_ler on public.locais_compra for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists lc_ins on public.locais_compra;
create policy lc_ins on public.locais_compra for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists lc_upd on public.locais_compra;
create policy lc_upd on public.locais_compra for update to authenticated using (public.lifeos_usuario_na_casa(casa_id)) with check (public.lifeos_usuario_na_casa(casa_id));

alter table public.historico_excluidos enable row level security;
drop policy if exists he_ler on public.historico_excluidos;
create policy he_ler on public.historico_excluidos for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists he_ins on public.historico_excluidos;
create policy he_ins on public.historico_excluidos for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id) and usuario_id = public.lifeos_usuario_atual_id());
drop policy if exists he_upd on public.historico_excluidos;
create policy he_upd on public.historico_excluidos for update to authenticated using (public.lifeos_usuario_na_casa(casa_id)) with check (public.lifeos_usuario_na_casa(casa_id));

alter table public.refeicao_ingredientes enable row level security;
drop policy if exists ri_ler on public.refeicao_ingredientes;
create policy ri_ler on public.refeicao_ingredientes for select to authenticated using (exists (select 1 from public.refeicoes p where p.id=refeicao_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists ri_ins on public.refeicao_ingredientes;
create policy ri_ins on public.refeicao_ingredientes for insert to authenticated with check (exists (select 1 from public.refeicoes p where p.id=refeicao_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists ri_del on public.refeicao_ingredientes;
create policy ri_del on public.refeicao_ingredientes for delete to authenticated using (exists (select 1 from public.refeicoes p where p.id=refeicao_id and public.lifeos_usuario_na_casa(p.casa_id)));

alter table public.planejamento_dias enable row level security;
drop policy if exists pd_ler on public.planejamento_dias;
create policy pd_ler on public.planejamento_dias for select to authenticated using (exists (select 1 from public.planejamento_semana p where p.id=planejamento_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists pd_ins on public.planejamento_dias;
create policy pd_ins on public.planejamento_dias for insert to authenticated with check (exists (select 1 from public.planejamento_semana p where p.id=planejamento_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists pd_upd on public.planejamento_dias;
create policy pd_upd on public.planejamento_dias for update to authenticated using (exists (select 1 from public.planejamento_semana p where p.id=planejamento_id and public.lifeos_usuario_na_casa(p.casa_id))) with check (exists (select 1 from public.planejamento_semana p where p.id=planejamento_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists pd_del on public.planejamento_dias;
create policy pd_del on public.planejamento_dias for delete to authenticated using (exists (select 1 from public.planejamento_semana p where p.id=planejamento_id and public.lifeos_usuario_na_casa(p.casa_id)));

alter table public.ritual_sessoes enable row level security;
drop policy if exists rs_ler on public.ritual_sessoes;
create policy rs_ler on public.ritual_sessoes for select to authenticated using (exists (select 1 from public.rituais p where p.id=ritual_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists rs_ins on public.ritual_sessoes;
create policy rs_ins on public.ritual_sessoes for insert to authenticated with check (exists (select 1 from public.rituais p where p.id=ritual_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists rs_upd on public.ritual_sessoes;
create policy rs_upd on public.ritual_sessoes for update to authenticated using (exists (select 1 from public.rituais p where p.id=ritual_id and public.lifeos_usuario_na_casa(p.casa_id))) with check (exists (select 1 from public.rituais p where p.id=ritual_id and public.lifeos_usuario_na_casa(p.casa_id)));

alter table public.planta_rotinas enable row level security;
drop policy if exists rot_ler on public.planta_rotinas;
create policy rot_ler on public.planta_rotinas for select to authenticated using (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists rot_ins on public.planta_rotinas;
create policy rot_ins on public.planta_rotinas for insert to authenticated with check (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists rot_upd on public.planta_rotinas;
create policy rot_upd on public.planta_rotinas for update to authenticated using (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id))) with check (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists rot_del on public.planta_rotinas;
create policy rot_del on public.planta_rotinas for delete to authenticated using (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));

alter table public.planta_eventos enable row level security;
drop policy if exists ev_ler on public.planta_eventos;
create policy ev_ler on public.planta_eventos for select to authenticated using (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists ev_ins on public.planta_eventos;
create policy ev_ins on public.planta_eventos for insert to authenticated with check (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));

alter table public.planta_fotos enable row level security;
drop policy if exists fot_ler on public.planta_fotos;
create policy fot_ler on public.planta_fotos for select to authenticated using (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists fot_ins on public.planta_fotos;
create policy fot_ins on public.planta_fotos for insert to authenticated with check (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists fot_del on public.planta_fotos;
create policy fot_del on public.planta_fotos for delete to authenticated using (exists (select 1 from public.plantas p where p.id=planta_id and public.lifeos_usuario_na_casa(p.casa_id)));

alter table public.locais_compra_enderecos enable row level security;
drop policy if exists lce_ler on public.locais_compra_enderecos;
create policy lce_ler on public.locais_compra_enderecos for select to authenticated using (exists (select 1 from public.locais_compra p where p.id=local_compra_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists lce_ins on public.locais_compra_enderecos;
create policy lce_ins on public.locais_compra_enderecos for insert to authenticated with check (exists (select 1 from public.locais_compra p where p.id=local_compra_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists lce_del on public.locais_compra_enderecos;
create policy lce_del on public.locais_compra_enderecos for delete to authenticated using (exists (select 1 from public.locais_compra p where p.id=local_compra_id and public.lifeos_usuario_na_casa(p.casa_id)));

alter table public.locais_compra_categorias enable row level security;
drop policy if exists lcc_ler on public.locais_compra_categorias;
create policy lcc_ler on public.locais_compra_categorias for select to authenticated using (exists (select 1 from public.locais_compra p where p.id=local_compra_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists lcc_ins on public.locais_compra_categorias;
create policy lcc_ins on public.locais_compra_categorias for insert to authenticated with check (exists (select 1 from public.locais_compra p where p.id=local_compra_id and public.lifeos_usuario_na_casa(p.casa_id)));
drop policy if exists lcc_del on public.locais_compra_categorias;
create policy lcc_del on public.locais_compra_categorias for delete to authenticated using (exists (select 1 from public.locais_compra p where p.id=local_compra_id and public.lifeos_usuario_na_casa(p.casa_id)));