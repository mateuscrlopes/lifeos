-- LIFEOS - MIGRACAO 042: CORRECAO DE FONTES OFICIAIS DAS RECEITAS
update public.refeicoes
set fonte_url = replace(
  fonte_url,
  'https://www.gov.br/saude/pt-br/assuntos/saude-da-pessoa-idosa/alimentacao-saudavel/alimentacao-saudavel',
  'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-pessoa-idosa/alimentacao-saudavel/alimentacao-saudavel'
)
where fonte_url = 'https://www.gov.br/saude/pt-br/assuntos/saude-da-pessoa-idosa/alimentacao-saudavel/alimentacao-saudavel';

update public.refeicoes
set fonte_url = replace(
  fonte_url,
  'https://www.gov.br/saude/pt-br/assuntos/saude-da-pessoa-idosa/alimento-saudavel/2o-passo',
  'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-pessoa-idosa/alimento-saudavel/2o-passo'
)
where fonte_url = 'https://www.gov.br/saude/pt-br/assuntos/saude-da-pessoa-idosa/alimento-saudavel/2o-passo';
