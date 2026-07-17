// auth.js
// Ajuda a obter um cliente Supabase JA LOGADO a partir de email e senha.
// Varias rotas precisam disso (a lista, futuramente estoque, contas...),
// entao a logica fica isolada aqui em vez de repetida em cada rota.

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Recebe email e senha, faz login e devolve:
//  - { ok: true, cliente, usuario }  em caso de sucesso
//  - { ok: false, motivo }           se o login falhar
// O "cliente" devolvido ja carrega a sessao, entao todas as consultas
// feitas com ele respeitam o RLS como aquele usuario.
export async function autenticar(email, senha) {
  if (!email || !senha) {
    return { ok: false, motivo: 'Email e senha sao obrigatorios.' };
  }

  const cliente = createClient(config.supabaseUrl, config.supabaseAnonKey);

  const { data, error } = await cliente.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return { ok: false, motivo: error.message };
  }

  // Busca o perfil correspondente na tabela usuarios (id interno, nome, casa).
  const { data: perfil, error: erroPerfil } = await cliente
    .from('usuarios')
    .select('id, nome, casa_id')
    .eq('auth_id', data.user.id)
    .single();

  if (erroPerfil) {
    return { ok: false, motivo: 'Login ok, mas perfil nao encontrado: ' + erroPerfil.message };
  }

  return { ok: true, cliente, usuario: perfil };
}

// Encerra a sessao de um cliente (boa pratica apos terminar a operacao).
export async function encerrar(cliente) {
  try {
    await cliente.auth.signOut();
  } catch {
    // silencioso: se falhar ao deslogar, nao e critico para a resposta.
  }
}
