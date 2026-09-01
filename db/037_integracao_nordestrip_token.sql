-- LIFEOS - MIGRACAO 037: CREDENCIAL HASH DA PONTE NORDESTRIP
-- Somente o hash e persistido no LifeOS; o segredo original fica no Vault do Nordestrip.

insert into public.integracao_tokens (
  origem,
  token_hash,
  ativo,
  atualizado_em
)
values (
  'nordestrip',
  'c9bcf0f7651be2ae9a123304af32669bfa7a5d44078dcc23d00e5bad9b4c3ef7',
  true,
  now()
)
on conflict (origem) do update
set token_hash = excluded.token_hash,
    ativo = true,
    atualizado_em = now();
