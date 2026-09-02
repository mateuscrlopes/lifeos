-- LIFEOS - MIGRACAO 053: HARDENING RLS DAS TABELAS LEGADAS
-- Substitui políticas abertas "using (true)" por isolamento real por Casa.
-- Depende das funções lifeos_usuario_atual_id/lifeos_usuario_na_casa criadas na 032.

-- Núcleo ---------------------------------------------------------------------

drop policy if exists casa_ler on public.casa;
create policy casa_ler
  on public.casa for select to authenticated
  using (public.lifeos_usuario_na_casa(id));

drop policy if exists usuarios_ler on public.usuarios;
create policy usuarios_ler
  on public.usuarios for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists eventos_ler on public.eventos;
create policy eventos_ler
  on public.eventos for select to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = eventos.usuario_id
        and public.lifeos_usuario_na_casa(u.casa_id)
    )
  );

drop policy if exists eventos_inserir on public.eventos;
create policy eventos_inserir
  on public.eventos for insert to authenticated
  with check (usuario_id = public.lifeos_usuario_atual_id());

-- Tabelas com casa_id direto -------------------------------------------------

drop policy if exists lista_ler on public.lista_compras;
create policy lista_ler on public.lista_compras
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists lista_inserir on public.lista_compras;
create policy lista_inserir on public.lista_compras
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists lista_atualizar on public.lista_compras;
create policy lista_atualizar on public.lista_compras
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists lista_remover on public.lista_compras;
create policy lista_remover on public.lista_compras
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists estoque_ler on public.estoque;
create policy estoque_ler on public.estoque
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists estoque_inserir on public.estoque;
create policy estoque_inserir on public.estoque
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists estoque_atualizar on public.estoque;
create policy estoque_atualizar on public.estoque
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists estoque_remover on public.estoque;
create policy estoque_remover on public.estoque
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists contas_ler on public.contas;
create policy contas_ler on public.contas
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists contas_inserir on public.contas;
create policy contas_inserir on public.contas
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists contas_atualizar on public.contas;
create policy contas_atualizar on public.contas
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists contas_remover on public.contas;
create policy contas_remover on public.contas
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists tarefas_ler on public.tarefas;
create policy tarefas_ler on public.tarefas
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists tarefas_inserir on public.tarefas;
create policy tarefas_inserir on public.tarefas
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists tarefas_atualizar on public.tarefas;
create policy tarefas_atualizar on public.tarefas
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists tarefas_remover on public.tarefas;
create policy tarefas_remover on public.tarefas
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists inventarios_ler on public.inventarios;
create policy inventarios_ler on public.inventarios
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists inventarios_inserir on public.inventarios;
create policy inventarios_inserir on public.inventarios
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists inventarios_atualizar on public.inventarios;
create policy inventarios_atualizar on public.inventarios
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists ref_ler on public.refeicoes;
create policy ref_ler on public.refeicoes
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists ref_ins on public.refeicoes;
create policy ref_ins on public.refeicoes
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists ref_upd on public.refeicoes;
create policy ref_upd on public.refeicoes
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists ref_del on public.refeicoes;
create policy ref_del on public.refeicoes
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists ps_ler on public.planejamento_semana;
create policy ps_ler on public.planejamento_semana
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists ps_ins on public.planejamento_semana;
create policy ps_ins on public.planejamento_semana
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists ps_upd on public.planejamento_semana;
create policy ps_upd on public.planejamento_semana
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists rit_ler on public.rituais;
create policy rit_ler on public.rituais
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists rit_ins on public.rituais;
create policy rit_ins on public.rituais
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists rit_upd on public.rituais;
create policy rit_upd on public.rituais
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists rit_del on public.rituais;
create policy rit_del on public.rituais
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists esp_ler on public.especies;
create policy esp_ler on public.especies
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists esp_ins on public.especies;
create policy esp_ins on public.especies
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists esp_upd on public.especies;
create policy esp_upd on public.especies
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists esp_del on public.especies;
create policy esp_del on public.especies
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists pla_ler on public.plantas;
create policy pla_ler on public.plantas
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists pla_ins on public.plantas;
create policy pla_ins on public.plantas
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists pla_upd on public.plantas;
create policy pla_upd on public.plantas
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists pla_del on public.plantas;
create policy pla_del on public.plantas
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists lc_ler on public.locais_compra;
create policy lc_ler on public.locais_compra
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists lc_ins on public.locais_compra;
create policy lc_ins on public.locais_compra
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists lc_upd on public.locais_compra;
create policy lc_upd on public.locais_compra
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists le_ler on public.locais_estoque;
create policy le_ler on public.locais_estoque
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists le_ins on public.locais_estoque;
create policy le_ins on public.locais_estoque
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists le_upd on public.locais_estoque;
create policy le_upd on public.locais_estoque
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists le_del on public.locais_estoque;
create policy le_del on public.locais_estoque
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists he_ler on public.historico_excluidos;
create policy he_ler on public.historico_excluidos
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists he_ins on public.historico_excluidos;
create policy he_ins on public.historico_excluidos
  for insert to authenticated
  with check (
    public.lifeos_usuario_na_casa(casa_id)
    and usuario_id = public.lifeos_usuario_atual_id()
  );
drop policy if exists he_upd on public.historico_excluidos;
create policy he_upd on public.historico_excluidos
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists contas_email_caixa_ler on public.contas_email_caixa;
create policy contas_email_caixa_ler on public.contas_email_caixa
  for select to authenticated using (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists contas_email_caixa_inserir on public.contas_email_caixa;
create policy contas_email_caixa_inserir on public.contas_email_caixa
  for insert to authenticated with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists contas_email_caixa_atualizar on public.contas_email_caixa;
create policy contas_email_caixa_atualizar on public.contas_email_caixa
  for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));
drop policy if exists contas_email_caixa_remover on public.contas_email_caixa;
create policy contas_email_caixa_remover on public.contas_email_caixa
  for delete to authenticated using (public.lifeos_usuario_na_casa(casa_id));

-- Filhas sem casa_id: a Casa é derivada do registro pai ----------------------

drop policy if exists ri_ler on public.refeicao_ingredientes;
create policy ri_ler on public.refeicao_ingredientes
  for select to authenticated
  using (
    exists (
      select 1 from public.refeicoes r
      where r.id = refeicao_id
        and public.lifeos_usuario_na_casa(r.casa_id)
    )
  );
drop policy if exists ri_ins on public.refeicao_ingredientes;
create policy ri_ins on public.refeicao_ingredientes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.refeicoes r
      where r.id = refeicao_id
        and public.lifeos_usuario_na_casa(r.casa_id)
    )
  );
drop policy if exists ri_del on public.refeicao_ingredientes;
create policy ri_del on public.refeicao_ingredientes
  for delete to authenticated
  using (
    exists (
      select 1 from public.refeicoes r
      where r.id = refeicao_id
        and public.lifeos_usuario_na_casa(r.casa_id)
    )
  );

drop policy if exists pd_ler on public.planejamento_dias;
create policy pd_ler on public.planejamento_dias
  for select to authenticated
  using (
    exists (
      select 1 from public.planejamento_semana p
      where p.id = planejamento_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists pd_ins on public.planejamento_dias;
create policy pd_ins on public.planejamento_dias
  for insert to authenticated
  with check (
    exists (
      select 1 from public.planejamento_semana p
      where p.id = planejamento_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists pd_upd on public.planejamento_dias;
create policy pd_upd on public.planejamento_dias
  for update to authenticated
  using (
    exists (
      select 1 from public.planejamento_semana p
      where p.id = planejamento_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  )
  with check (
    exists (
      select 1 from public.planejamento_semana p
      where p.id = planejamento_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists pd_del on public.planejamento_dias;
create policy pd_del on public.planejamento_dias
  for delete to authenticated
  using (
    exists (
      select 1 from public.planejamento_semana p
      where p.id = planejamento_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );

drop policy if exists rs_ler on public.ritual_sessoes;
create policy rs_ler on public.ritual_sessoes
  for select to authenticated
  using (
    exists (
      select 1 from public.rituais r
      where r.id = ritual_id
        and public.lifeos_usuario_na_casa(r.casa_id)
    )
  );
drop policy if exists rs_ins on public.ritual_sessoes;
create policy rs_ins on public.ritual_sessoes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.rituais r
      where r.id = ritual_id
        and public.lifeos_usuario_na_casa(r.casa_id)
    )
  );
drop policy if exists rs_upd on public.ritual_sessoes;
create policy rs_upd on public.ritual_sessoes
  for update to authenticated
  using (
    exists (
      select 1 from public.rituais r
      where r.id = ritual_id
        and public.lifeos_usuario_na_casa(r.casa_id)
    )
  )
  with check (
    exists (
      select 1 from public.rituais r
      where r.id = ritual_id
        and public.lifeos_usuario_na_casa(r.casa_id)
    )
  );

drop policy if exists rot_ler on public.planta_rotinas;
create policy rot_ler on public.planta_rotinas
  for select to authenticated
  using (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists rot_ins on public.planta_rotinas;
create policy rot_ins on public.planta_rotinas
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists rot_upd on public.planta_rotinas;
create policy rot_upd on public.planta_rotinas
  for update to authenticated
  using (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  )
  with check (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists rot_del on public.planta_rotinas;
create policy rot_del on public.planta_rotinas
  for delete to authenticated
  using (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );

drop policy if exists ev_ler on public.planta_eventos;
create policy ev_ler on public.planta_eventos
  for select to authenticated
  using (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists ev_ins on public.planta_eventos;
create policy ev_ins on public.planta_eventos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );

drop policy if exists fot_ler on public.planta_fotos;
create policy fot_ler on public.planta_fotos
  for select to authenticated
  using (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists fot_ins on public.planta_fotos;
create policy fot_ins on public.planta_fotos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );
drop policy if exists fot_del on public.planta_fotos;
create policy fot_del on public.planta_fotos
  for delete to authenticated
  using (
    exists (
      select 1 from public.plantas p
      where p.id = planta_id
        and public.lifeos_usuario_na_casa(p.casa_id)
    )
  );

drop policy if exists lce_ler on public.locais_compra_enderecos;
create policy lce_ler on public.locais_compra_enderecos
  for select to authenticated
  using (
    exists (
      select 1 from public.locais_compra l
      where l.id = local_compra_id
        and public.lifeos_usuario_na_casa(l.casa_id)
    )
  );
drop policy if exists lce_ins on public.locais_compra_enderecos;
create policy lce_ins on public.locais_compra_enderecos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.locais_compra l
      where l.id = local_compra_id
        and public.lifeos_usuario_na_casa(l.casa_id)
    )
  );
drop policy if exists lce_del on public.locais_compra_enderecos;
create policy lce_del on public.locais_compra_enderecos
  for delete to authenticated
  using (
    exists (
      select 1 from public.locais_compra l
      where l.id = local_compra_id
        and public.lifeos_usuario_na_casa(l.casa_id)
    )
  );

drop policy if exists lcc_ler on public.locais_compra_categorias;
create policy lcc_ler on public.locais_compra_categorias
  for select to authenticated
  using (
    exists (
      select 1 from public.locais_compra l
      where l.id = local_compra_id
        and public.lifeos_usuario_na_casa(l.casa_id)
    )
  );
drop policy if exists lcc_ins on public.locais_compra_categorias;
create policy lcc_ins on public.locais_compra_categorias
  for insert to authenticated
  with check (
    exists (
      select 1 from public.locais_compra l
      where l.id = local_compra_id
        and public.lifeos_usuario_na_casa(l.casa_id)
    )
  );
drop policy if exists lcc_del on public.locais_compra_categorias;
create policy lcc_del on public.locais_compra_categorias
  for delete to authenticated
  using (
    exists (
      select 1 from public.locais_compra l
      where l.id = local_compra_id
        and public.lifeos_usuario_na_casa(l.casa_id)
    )
  );
