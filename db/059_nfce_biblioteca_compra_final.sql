-- LifeOS — biblioteca fiscal e registro definitivo de compras por NFC-e.
-- A nota fiscal representa uma compra já concluída: não deve deixar os itens
-- como pendentes no carrinho. A conferência do estoque continua separada.

create extension if not exists pgcrypto;

alter table public.compras_sessoes
  add column if not exists origem text not null default 'manual',
  add column if not exists origem_externa_id text,
  add column if not exists emitente text,
  add column if not exists emitente_cnpj text,
  add column if not exists documento_emissao text,
  add column if not exists total_bruto numeric(12,2),
  add column if not exists desconto numeric(12,2);

create unique index if not exists compras_sessoes_nfce_chave_uq
  on public.compras_sessoes (casa_id, origem, origem_externa_id)
  where origem = 'nfce' and origem_externa_id is not null;

alter table public.compras_sessao_itens
  add column if not exists codigo_fiscal text,
  add column if not exists descricao_fiscal text,
  add column if not exists preco_unitario numeric(12,4),
  add column if not exists quantidade_estoque numeric,
  add column if not exists unidade_estoque text,
  add column if not exists acao_estoque text;

alter table public.compras_sessao_itens
  drop constraint if exists compras_sessao_itens_acao_estoque_check;
alter table public.compras_sessao_itens
  add constraint compras_sessao_itens_acao_estoque_check
  check (acao_estoque is null or acao_estoque in ('conferir','ignorar'));

create table if not exists public.nfce_produto_mapeamentos (
  id                 uuid primary key default gen_random_uuid(),
  casa_id            uuid not null references public.casa(id) on delete cascade,
  emitente_cnpj      text,
  codigo_fiscal      text,
  descricao_fiscal   text not null,
  nome_canonico      text not null,
  estoque_id         uuid references public.estoque(id) on delete set null,
  categoria          text,
  acao_estoque       text not null default 'conferir'
                     check (acao_estoque in ('conferir','ignorar')),
  fator_quantidade   numeric not null default 1 check (fator_quantidade > 0),
  unidade_estoque    text,
  confirmado         boolean not null default true,
  criado_por         uuid references public.usuarios(id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create unique index if not exists nfce_mapeamento_codigo_uq
  on public.nfce_produto_mapeamentos (casa_id, coalesce(emitente_cnpj,''), codigo_fiscal)
  where codigo_fiscal is not null;

create unique index if not exists nfce_mapeamento_descricao_uq
  on public.nfce_produto_mapeamentos (casa_id, coalesce(emitente_cnpj,''), lower(descricao_fiscal));

create index if not exists nfce_mapeamento_estoque_idx
  on public.nfce_produto_mapeamentos (casa_id, estoque_id);

comment on table public.nfce_produto_mapeamentos is
  'Dicionário aprendido entre descrição/código fiscal da NFC-e e o produto entendido pelo LifeOS.';
comment on column public.nfce_produto_mapeamentos.fator_quantidade is
  'Multiplicador da quantidade fiscal para a quantidade que deve entrar no estoque. Ex.: pacote de arroz de 5 kg = 5.';
comment on column public.nfce_produto_mapeamentos.acao_estoque is
  'conferir envia o item para conferência pós-compra; ignorar registra a compra sem mexer no estoque.';

alter table public.nfce_produto_mapeamentos enable row level security;

drop policy if exists nfce_mapeamentos_ler on public.nfce_produto_mapeamentos;
create policy nfce_mapeamentos_ler
  on public.nfce_produto_mapeamentos for select to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists nfce_mapeamentos_inserir on public.nfce_produto_mapeamentos;
create policy nfce_mapeamentos_inserir
  on public.nfce_produto_mapeamentos for insert to authenticated
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists nfce_mapeamentos_atualizar on public.nfce_produto_mapeamentos;
create policy nfce_mapeamentos_atualizar
  on public.nfce_produto_mapeamentos for update to authenticated
  using (public.lifeos_usuario_na_casa(casa_id))
  with check (public.lifeos_usuario_na_casa(casa_id));

drop policy if exists nfce_mapeamentos_remover on public.nfce_produto_mapeamentos;
create policy nfce_mapeamentos_remover
  on public.nfce_produto_mapeamentos for delete to authenticated
  using (public.lifeos_usuario_na_casa(casa_id));

grant select, insert, update, delete on public.nfce_produto_mapeamentos to authenticated;

create or replace function public.registrar_compra_nfce_v3(
  p_chave text,
  p_emitente text,
  p_cnpj text,
  p_emissao text,
  p_total numeric,
  p_total_bruto numeric,
  p_desconto numeric,
  p_itens jsonb
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
  v_existente uuid;
  v_item jsonb;
  v_lista_id uuid;
  v_estoque_id uuid;
  v_lista_nome text;
  v_nome text;
  v_qtd_fiscal numeric;
  v_unidade_fiscal text;
  v_qtd_estoque numeric;
  v_unidade_estoque text;
  v_preco_unitario numeric;
  v_preco_total numeric;
  v_acao text;
  v_categoria text;
  v_planejada numeric;
  v_unidade_planejada text;
  v_lista_estoque_id uuid;
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

  if nullif(trim(coalesce(p_chave,'')), '') is null then
    raise exception 'A chave da NFC-e é necessária para registrar a compra.';
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhum item foi informado para a compra.';
  end if;

  select s.id into v_existente
  from public.compras_sessoes s
  where s.casa_id = v_casa_id
    and s.origem = 'nfce'
    and s.origem_externa_id = trim(p_chave)
  limit 1;

  if v_existente is not null then
    return v_existente;
  end if;

  insert into public.compras_sessoes (
    casa_id, local_compra_id, local_nome, usuario_id,
    iniciada_em, finalizada_em, total_informado, itens_sem_preco, quantidade_itens,
    origem, origem_externa_id, emitente, emitente_cnpj, documento_emissao,
    total_bruto, desconto
  ) values (
    v_casa_id, null, coalesce(nullif(trim(p_emitente),''), 'NFC-e'), v_usuario_id,
    v_agora, v_agora, coalesce(p_total,0),
    (select count(*)::integer from jsonb_array_elements(p_itens) j where nullif(j->>'preco_total','') is null),
    jsonb_array_length(p_itens),
    'nfce', trim(p_chave), nullif(trim(p_emitente),''), nullif(regexp_replace(coalesce(p_cnpj,''),'\D','','g'),''),
    nullif(trim(p_emissao),''), p_total_bruto, p_desconto
  ) returning id into v_sessao_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_lista_id := null;
    v_estoque_id := null;
    v_lista_nome := null;
    v_planejada := null;
    v_unidade_planejada := null;
    v_lista_estoque_id := null;

    begin
      if nullif(v_item->>'lista_compra_id','') is not null then
        v_lista_id := (v_item->>'lista_compra_id')::uuid;
      end if;
    exception when invalid_text_representation then
      v_lista_id := null;
    end;

    begin
      if nullif(v_item->>'estoque_id','') is not null then
        v_estoque_id := (v_item->>'estoque_id')::uuid;
      end if;
    exception when invalid_text_representation then
      v_estoque_id := null;
    end;

    v_nome := coalesce(nullif(trim(v_item->>'nome_canonico'),''), nullif(trim(v_item->>'descricao_fiscal'),''), 'Item da NFC-e');
    v_qtd_fiscal := greatest(coalesce(nullif(v_item->>'quantidade_fiscal','')::numeric, 1), 0);
    v_unidade_fiscal := coalesce(nullif(trim(v_item->>'unidade_fiscal'),''), 'un');
    v_qtd_estoque := greatest(coalesce(nullif(v_item->>'quantidade_estoque','')::numeric, v_qtd_fiscal, 1), 0);
    v_unidade_estoque := coalesce(nullif(trim(v_item->>'unidade_estoque'),''), v_unidade_fiscal, 'un');
    v_preco_unitario := nullif(v_item->>'preco_unitario','')::numeric;
    v_preco_total := nullif(v_item->>'preco_total','')::numeric;
    v_acao := case when v_item->>'acao_estoque' = 'ignorar' then 'ignorar' else 'conferir' end;
    v_categoria := coalesce(nullif(trim(v_item->>'categoria'),''), 'mercado');

    if v_lista_id is not null then
      select l.nome,
             coalesce(l.quantidade_planejada,l.quantidade),
             coalesce(l.unidade_planejada,l.unidade),
             l.estoque_id
        into v_lista_nome, v_planejada, v_unidade_planejada, v_lista_estoque_id
      from public.lista_compras l
      where l.id = v_lista_id
        and l.casa_id = v_casa_id
        and l.status = 'pendente'
      for update;

      if not found then
        v_lista_id := null;
      else
        update public.lista_compras
        set nome = v_nome,
            quantidade_planejada = v_planejada,
            unidade_planejada = v_unidade_planejada,
            quantidade_comprada = v_qtd_fiscal,
            unidade_comprada = v_unidade_fiscal,
            quantidade = v_qtd_estoque,
            unidade = v_unidade_estoque,
            estoque_id = coalesce(v_estoque_id, estoque_id),
            categoria = coalesce(categoria, v_categoria),
            preco_unitario_compra = v_preco_unitario,
            preco_compra = v_preco_total,
            status = 'comprado',
            no_carrinho = false,
            aguardando_conferencia = (v_acao = 'conferir'),
            compra_sessao_id = v_sessao_id,
            comprado_por = v_usuario_id,
            comprado_em = v_agora,
            compra_observacao = concat('NFC-e ', trim(p_chave), ': ', v_qtd_fiscal, ' ', v_unidade_fiscal)
        where id = v_lista_id;
      end if;
    end if;

    if v_lista_id is null then
      insert into public.lista_compras (
        casa_id, nome, quantidade, unidade, categoria, status, origem, criado_por,
        estoque_id, quantidade_planejada, unidade_planejada,
        quantidade_comprada, unidade_comprada,
        preco_unitario_compra, preco_compra, no_carrinho, aguardando_conferencia,
        compra_sessao_id, comprado_por, comprado_em, compra_observacao
      ) values (
        v_casa_id, v_nome, v_qtd_estoque, v_unidade_estoque, v_categoria,
        'comprado', 'nfce', v_usuario_id, v_estoque_id,
        null, null, v_qtd_fiscal, v_unidade_fiscal,
        v_preco_unitario, v_preco_total, false, (v_acao = 'conferir'),
        v_sessao_id, v_usuario_id, v_agora,
        concat('NFC-e ', trim(p_chave), ': ', v_qtd_fiscal, ' ', v_unidade_fiscal)
      ) returning id into v_lista_id;
    end if;

    insert into public.compras_sessao_itens (
      sessao_id, lista_compra_id, nome,
      quantidade, unidade, quantidade_planejada, unidade_planejada,
      preco, destino_nome, estoque_id,
      codigo_fiscal, descricao_fiscal, preco_unitario,
      quantidade_estoque, unidade_estoque, acao_estoque
    ) values (
      v_sessao_id, v_lista_id, v_nome,
      v_qtd_fiscal, v_unidade_fiscal, v_planejada, v_unidade_planejada,
      v_preco_total, 'Mercado', coalesce(v_estoque_id,v_lista_estoque_id),
      nullif(trim(v_item->>'codigo_fiscal'),''), nullif(trim(v_item->>'descricao_fiscal'),''),
      v_preco_unitario, v_qtd_estoque, v_unidade_estoque, v_acao
    );
  end loop;

  return v_sessao_id;
end;
$$;

revoke all on function public.registrar_compra_nfce_v3(text,text,text,text,numeric,numeric,numeric,jsonb) from public;
revoke all on function public.registrar_compra_nfce_v3(text,text,text,text,numeric,numeric,numeric,jsonb) from anon;
grant execute on function public.registrar_compra_nfce_v3(text,text,text,text,numeric,numeric,numeric,jsonb) to authenticated;
