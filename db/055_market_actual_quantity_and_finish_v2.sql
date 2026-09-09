-- LIFEOS - MIGRACAO 055: QUANTIDADE PLANEJADA X QUANTIDADE COMPRADA
-- Mantem a lista como plano e registra separadamente o que foi realmente
-- colocado no carrinho. A finalizacao v2 e atomica e preserva os dois valores.

alter table public.lista_compras
  add column if not exists quantidade_planejada numeric,
  add column if not exists unidade_planejada text,
  add column if not exists quantidade_comprada numeric,
  add column if not exists unidade_comprada text;

alter table public.compras_sessao_itens
  add column if not exists quantidade_planejada numeric,
  add column if not exists unidade_planejada text;

comment on column public.lista_compras.quantidade_planejada is
  'Quantidade originalmente planejada, preservada quando a compra real difere da lista.';
comment on column public.lista_compras.unidade_planejada is
  'Unidade originalmente planejada.';
comment on column public.lista_compras.quantidade_comprada is
  'Quantidade efetivamente colocada no carrinho.';
comment on column public.lista_compras.unidade_comprada is
  'Unidade efetivamente comprada.';
comment on column public.compras_sessao_itens.quantidade_planejada is
  'Quantidade que constava na lista antes da compra.';
comment on column public.compras_sessao_itens.unidade_planejada is
  'Unidade que constava na lista antes da compra.';

create or replace function public.lifeos_preservar_planejado_mercado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'pendente' and new.status = 'pendente' and new.no_carrinho = true then
    if new.quantidade_planejada is null then
      new.quantidade_planejada := old.quantidade;
    end if;
    if new.unidade_planejada is null then
      new.unidade_planejada := old.unidade;
    end if;

    -- Compatibilidade com o leitor antigo da NFC-e, que escrevia a compra real
    -- diretamente em quantidade/unidade. Guardamos a compra real e devolvemos
    -- quantidade/unidade ao papel de planejamento.
    if new.quantidade is distinct from old.quantidade then
      new.quantidade_comprada := new.quantidade;
      new.quantidade := old.quantidade;
    elsif new.quantidade_comprada is null then
      new.quantidade_comprada := coalesce(old.quantidade, 1);
    end if;

    if new.unidade is distinct from old.unidade then
      new.unidade_comprada := new.unidade;
      new.unidade := old.unidade;
    elsif new.unidade_comprada is null then
      new.unidade_comprada := coalesce(old.unidade, 'un');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preservar_planejado_mercado on public.lista_compras;
create trigger trg_preservar_planejado_mercado
before update of quantidade, unidade, no_carrinho, quantidade_comprada, unidade_comprada, status
on public.lista_compras
for each row
execute function public.lifeos_preservar_planejado_mercado();

create or replace function public.finalizar_compra_mercado_v2(
  p_local_compra_id uuid default null,
  p_local_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_casa_id uuid;
  v_sessao_id uuid;
  v_qtd integer;
  v_sem_preco integer;
  v_total numeric;
  v_agora timestamptz := now();
begin
  select u.id, u.casa_id
    into v_usuario_id, v_casa_id
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1;

  if v_usuario_id is null or v_casa_id is null then
    raise exception 'Perfil do LifeOS não encontrado.';
  end if;

  select count(*)::integer,
         count(*) filter (where preco_compra is null)::integer,
         coalesce(sum(preco_compra), 0)
    into v_qtd, v_sem_preco, v_total
  from public.lista_compras
  where casa_id = v_casa_id
    and status = 'pendente'
    and no_carrinho = true;

  if coalesce(v_qtd, 0) = 0 then
    raise exception 'Nenhum item no carrinho para finalizar.';
  end if;

  insert into public.compras_sessoes (
    casa_id, local_compra_id, local_nome, usuario_id,
    iniciada_em, finalizada_em, total_informado, itens_sem_preco, quantidade_itens
  ) values (
    v_casa_id,
    p_local_compra_id,
    coalesce(nullif(trim(p_local_nome), ''), 'Mercado não informado'),
    v_usuario_id,
    v_agora, v_agora, v_total, v_sem_preco, v_qtd
  ) returning id into v_sessao_id;

  insert into public.compras_sessao_itens (
    sessao_id, lista_compra_id, nome,
    quantidade, unidade, quantidade_planejada, unidade_planejada,
    preco, destino_nome, estoque_id
  )
  select
    v_sessao_id,
    l.id,
    l.nome,
    coalesce(l.quantidade_comprada, l.quantidade, 1),
    coalesce(l.unidade_comprada, l.unidade, 'un'),
    coalesce(l.quantidade_planejada, l.quantidade),
    coalesce(l.unidade_planejada, l.unidade),
    l.preco_compra,
    coalesce(d.nome, 'Mercado'),
    l.estoque_id
  from public.lista_compras l
  left join public.compra_destinos d on d.id = l.destino_compra_id
  where l.casa_id = v_casa_id
    and l.status = 'pendente'
    and l.no_carrinho = true;

  update public.lista_compras
  set quantidade_planejada = coalesce(quantidade_planejada, quantidade),
      unidade_planejada = coalesce(unidade_planejada, unidade),
      quantidade_comprada = coalesce(quantidade_comprada, quantidade, 1),
      unidade_comprada = coalesce(unidade_comprada, unidade, 'un'),
      quantidade = coalesce(quantidade_comprada, quantidade, 1),
      unidade = coalesce(unidade_comprada, unidade, 'un'),
      status = 'comprado',
      no_carrinho = false,
      aguardando_conferencia = true,
      compra_sessao_id = v_sessao_id,
      comprado_por = v_usuario_id,
      comprado_em = v_agora
  where casa_id = v_casa_id
    and status = 'pendente'
    and no_carrinho = true;

  return v_sessao_id;
end;
$$;

revoke all on function public.finalizar_compra_mercado_v2(uuid,text) from public;
revoke all on function public.finalizar_compra_mercado_v2(uuid,text) from anon;
grant execute on function public.finalizar_compra_mercado_v2(uuid,text) to authenticated;
