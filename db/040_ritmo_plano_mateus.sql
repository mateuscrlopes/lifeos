-- LIFEOS - MIGRACAO 040: PLANO PESSOAL INICIAL DO RITMO
-- Preenche o plano do Mateus com o que foi definido no onboarding.
-- Ghustavo permanece vazio para importar/editar o proprio plano.

insert into public.ritmo_planos_alimentares (
  usuario_id, nome, origem, arquivo_nome, conteudo, ativo
)
select
  u.id,
  'Estrutura alimentar · Ciclo Nordeste',
  'manual',
  null,
  jsonb_build_object(
    'versao', 1,
    'status', 'ativo',
    'refeicoes', jsonb_build_array(
      jsonb_build_object(
        'nome','Café da manhã',
        'horario','07:30',
        'opcoes', jsonb_build_array(
          jsonb_build_object(
            'titulo','Base',
            'itens', jsonb_build_array(
              '2 fatias de pão de forma',
              '2 ovos',
              'pequena porção de requeijão ou queijo',
              'café preto com açúcar medido e redução progressiva'
            )
          )
        )
      ),
      jsonb_build_object(
        'nome','Lanche da manhã',
        'horario','10:00',
        'opcoes', jsonb_build_array(
          jsonb_build_object('titulo','Opção 1','itens',jsonb_build_array('banana','iogurte')),
          jsonb_build_object('titulo','Opção 2','itens',jsonb_build_array('pera ou maçã','iogurte ou queijo')),
          jsonb_build_object('titulo','Opção 3','itens',jsonb_build_array('tangerina','2 ovos'))
        )
      ),
      jsonb_build_object(
        'nome','Almoço',
        'horario','12:00',
        'opcoes', jsonb_build_array(
          jsonb_build_object(
            'titulo','Prato-base',
            'itens', jsonb_build_array(
              '150–180 g de proteína',
              '1 porção de arroz, batata, batata-doce, aipim, inhame ou macarrão',
              'feijão preto',
              'legumes e verduras em boa quantidade'
            )
          )
        )
      ),
      jsonb_build_object(
        'nome','Lanche da tarde',
        'horario','15:30',
        'opcoes', jsonb_build_array(
          jsonb_build_object('titulo','Opção 1','itens',jsonb_build_array('iogurte','fruta','20–30 g de granola')),
          jsonb_build_object('titulo','Opção 2','itens',jsonb_build_array('2 ovos','fruta')),
          jsonb_build_object('titulo','Opção 3','itens',jsonb_build_array('sanduíche com frango, atum ou ovo')),
          jsonb_build_object('titulo','Opção futura','itens',jsonb_build_array('iogurte ou leite','whey','fruta'))
        )
      ),
      jsonb_build_object(
        'nome','Jantar',
        'horario','19:30',
        'opcoes', jsonb_build_array(
          jsonb_build_object('titulo','Opção 1','itens',jsonb_build_array('omelete de 3 ovos','legumes')),
          jsonb_build_object('titulo','Opção 2','itens',jsonb_build_array('frango na Air Fryer','legumes')),
          jsonb_build_object('titulo','Opção 3','itens',jsonb_build_array('peixe','batata','salada')),
          jsonb_build_object('titulo','Opção 4','itens',jsonb_build_array('wrap ou sanduíche','frango, ovo ou atum','salada'))
        )
      )
    ),
    'regras', jsonb_build_array(
      'Priorizar alimentos práticos e de baixo atrito.',
      'Fruta deve ficar mais acessível que doces de grande volume.',
      'Açaí em porção individual, não em pote de 1 litro.',
      'Domingo prepara bases; legumes são finalizados próximos do consumo.',
      'Pão e arroz não são proibidos: entram por porção e contexto.'
    )
  ),
  true
from public.usuarios u
where lower(u.nome) like 'mateus%'
  and not exists (
    select 1
    from public.ritmo_planos_alimentares p
    where p.usuario_id = u.id
      and p.nome = 'Estrutura alimentar · Ciclo Nordeste'
  );
