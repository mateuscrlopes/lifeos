-- ===================================================================
-- LIFEOS - MIGRACAO 020: FOTO DE PERFIL
-- Adiciona o endereço do avatar ao usuário e cria o bucket de imagens.
-- Pode ser executada mais de uma vez sem duplicar a estrutura.
-- ===================================================================

alter table public.usuarios
  add column if not exists avatar_url text;

grant select on public.usuarios to authenticated;
grant update (avatar_url) on public.usuarios to authenticated;

alter table public.usuarios enable row level security;

drop policy if exists usuarios_atualizar_proprio_avatar on public.usuarios;
create policy usuarios_atualizar_proprio_avatar
  on public.usuarios
  for update
  to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatares',
  'avatares',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cada pessoa só pode criar, substituir ou remover arquivos dentro
-- da pasta que possui o mesmo UUID da sua autenticação.
drop policy if exists avatares_ler_proprios on storage.objects;
create policy avatares_ler_proprios
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatares_inserir_proprios on storage.objects;
create policy avatares_inserir_proprios
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatares_atualizar_proprios on storage.objects;
create policy avatares_atualizar_proprios
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatares_excluir_proprios on storage.objects;
create policy avatares_excluir_proprios
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
