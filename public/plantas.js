// plantas.js — Modulo Plantas do LifeOS

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
  const { error: erroRot } = await supa
    .from('planta_rotinas')
    .update({ ultima_realizacao: hoje, proxima_realizacao: proximaStr })
    .eq('id', rotina.id);
  if (erroRot) return { ok: false, motivo: erroRot.message };
  const tipoEvento = rotina.tipo === 'Trocar a água' ? 'troca_agua'
    : rotina.tipo === 'Fazer imersão' ? 'imersao' : 'rega';
  await supa.from('planta_eventos').insert({
    planta_id: planta.id, tipo: tipoEvento, data: agora,
    notas: `${rotina.tipo} registrada via LifeOS`, usuario_id: usuario.id,
  });
  return { ok: true, proxima: proximaStr };
}

export function contarUrgentes(plantas) {
  return plantas.filter(p => {
    const u = urgenciaPlanta(p);
    return u === 'vencida' || u === 'hoje';
  }).length;
}
