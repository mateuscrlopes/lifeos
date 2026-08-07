# Fase 3B — Receitas de verdade

A refeição existente passa a armazenar tempo de preparo, observações, modo de preparo e fonte. Os ingredientes continuam em `refeicao_ingredientes`.

No celular, os campos entram no cadastro atual; tocar numa refeição abre detalhes e permite editar os novos dados. No tablet, o modal contextual da Fase 3A é enriquecido com essas informações.

## Lista de compras

O LifeOS não tenta deduzir automaticamente o que existe na despensa. A pessoa marca os ingredientes que realmente faltam e confirma. A RPC `adicionar_ingredientes_receita_lista` valida Casa/usuário, evita um segundo item pendente com o mesmo nome, preserva quantidade/unidade e grava `origem = 'cardapio'`.

## Fora do escopo

Não entram nesta fase cálculo nutricional, substituições, porções individuais, reconhecimento automático ingrediente↔estoque nem plano alimentar individual.
