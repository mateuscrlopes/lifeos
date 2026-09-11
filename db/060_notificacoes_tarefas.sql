-- LifeOS — notificações de tarefas no centro de notificações.
-- Gera uma notificação por fase (amanhã, hoje, atrasada) e evita repetição a
-- cada abertura do aplicativo.

create unique index if not exists notificacoes_tarefa_fase_uq
  on public.notificacoes (usuario_id, tipo, entidade, entidade_id)
  where entidade = 'tarefas';

create or replace function public.sincronizar_notificacoes_tarefas(p_data date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_casa_id uuid;
  v_nome text;
  v_resp text;
  v_atrasadas integer := 0;
  v_hoje integer := 0;
  v_amanha integer := 0;
begin
  select u.id, u.casa_id, u.nome
    into v_usuario_id, v_casa_id, v_nome
  from public.usuarios u
  where u.auth_id = auth.uid()
  limit 1;

  if v_usuario_id is null or v_casa_id is null then
    raise exception 'Perfil do LifeOS não encontrado.';
  end if;

  v_resp := lower(trim(v_nome));

  -- Se a tarefa já foi concluída, notificações antigas deixam de aparecer como
  -- não lidas. O histórico continua preservado.
  update public.notificacoes n
  set lida = true,
      lida_em = coalesce(n.lida_em, now())
  where n.usuario_id = v_usuario_id
    and n.entidade = 'tarefas'
    and n.lida = false
    and exists (
      select 1 from public.tarefas t
      where t.id = n.entidade_id and t.feita = true
    );

  insert into public.notificacoes (
    casa_id, usuario_id, tipo, titulo, mensagem, entidade, entidade_id
  )
  select
    v_casa_id, v_usuario_id,
    case
      when t.data < p_data then 'tarefa_atrasada'
      when t.data = p_data then 'tarefa_hoje'
      else 'tarefa_amanha'
    end,
    case
      when t.data < p_data then 'Tarefa atrasada'
      when t.data = p_data then 'Tarefa para hoje'
      else 'Tarefa para amanhã'
    end,
    case
      when t.data < p_data then concat('“', t.titulo, '” está atrasada desde ', to_char(t.data, 'DD/MM'), '.')
      when t.data = p_data then concat('“', t.titulo, '” está pendente para hoje.')
      else concat('“', t.titulo, '” está pendente para amanhã.')
    end,
    'tarefas', t.id
  from public.tarefas t
  where t.casa_id = v_casa_id
    and t.feita = false
    and t.data is not null
    and t.data <= p_data + 1
    and lower(trim(t.responsavel)) in (v_resp, 'ambos')
  on conflict do nothing;

  select
    count(*) filter (where t.data < p_data)::integer,
    count(*) filter (where t.data = p_data)::integer,
    count(*) filter (where t.data = p_data + 1)::integer
  into v_atrasadas, v_hoje, v_amanha
  from public.tarefas t
  where t.casa_id = v_casa_id
    and t.feita = false
    and t.data is not null
    and t.data <= p_data + 1
    and lower(trim(t.responsavel)) in (v_resp, 'ambos');

  return jsonb_build_object(
    'atrasadas', coalesce(v_atrasadas,0),
    'hoje', coalesce(v_hoje,0),
    'amanha', coalesce(v_amanha,0)
  );
end;
$$;

revoke all on function public.sincronizar_notificacoes_tarefas(date) from public;
revoke all on function public.sincronizar_notificacoes_tarefas(date) from anon;
grant execute on function public.sincronizar_notificacoes_tarefas(date) to authenticated;
