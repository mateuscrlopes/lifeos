// plantas.js — Modulo Plantas do LifeOS v0.19

export async function carregarPlantas(supa, usuario) {
  const { data, error } = await supa
    .from('plantas')
    .select(`
      id, codigo, numero_etiqueta, nome_personalizado, status,
      comodo, posicao, metodo_cultivo, perfil_hidrico, cor_etiqueta, observacoes,
      especies(nome_popular, nome_cientifico),
      planta_rotinas(id, tipo, intervalo_dias, proxima_realizacao, ultima_realizacao, ativa)
    `)
    .eq('casa_id', usuario.casa_id)
    .eq('status', 'ativa')
    .order('numero_etiqueta');
  if (error) return { ok: false, motivo: error.message };
  return { ok: true, plantas: data || [] };
}

export async function carregarEspecies(supa, usuario) {
  const { data, error } = await supa
    .from('especies')
    .select('id, nome_popular, nome_cientifico, perfil_hidrico, metodo_cultivo, rotina_principal, intervalo_dias')
    .eq('casa_id', usuario.casa_id)
    .order('nome_popular');
  if (error) return [];
  return data || [];
}

// Retorna o proximo codigo e etiqueta disponíveis (PL-041, 41, etc.)
export async function proximoCodigo(supa, usuario) {
  const { data } = await supa
    .from('plantas')
    .select('numero_etiqueta')
    .eq('casa_id', usuario.casa_id)
    .order('numero_etiqueta', { ascending: false })
    .limit(1);
  const proximo = data?.[0]?.numero_etiqueta ? data[0].numero_etiqueta + 1 : 1;
  const codigo = 'PL-' + String(proximo).padStart(3, '0');
  return { codigo, numero_etiqueta: proximo };
}

// Cadastra uma nova planta com sua rotina principal.
export async function cadastrarPlanta(supa, usuario, dados) {
  const { especie_id, nome_personalizado, comodo, posicao, metodo_cultivo,
    perfil_hidrico, cor_etiqueta, observacoes,
    rotina_tipo, rotina_intervalo } = dados;

  const { codigo, numero_etiqueta } = await proximoCodigo(supa, usuario);

  const { data: planta, error } = await supa.from('plantas').insert({
    casa_id: usuario.casa_id,
    codigo, numero_etiqueta,
    especie_id: especie_id || null,
    nome_personalizado: nome_personalizado || null,
    status: 'ativa',
    comodo, posicao: posicao || null,
    metodo_cultivo, perfil_hidrico,
    cor_etiqueta: cor_etiqueta || null,
    observacoes: observacoes || null,
    criado_por: usuario.id,
  }).select().single();

  if (error) return { ok: false, motivo: error.message };

  // Cria a rotina principal
  if (rotina_tipo && rotina_intervalo) {
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + Number(rotina_intervalo));
    await supa.from('planta_rotinas').insert({
      planta_id: planta.id,
      tipo: rotina_tipo,
      intervalo_dias: Number(rotina_intervalo),
      proxima_realizacao: proxima.toISOString().slice(0, 10),
      ativa: true,
    });
  }

  // Evento de cadastro
  await supa.from('planta_eventos').insert({
    planta_id: planta.id,
    tipo: 'cadastro',
    notas: 'Planta cadastrada via LifeOS',
    usuario_id: usuario.id,
  });

  return { ok: true, planta, codigo };
}

// Atualiza o intervalo de uma rotina e recalcula a proxima data.
export async function editarRotina(supa, rotina, novoIntervalo) {
  const proxima = new Date();
  proxima.setDate(proxima.getDate() + Number(novoIntervalo));
  const { error } = await supa.from('planta_rotinas').update({
    intervalo_dias: Number(novoIntervalo),
    proxima_realizacao: proxima.toISOString().slice(0, 10),
  }).eq('id', rotina.id);
  return !error;
}

export function urgenciaPlanta(planta) {
  const rotinas = (planta.planta_rotinas || []).filter(r => r.ativa);
  if (!rotinas.length) return 'sem_rotina';
  const hoje = new Date().toISOString().slice(0, 10);
  let maisUrgente = 'ok';
  for (const r of rotinas) {
    if (!r.proxima_realizacao) continue;
    const dias = Math.round((new Date(r.proxima_realizacao) - new Date(hoje)) / 86400000);
    if (dias < 0) { maisUrgente = 'vencida'; break; }
    if (dias === 0 && maisUrgente !== 'vencida') maisUrgente = 'hoje';
    if (dias <= 2 && maisUrgente === 'ok') maisUrgente = 'breve';
  }
  return maisUrgente;
}

export const COR_URGENCIA = {
  vencida:    { cor: '#b23c3c', texto: 'Vencida' },
  hoje:       { cor: '#2f6f4f', texto: 'Hoje' },
  breve:      { cor: '#b8860b', texto: 'Em breve' },
  ok:         { cor: '#6b7280', texto: 'Em dia' },
  sem_rotina: { cor: '#6b7280', texto: '—' },
};

export const COR_PERFIL = {
  alto:  { cor: '#3b7dbf', label: 'Alto' },
  medio: { cor: '#2f6f4f', label: 'Médio' },
  baixo: { cor: '#b8860b', label: 'Baixo' },
};

export async function registrarCuidado(supa, usuario, planta, rotina) {
  const agora = new Date().toISOString();
  const hoje = agora.slice(0, 10);
  const proxima = new Date(hoje);
  proxima.setDate(proxima.getDate() + rotina.intervalo_dias);
  const proximaStr = proxima.toISOString().slice(0, 10);
  const tipoEvento = rotina.tipo === 'Trocar a água' ? 'troca_agua'
    : rotina.tipo === 'Fazer imersão' ? 'imersao' : 'rega';
  const { data, error } = await supa.rpc('registrar_cuidado_planta', {
    p_planta_id: planta.id,
    p_rotina_id: rotina.id,
    p_usuario_id: usuario.id,
    p_realizado_em: agora,
    p_proxima_realizacao: proximaStr,
    p_tipo_evento: tipoEvento,
    p_notas: `${rotina.tipo} registrada via LifeOS`,
  });
  if (error) return { ok: false, motivo: error.message };
  return { ok: true, proxima: data || proximaStr };
}

// Registra um cuidado manual (sem rotina vinculada) e atualiza a rotina principal se existir.
export async function registrarCuidadoManual(supa, usuario, planta, tipo) {
  const agora = new Date().toISOString();
  const hoje = agora.slice(0, 10);

  // Evento no historico
  await supa.from('planta_eventos').insert({
    planta_id: planta.id, tipo, data: agora,
    notas: 'Cuidado registrado manualmente via LifeOS',
    usuario_id: usuario.id,
  });

  // Se existir rotina ativa do mesmo tipo, atualiza a proxima data
  const tipoRotina = tipo === 'troca_agua' ? 'Trocar a água'
    : tipo === 'imersao' ? 'Fazer imersão' : 'Verificar e regar';
  const rotina = (planta.planta_rotinas || []).find(r => r.ativa && r.tipo === tipoRotina);
  if (rotina) {
    const proxima = new Date(hoje);
    proxima.setDate(proxima.getDate() + rotina.intervalo_dias);
    await supa.from('planta_rotinas').update({
      ultima_realizacao: hoje,
      proxima_realizacao: proxima.toISOString().slice(0, 10),
    }).eq('id', rotina.id);
  }

  return { ok: true };
}

// Remove a planta da listagem ativa sem apagar nenhum dado.
// Registra evento de remoção e marca status como 'removida'.
export async function removerPlanta(supa, usuario, planta) {
  const { error } = await supa.from('plantas')
    .update({ status: 'removida' })
    .eq('id', planta.id);
  if (error) return { ok: false };
  await supa.from('planta_eventos').insert({
    planta_id: planta.id,
    tipo: 'alteracao_status',
    notas: 'Planta removida da listagem ativa. Histórico preservado.',
    usuario_id: usuario.id,
  });
  return { ok: true };
}

export function contarUrgentes(plantas) {
  return plantas.filter(p => {
    const u = urgenciaPlanta(p);
    return u === 'vencida' || u === 'hoje';
  }).length;
}
