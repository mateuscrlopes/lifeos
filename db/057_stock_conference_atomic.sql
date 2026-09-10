-- LifeOS: conferência de compra -> estoque em uma única transação.

create or replace function public.confirmar_reposicao_estoque(
  p_lista_id uuid,
  p_quantidade numeric default null,
  p_nivel text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_casa_id uuid;
  v_lista public.lista_compras%rowtype;
  v_estoque public.estoque%rowtype;
  v_anterior jsonb;
  v_novo jsonb;
begin
  select u.id, u.casa_id into v_usuario_id, v_casa_id
  from public.usuarios u where u.auth_id = auth.uid() limit 1;
  if v_usuario_id is null then raise exception 'Perfil do LifeOS não encontrado.'; end if;

  select l.* into v_lista
  from public.lista_compras l
  where l.id = p_lista_id and l.casa_id = v_casa_id
  for update;
  if not found then raise exception 'Compra não encontrada.' using errcode='P0002'; end if;
  if not coalesce(v_lista.aguardando_conferencia, false) then
    raise exception 'Esta compra já foi conferida.' using errcode='22023';
  end if;
  if v_lista.estoque_id is null then
    raise exception 'Esta compra não está mais vinculada ao estoque.' using errcode='22023';
  end if;

  select e.* into v_estoque
  from public.estoque e
  where e.id = v_lista.estoque_id and e.casa_id = v_casa_id
  for update;
  if not found then raise exception 'Item de estoque não encontrado.' using errcode='P0002'; end if;

  if v_estoque.tipo = 'nivel_visual' then
    if p_nivel is null or p_nivel not in ('cheio','75','metade','25','quase_acabando','acabou') then
      raise exception 'Informe um nível válido.' using errcode='22023';
    end if;
    v_anterior := jsonb_build_object('nivel', v_estoque.nivel);
    update public.estoque
       set nivel = p_nivel, atualizado_por = v_usuario_id, atualizado_em = now()
     where id = v_estoque.id
     returning jsonb_build_object('nivel', nivel, 'quantidade', quantidade) into v_novo;
  elsif v_estoque.tipo = 'presenca' then
    if p_quantidade is null or p_quantidade < 0 then
      raise exception 'Informe uma quantidade válida.' using errcode='22023';
    end if;
    v_anterior := jsonb_build_object('quantidade', v_estoque.quantidade);
    update public.estoque
       set quantidade = case when p_quantidade > 0 then 1 else 0 end,
           atualizado_por = v_usuario_id, atualizado_em = now()
     where id = v_estoque.id
     returning jsonb_build_object('nivel', nivel, 'quantidade', quantidade) into v_novo;
  else
    if p_quantidade is null or p_quantidade < 0 then
      raise exception 'Informe uma quantidade válida.' using errcode='22023';
    end if;
    v_anterior := jsonb_build_object('quantidade', v_estoque.quantidade);
    update public.estoque
       set quantidade = quantidade + p_quantidade,
           atualizado_por = v_usuario_id, atualizado_em = now()
     where id = v_estoque.id
     returning jsonb_build_object('nivel', nivel, 'quantidade', quantidade) into v_novo;
  end if;

  update public.lista_compras
     set aguardando_conferencia = false
   where id = v_lista.id;

  insert into public.eventos(tipo, entidade, entidade_id, usuario_id, valor_anterior, valor_novo, detalhe)
  values ('estoque_reposto', 'estoque', v_estoque.id, v_usuario_id, v_anterior, v_novo,
          'Conferência de compra atualizou o estoque de ' || v_estoque.nome);

  return jsonb_build_object('ok', true, 'estoque_id', v_estoque.id, 'lista_id', v_lista.id, 'estoque', v_novo);
end;
$$;

revoke all on function public.confirmar_reposicao_estoque(uuid,numeric,text) from public;
revoke all on function public.confirmar_reposicao_estoque(uuid,numeric,text) from anon;
grant execute on function public.confirmar_reposicao_estoque(uuid,numeric,text) to authenticated;
