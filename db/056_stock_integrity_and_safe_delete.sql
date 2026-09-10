-- LifeOS: integridade do estoque e exclusão segura
-- Mantém vínculos históricos, normaliza tipos e fornece exclusão atômica.

update public.estoque
set quantidade = case when coalesce(quantidade, 0) > 0 then 1 else 0 end,
    unidade = null,
    minimo = 1
where tipo = 'presenca'
  and (quantidade not in (0,1) or unidade is not null or minimo <> 1);

create or replace function public.lifeos_normalizar_estoque()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo = 'presenca' then
    new.quantidade := case when coalesce(new.quantidade, 0) > 0 then 1 else 0 end;
    new.unidade := null;
    new.minimo := 1;
  elsif new.tipo = 'nivel_visual' then
    new.quantidade := 0;
    new.minimo := 0;
  end if;

  if new.quantidade < 0 then
    raise exception 'Quantidade do estoque não pode ser negativa.' using errcode = '22023';
  end if;
  if new.minimo < 0 then
    raise exception 'Mínimo do estoque não pode ser negativo.' using errcode = '22023';
  end if;
  if new.taxa_consumo is not null and new.taxa_consumo < 0 then
    raise exception 'Taxa de consumo não pode ser negativa.' using errcode = '22023';
  end if;
  if new.alerta_dias is not null and new.alerta_dias < 0 then
    raise exception 'Dias de alerta não podem ser negativos.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lifeos_normalizar_estoque on public.estoque;
create trigger trg_lifeos_normalizar_estoque
before insert or update on public.estoque
for each row execute function public.lifeos_normalizar_estoque();

alter table public.estoque drop constraint if exists estoque_tipo_valido;
alter table public.estoque add constraint estoque_tipo_valido
  check (tipo in ('contavel','peso_volume','nivel_visual','presenca'));

alter table public.estoque drop constraint if exists estoque_quantidade_nao_negativa;
alter table public.estoque add constraint estoque_quantidade_nao_negativa check (quantidade >= 0);

alter table public.estoque drop constraint if exists estoque_minimo_nao_negativo;
alter table public.estoque add constraint estoque_minimo_nao_negativo check (minimo >= 0);

alter table public.estoque drop constraint if exists estoque_presenca_binaria;
alter table public.estoque add constraint estoque_presenca_binaria
  check (tipo <> 'presenca' or quantidade in (0,1));

alter table public.estoque drop constraint if exists estoque_taxa_consumo_nao_negativa;
alter table public.estoque add constraint estoque_taxa_consumo_nao_negativa
  check (taxa_consumo is null or taxa_consumo >= 0);

alter table public.estoque drop constraint if exists estoque_alerta_dias_nao_negativo;
alter table public.estoque add constraint estoque_alerta_dias_nao_negativo
  check (alerta_dias is null or alerta_dias >= 0);

alter table public.lista_compras drop constraint if exists lista_compras_estoque_id_fkey;
alter table public.lista_compras
  add constraint lista_compras_estoque_id_fkey
  foreign key (estoque_id) references public.estoque(id) on delete set null;

alter table public.projeto_itens drop constraint if exists projeto_itens_estoque_id_fkey;
alter table public.projeto_itens
  add constraint projeto_itens_estoque_id_fkey
  foreign key (estoque_id) references public.estoque(id) on delete set null;

create or replace function public.excluir_item_estoque(p_estoque_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_casa_id uuid;
  v_registro public.estoque%rowtype;
  v_lista integer := 0;
  v_projetos integer := 0;
begin
  select u.id, u.casa_id
    into v_usuario_id, v_casa_id
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1;

  if v_usuario_id is null or v_casa_id is null then
    raise exception 'Perfil do LifeOS não encontrado.';
  end if;

  select e.* into v_registro
  from public.estoque e
  where e.id = p_estoque_id and e.casa_id = v_casa_id
  for update;

  if not found then
    raise exception 'Item de estoque não encontrado.' using errcode = 'P0002';
  end if;

  update public.lista_compras
     set estoque_id = null
   where estoque_id = p_estoque_id;
  get diagnostics v_lista = row_count;

  update public.projeto_itens
     set estoque_id = null
   where estoque_id = p_estoque_id;
  get diagnostics v_projetos = row_count;

  insert into public.historico_excluidos (
    casa_id, usuario_id, modulo, registro_id, dados
  ) values (
    v_casa_id, v_usuario_id, 'estoque', p_estoque_id, to_jsonb(v_registro)
  );

  delete from public.estoque where id = p_estoque_id;

  return jsonb_build_object(
    'ok', true,
    'id', p_estoque_id,
    'nome', v_registro.nome,
    'vinculos_lista_desfeitos', v_lista,
    'vinculos_projetos_desfeitos', v_projetos
  );
end;
$$;

revoke all on function public.excluir_item_estoque(uuid) from public;
revoke all on function public.excluir_item_estoque(uuid) from anon;
grant execute on function public.excluir_item_estoque(uuid) to authenticated;
