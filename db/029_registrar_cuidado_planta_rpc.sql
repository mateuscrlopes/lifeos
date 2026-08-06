-- LIFEOS - MIGRACAO 029: CUIDADO DE PLANTA ATOMICO
-- A funcao roda como o usuario autenticado. Uma chamada e atomica no
-- PostgreSQL: se a atualizacao ou o evento falhar, nada e persistido.

create or replace function public.registrar_cuidado_planta(
  p_planta_id uuid,
  p_rotina_id uuid,
  p_usuario_id uuid,
  p_realizado_em timestamptz,
  p_proxima_realizacao date,
  p_tipo_evento text,
  p_notas text
)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_casa_id uuid;
begin
  select planta.casa_id
    into v_casa_id
    from public.plantas planta
   where planta.id = p_planta_id;

  if v_casa_id is null then
    raise exception 'Planta não encontrada.';
  end if;

  if not exists (
    select 1
      from public.usuarios usuario
     where usuario.id = p_usuario_id
       and usuario.auth_id = auth.uid()
       and usuario.casa_id = v_casa_id
  ) then
    raise exception 'Usuário não autorizado para esta Casa.';
  end if;

  update public.planta_rotinas rotina
     set ultima_realizacao = p_realizado_em::date,
         proxima_realizacao = p_proxima_realizacao
   where rotina.id = p_rotina_id
     and rotina.planta_id = p_planta_id;

  if not found then
    raise exception 'A rotina não pertence à planta informada.';
  end if;

  insert into public.planta_eventos (planta_id, tipo, data, notas, usuario_id)
  values (p_planta_id, p_tipo_evento, p_realizado_em, p_notas, p_usuario_id);

  return p_proxima_realizacao;
end;
$$;

revoke all on function public.registrar_cuidado_planta(uuid, uuid, uuid, timestamptz, date, text, text) from public;
grant execute on function public.registrar_cuidado_planta(uuid, uuid, uuid, timestamptz, date, text, text) to authenticated;
