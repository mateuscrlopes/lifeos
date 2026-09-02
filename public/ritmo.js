// Ritmo — modulo pessoal do LifeOS
// Alimentacao, movimento e evolucao sem duplicar os modulos compartilhados da Casa.

(() => {
  'use strict';

  const R = {
    client: null,
    usuario: null,
    aba: 'hoje',
    perfil: null,
    ciclo: null,
    metas: [],
    medidas: [],
    checkins: [],
    planos: [],
    agenda: [],
    sessoes: [],
    fotos: [],
    planosAlimentares: [],
    cardapioHoje: [],
    carregando: false,
  };

  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const REFEICOES_PRIORITARIAS = [
    { tipo: 'cafe', nome: 'Café da manhã', inicio: 5, fim: 11 },
    { tipo: 'almoco', nome: 'Almoço', inicio: 11, fim: 17 },
    { tipo: 'jantar', nome: 'Jantar', inicio: 17, fim: 24 },
  ];

  function el(id) { return document.getElementById(id); }

  function escapar(valor = '') {
    const d = document.createElement('div');
    d.textContent = String(valor ?? '');
    return d.innerHTML;
  }

  function isoLocal(data = new Date()) {
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, '0');
    const d = String(data.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dataBr(valor) {
    if (!valor) return '—';
    const [a, m, d] = String(valor).slice(0, 10).split('-').map(Number);
    if (!a || !m || !d) return String(valor);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR');
  }

  function inicioSemana(data = new Date()) {
    const d = new Date(data);
    const dia = d.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function diferencaDias(a, b) {
    const umDia = 86400000;
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((db - da) / umDia);
  }

  function numero(valor, casas = 1) {
    const n = Number(valor);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }

  function svg(nome) {
    const icones = {
      refeicao: '<path d="M4 3v7a3 3 0 0 0 3 3h1V3M8 3v10M18 3v18M15 8c0-3 1-5 3-5v10h-3Z"/>',
      movimento: '<path d="M6.5 6.5h11M4 9v6M20 9v6M7 8v8M17 8v8M7 12h10"/>',
      agua: '<path d="M12 2.7S6.5 9 6.5 14a5.5 5.5 0 0 0 11 0c0-5-5.5-11.3-5.5-11.3Z"/>',
      medida: '<path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 4v4M12 4v2M16 4v4"/>',
      foto: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="m8 5 1.5-2h5L16 5"/><circle cx="12" cy="12" r="3"/>',
      plano: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
      casa: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
      mais: '<path d="M12 5v14M5 12h14"/>',
      editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      seta: '<path d="m9 18 6-6-6-6"/>',
      grafico: '<path d="M4 19V9M10 19V5M16 19v-8M22 19H2"/>',
      calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    };
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icones[nome] || icones.plano}</svg>`;
  }

  function contexto() {
    const ctx = window.lifeosContext;
    if (!ctx?.supa || !ctx?.usuario) return false;
    R.client = ctx.supa;
    R.usuario = ctx.usuario;
    return true;
  }

  function segundaIso() {
    return isoLocal(inicioSemana(new Date()));
  }

  function refeicaoAtual() {
    const h = new Date().getHours();
    return REFEICOES_PRIORITARIAS.find(r => h >= r.inicio && h < r.fim) || REFEICOES_PRIORITARIAS[2];
  }

  function checkin(tipo, data = isoLocal(), referenciaId = null) {
    return R.checkins.find(c =>
      c.tipo === tipo &&
      c.data === data &&
      (referenciaId ? c.referencia_id === referenciaId : !c.referencia_id)
    ) || null;
  }

  function statusLabel(status) {
    return {
      conforme: 'Feito conforme planejado',
      ajustes: 'Feito com ajustes',
      nao_feito: 'Não fiz',
    }[status] || 'Pendente';
  }

  function statusCurto(status) {
    return {
      conforme: 'Conforme',
      ajustes: 'Com ajustes',
      nao_feito: 'Não fiz',
    }[status] || 'Pendente';
  }

  async function carregarTudo() {
    if (!contexto() || R.carregando) return;
    R.carregando = true;

    const hoje = new Date();
    const semana = segundaIso();
    const ha90 = new Date();
    ha90.setDate(ha90.getDate() - 90);

    try {
      const [
        perfil,
        ciclos,
        metas,
        medidas,
        checkins,
        planos,
        agenda,
        sessoes,
        fotos,
        planosAlimentares,
        cardapio,
      ] = await Promise.all([
        R.client.from('ritmo_perfis').select('*').eq('usuario_id', R.usuario.id).maybeSingle(),
        R.client.from('ritmo_ciclos').select('*').eq('usuario_id', R.usuario.id).eq('ativo', true).order('inicio', { ascending: false }).limit(1),
        R.client.from('ritmo_metas').select('*').eq('usuario_id', R.usuario.id),
        R.client.from('ritmo_medidas').select('*').eq('usuario_id', R.usuario.id).gte('data', isoLocal(ha90)).order('data', { ascending: false }),
        R.client.from('ritmo_checkins').select('*').eq('usuario_id', R.usuario.id).gte('data', semana).order('registrado_em', { ascending: false }),
        R.client.from('ritmo_planos_atividade').select('*,ritmo_plano_itens(*)').eq('usuario_id', R.usuario.id).eq('ativo', true).order('nome'),
        R.client.from('ritmo_agenda').select('*,ritmo_planos_atividade(id,nome,tipo,local,descricao)').eq('usuario_id', R.usuario.id).eq('ativo', true).order('dia_semana'),
        R.client.from('ritmo_sessoes').select('id,plano_id,data,duracao_min,distancia_km,intensidade').eq('usuario_id', R.usuario.id).gte('data', isoLocal(ha90)).order('data', { ascending: false }).limit(50),
        R.client.from('ritmo_fotos').select('*').eq('usuario_id', R.usuario.id).order('data', { ascending: false }).limit(30),
        R.client.from('ritmo_planos_alimentares').select('*').eq('usuario_id', R.usuario.id).eq('ativo', true).order('criado_em', { ascending: false }),
        R.client.from('planejamento_semana')
          .select('id,responsavel,planejamento_dias(dia_semana,tipo,refeicao_nome,refeicoes(nome))')
          .eq('casa_id', R.usuario.casa_id)
          .eq('semana_inicio', semana),
      ]);

      R.perfil = perfil.data || null;
      R.ciclo = ciclos.data?.[0] || null;
      R.metas = metas.data || [];
      R.medidas = medidas.data || [];
      R.checkins = checkins.data || [];
      R.planos = (planos.data || []).map(p => ({
        ...p,
        ritmo_plano_itens: [...(p.ritmo_plano_itens || [])].sort((a, b) => a.ordem - b.ordem),
      }));
      R.agenda = agenda.data || [];
      R.sessoes = sessoes.data || [];
      R.fotos = fotos.data || [];
      R.planosAlimentares = planosAlimentares.data || [];
      R.cardapioHoje = montarCardapioHoje(cardapio.data || [], hoje);

      await anexarUrlsFotos();
      render();
    } catch (erro) {
      console.error('[Ritmo] Falha ao carregar', erro);
      renderErro('Não foi possível carregar o Ritmo agora.');
    } finally {
      R.carregando = false;
    }
  }

  function montarCardapioHoje(planejamentos, data) {
    const jsDia = data.getDay();
    if (jsDia === 0 || jsDia === 6) return [];
    const dia = jsDia;
    const linhas = [];
    for (const plano of planejamentos) {
      for (const item of (plano.planejamento_dias || [])) {
        if (item.dia_semana !== dia) continue;
        linhas.push({
          tipo: item.tipo,
          responsavel: plano.responsavel || 'ambos',
          nome: item.refeicoes?.nome || item.refeicao_nome || 'Refeição planejada',
        });
      }
    }
    return linhas;
  }

  async function anexarUrlsFotos() {
    if (!R.fotos.length) return;
    await Promise.all(R.fotos.map(async foto => {
      const { data } = await R.client.storage.from('ritmo-fotos').createSignedUrl(foto.storage_path, 600);
      foto.url = data?.signedUrl || null;
    }));
  }

  function cicloProgresso() {
    if (!R.ciclo) return { pct: 0, texto: 'Nenhum ciclo ativo' };
    const inicio = new Date(`${R.ciclo.inicio}T00:00:00`);
    const fim = R.ciclo.fim ? new Date(`${R.ciclo.fim}T00:00:00`) : new Date();
    const agora = new Date();
    const total = Math.max(1, diferencaDias(inicio, fim) + 1);
    const passou = Math.min(total, Math.max(0, diferencaDias(inicio, agora) + 1));
    const pct = Math.max(0, Math.min(100, Math.round((passou / total) * 100)));
    return { pct, texto: `Dia ${passou} de ${total}` };
  }

  function pesoAtual() {
    return R.medidas.find(m => Number.isFinite(Number(m.peso_kg)))?.peso_kg ?? null;
  }

  function mediaPeso7() {
    const pesos = R.medidas
      .filter(m => Number.isFinite(Number(m.peso_kg)))
      .slice(0, 7)
      .map(m => Number(m.peso_kg));
    if (!pesos.length) return null;
    return pesos.reduce((a, b) => a + b, 0) / pesos.length;
  }

  function imcAtual() {
    const peso = Number(pesoAtual());
    const altura = Number(R.perfil?.altura_cm) / 100;
    if (!peso || !altura) return null;
    return peso / (altura * altura);
  }

  function cinturaAtual() {
    return R.medidas.find(m => Number.isFinite(Number(m.cintura_cm)))?.cintura_cm ?? null;
  }

  function consistenciaSemana() {
    const hoje = new Date();
    const diaSemana = hoje.getDay() === 0 ? 7 : hoje.getDay();
    const hora = hoje.getHours();

    let esperados = Math.max(0, diaSemana - 1) * 3;
    if (hora >= 8) esperados += 1;
    if (hora >= 12) esperados += 1;
    if (hora >= 19) esperados += 1;

    const atividadesEsperadas = R.agenda.filter(a => {
      const dia = a.dia_semana === 0 ? 7 : a.dia_semana;
      return dia < diaSemana || dia === diaSemana;
    }).length;
    esperados += atividadesEsperadas;

    const feitos = R.checkins.filter(c =>
      c.tipo !== 'agua' &&
      c.status !== 'nao_feito'
    ).length;

    const pct = esperados ? Math.min(100, Math.round((feitos / esperados) * 100)) : 0;
    return { pct, feitos, esperados };
  }

  function progressoFotos() {
    const datas = [...new Set(R.fotos.map(f => f.data))].sort().reverse();
    const ultima = datas[0] || null;
    if (!ultima) return { devido: true, texto: 'Seu primeiro registro visual está pendente.' };
    const d = new Date(`${ultima}T00:00:00`);
    const intervalo = Number(R.perfil?.foto_intervalo_dias || 15);
    const dias = diferencaDias(d, new Date());
    if (dias >= intervalo) return { devido: true, texto: `Último registro há ${dias} dias.` };
    return { devido: false, texto: `Próximo registro em ${Math.max(0, intervalo - dias)} dias.` };
  }

  function renderErro(mensagem) {
    const mount = el('ritmoMount');
    if (mount) mount.innerHTML = `<div class="ritmo-shell"><div class="ritmo-card ritmo-empty">${escapar(mensagem)}</div></div>`;
  }

  function render() {
    const mount = el('ritmoMount');
    if (!mount || !R.usuario) return;

    const ciclo = cicloProgresso();
    mount.innerHTML = `
      <div class="ritmo-shell">
        <div class="ritmo-context-bar">
          <span>LifeOS</span><span>›</span><strong>Ritmo</strong>
        </div>

        <section class="ritmo-hero">
          <div class="ritmo-kicker">Seu ritmo pessoal</div>
          <h2>${escapar(R.ciclo?.nome || 'Ritmo')}</h2>
          <p>${escapar(R.ciclo?.objetivo || 'Alimentação, movimento e evolução no seu contexto.')}</p>
          <div class="ritmo-cycle-row">
            <div>
              <div class="ritmo-cycle-label">${escapar(R.ciclo?.fase || 'Ciclo atual')}</div>
              <div class="ritmo-cycle-value">${escapar(R.usuario.nome)}</div>
            </div>
            <div class="ritmo-cycle-days">${escapar(ciclo.texto)}</div>
          </div>
          <div class="ritmo-progress"><span style="width:${ciclo.pct}%"></span></div>
        </section>

        <nav class="ritmo-tabs" aria-label="Áreas do Ritmo">
          ${tabBtn('hoje','Hoje')}
          ${tabBtn('movimento','Movimento')}
          ${tabBtn('evolucao','Evolução')}
          ${tabBtn('plano','Plano')}
        </nav>

        <main class="ritmo-view">
          ${R.aba === 'hoje' ? renderHoje() : ''}
          ${R.aba === 'movimento' ? renderMovimento() : ''}
          ${R.aba === 'evolucao' ? renderEvolucao() : ''}
          ${R.aba === 'plano' ? renderPlano() : ''}
        </main>
      </div>
      ${renderModalBase()}
    `;

    ligarEventos();
  }

  function tabBtn(id, nome) {
    return `<button class="ritmo-tab ${R.aba === id ? 'is-active' : ''}" data-ritmo-tab="${id}">${nome}</button>`;
  }

  function renderHoje() {
    const atual = refeicaoAtual();
    const c = checkin(atual.tipo);
    const agua = Number(checkin('agua')?.valor || 0);
    const metaAgua = Number(R.perfil?.meta_agua_ml || 2000);
    const blocos = Math.max(1, Math.round(metaAgua / 500));
    const preenchidos = Math.min(blocos, Math.floor(agua / 500));
    const cons = consistenciaSemana();
    const agendaHoje = R.agenda.filter(a => a.dia_semana === new Date().getDay());
    const foto = progressoFotos();

    return `
      <section class="ritmo-section">
        <div class="ritmo-card ritmo-primary-checkin">
          <div class="ritmo-eyebrow">Agora</div>
          <h3>${escapar(atual.nome)}</h3>
          <p>${c ? escapar(statusLabel(c.status)) : 'Quando concluir, registre em um toque.'}</p>
          ${c
            ? `<div class="ritmo-status-line">${svg('check')} ${escapar(statusCurto(c.status))}</div>
               <div class="ritmo-actions"><button class="ritmo-btn secondary" data-checkin="${atual.tipo}">Alterar check-in</button></div>`
            : `<div class="ritmo-actions"><button class="ritmo-btn" data-checkin="${atual.tipo}">Fazer check-in</button></div>`
          }
        </div>
        <div class="ritmo-actions" style="margin-top:7px">
          <button class="ritmo-btn ghost" id="ritmoDiaCompleto">Ver dia completo</button>
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-grid-2">
          <div class="ritmo-stat">
            <div class="ritmo-stat-label">Calorias</div>
            <div class="ritmo-stat-value">${R.perfil?.meta_calorias ? numero(R.perfil.meta_calorias,0) : '—'}</div>
            <div class="ritmo-stat-meta">meta diária</div>
          </div>
          <div class="ritmo-stat">
            <div class="ritmo-stat-label">Proteína</div>
            <div class="ritmo-stat-value">${R.perfil?.meta_proteina_g ? numero(R.perfil.meta_proteina_g,0) + ' g' : '—'}</div>
            <div class="ritmo-stat-meta">meta diária</div>
          </div>
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Água</h3><span>${numero(agua,0)} / ${numero(metaAgua,0)} ml</span></div>
        <div class="ritmo-card">
          <div class="ritmo-water-track">
            ${Array.from({ length: blocos }, (_, i) => `<span class="ritmo-water-unit ${i < preenchidos ? 'is-filled' : ''}"></span>`).join('')}
          </div>
          <div class="ritmo-actions">
            <button class="ritmo-btn" id="ritmoAguaMais">+ 500 ml</button>
            ${agua > 0 ? '<button class="ritmo-btn secondary" id="ritmoAguaMenos">− 500 ml</button>' : ''}
          </div>
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Movimento de hoje</h3><button data-ritmo-go="movimento">Ver semana</button></div>
        <div class="ritmo-card">
          ${agendaHoje.length
            ? agendaHoje.map(renderAgendaHoje).join('')
            : '<div class="ritmo-empty">Hoje não há atividade planejada. Descanso também faz parte do plano.</div>'}
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Semana em Ritmo</h3><span>${cons.feitos}/${cons.esperados || 0} registros</span></div>
        <div class="ritmo-card ritmo-consistency-card">
          <div class="ritmo-donut" style="--p:${cons.pct}%"><strong>${cons.pct}%</strong></div>
          <div class="ritmo-row-main">
            <strong>Consistência, não perfeição</strong>
            <small>Refeições prioritárias e atividades realizadas até hoje.</small>
          </div>
        </div>
        <div class="ritmo-card" style="margin-top:9px">
          ${renderSemanaMini()}
        </div>
      </section>

      ${foto.devido ? `
        <section class="ritmo-section">
          <div class="ritmo-card">
            <div class="ritmo-meal-row">
              <div class="ritmo-row-icon">${svg('foto')}</div>
              <div class="ritmo-row-main">
                <strong>Registro visual</strong>
                <small>${escapar(foto.texto)}</small>
              </div>
              <button class="ritmo-btn secondary" data-ritmo-go="evolucao">Abrir</button>
            </div>
          </div>
        </section>
      ` : ''}

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Cardápio da Casa</h3><button id="ritmoAbrirCardapio">Abrir na Casa</button></div>
        <div class="ritmo-card">
          ${renderCardapioHoje()}
        </div>
      </section>
    `;
  }

  function renderAgendaHoje(a) {
    const c = checkin('atividade', isoLocal(), a.id);
    return `
      <div class="ritmo-activity-row">
        <div class="ritmo-row-icon">${svg('movimento')}</div>
        <div class="ritmo-row-main">
          <strong>${escapar(a.titulo)}</strong>
          <small>${escapar(a.ritmo_planos_atividade?.local || a.ritmo_planos_atividade?.tipo || 'Atividade')}</small>
        </div>
        ${c
          ? `<span class="ritmo-chip is-good">${statusCurto(c.status)}</span>`
          : `<button class="ritmo-btn secondary" data-abrir-atividade="${a.id}">Abrir</button>`
        }
      </div>
    `;
  }

  function renderSemanaMini() {
    const inicio = inicioSemana(new Date());
    return `<div class="ritmo-week">${Array.from({ length: 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const iso = isoLocal(d);
      const registros = R.checkins.filter(c => c.data === iso && c.tipo !== 'agua');
      const bons = registros.filter(c => c.status !== 'nao_feito').length;
      const hoje = iso === isoLocal();
      return `<div class="ritmo-day ${bons ? 'is-good' : ''} ${hoje ? 'is-today' : ''}">
        <strong>${DIAS[d.getDay()]}</strong><span>${bons || '·'}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function renderCardapioHoje() {
    if (!R.cardapioHoje.length) {
      return `<div class="ritmo-empty">Não há almoço ou jantar compartilhado registrado para hoje. O planejamento continua no módulo Cardápio da Casa.</div>`;
    }
    return R.cardapioHoje.map(item => `
      <div class="ritmo-meal-row">
        <div class="ritmo-row-icon">${svg('refeicao')}</div>
        <div class="ritmo-row-main">
          <strong>${escapar(item.nome)}</strong>
          <small>${item.tipo === 'almoco' ? 'Almoço' : 'Jantar'} · ${escapar(item.responsavel)}</small>
        </div>
      </div>
    `).join('');
  }

  function renderMovimento() {
    const grupos = Array.from({ length: 7 }, (_, dia) => ({
      dia,
      itens: R.agenda.filter(a => a.dia_semana === dia),
    }));
    const ordem = [1,2,3,4,5,6,0];

    return `
      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Sua semana</h3><button id="ritmoNovaAtividade">+ Atividade</button></div>
        <div class="ritmo-card">
          ${ordem.map(dia => {
            const g = grupos.find(x => x.dia === dia);
            return `
              <div class="ritmo-activity-row">
                <div class="ritmo-row-icon">${svg('calendario')}</div>
                <div class="ritmo-row-main">
                  <strong>${DIAS[dia]}</strong>
                  <small>${g.itens.length ? g.itens.map(i => i.titulo).join(' · ') : 'Sem atividade planejada'}</small>
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Planos de atividade</h3><span>Qualquer modalidade</span></div>
        <div class="ritmo-card">
          ${R.planos.length
            ? R.planos.map(p => `
              <div class="ritmo-plan-row">
                <div class="ritmo-row-icon">${svg('movimento')}</div>
                <div class="ritmo-row-main">
                  <strong>${escapar(p.nome)}</strong>
                  <small>${escapar(rotuloTipo(p.tipo))}${p.local ? ' · ' + escapar(p.local) : ''}${p.ritmo_plano_itens?.length ? ' · ' + p.ritmo_plano_itens.length + ' itens' : ''}</small>
                </div>
                <button class="ritmo-btn secondary" data-plano-detalhe="${p.id}">Abrir</button>
              </div>
            `).join('')
            : '<div class="ritmo-empty">Nenhuma atividade cadastrada. Circo, pilates, academia, corrida ou qualquer outro movimento pode entrar aqui.</div>'
          }
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Últimas atividades</h3><span>${R.sessoes.length} registradas</span></div>
        <div class="ritmo-card">
          ${R.sessoes.slice(0, 6).length ? R.sessoes.slice(0, 6).map(s => {
            const p = R.planos.find(x => x.id === s.plano_id);
            return `<div class="ritmo-activity-row">
              <div class="ritmo-row-icon">${svg('check')}</div>
              <div class="ritmo-row-main"><strong>${escapar(p?.nome || 'Atividade')}</strong><small>${dataBr(s.data)}${s.duracao_min ? ' · ' + s.duracao_min + ' min' : ''}${s.distancia_km ? ' · ' + numero(s.distancia_km,1) + ' km' : ''}</small></div>
            </div>`;
          }).join('') : '<div class="ritmo-empty">Quando você concluir atividades, o histórico aparece aqui.</div>'}
        </div>
      </section>
    `;
  }

  function rotuloTipo(tipo) {
    return {
      academia: 'Academia',
      corrida: 'Corrida/caminhada',
      pilates: 'Pilates',
      circo: 'Circo',
      bicicleta: 'Bicicleta',
      natacao: 'Natação',
      outro: 'Outra atividade',
    }[tipo] || tipo || 'Atividade';
  }

  function renderEvolucao() {
    const atual = pesoAtual();
    const media = mediaPeso7();
    const imc = imcAtual();
    const cintura = cinturaAtual();
    const foto = progressoFotos();
    const datasFotos = [...new Set(R.fotos.map(f => f.data))].sort().reverse();

    return `
      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Seu corpo em contexto</h3><button id="ritmoNovaMedida">+ Registrar</button></div>
        <div class="ritmo-stats">
          ${stat('Peso atual', atual ? numero(atual,1) + ' kg' : '—', 'último registro')}
          ${stat('Média 7 registros', media ? numero(media,1) + ' kg' : '—', 'tendência, não um dia isolado')}
          ${stat('Cintura', cintura ? numero(cintura,1) + ' cm' : '—', 'última medida')}
          ${stat('IMC', imc ? numero(imc,1) : '—', 'indicador auxiliar')}
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Medidas recentes</h3><span>${R.medidas.length} registros</span></div>
        <div class="ritmo-card">
          ${R.medidas.slice(0, 6).length ? R.medidas.slice(0, 6).map(m => `
            <div class="ritmo-measure-row">
              <div class="ritmo-row-icon">${svg('medida')}</div>
              <div class="ritmo-row-main">
                <strong>${dataBr(m.data)}</strong>
                <small>${[
                  m.peso_kg ? numero(m.peso_kg,1) + ' kg' : '',
                  m.cintura_cm ? 'cintura ' + numero(m.cintura_cm,1) + ' cm' : '',
                  m.abdomen_cm ? 'abdômen ' + numero(m.abdomen_cm,1) + ' cm' : '',
                ].filter(Boolean).join(' · ') || 'Medidas corporais'}</small>
              </div>
            </div>
          `).join('') : '<div class="ritmo-empty">Registre sua primeira medida para iniciar a evolução.</div>'}
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Metas do ciclo</h3><button id="ritmoEditarMetas">Editar</button></div>
        <div class="ritmo-card">
          ${R.metas.length ? R.metas.map(m => `
            <div class="ritmo-measure-row">
              <div class="ritmo-row-icon">${svg('grafico')}</div>
              <div class="ritmo-row-main">
                <strong>${escapar(rotuloIndicador(m.indicador))}</strong>
                <small>${escapar(rotuloEstrategia(m.estrategia))}</small>
              </div>
              <span class="ritmo-chip">${m.valor_meta != null ? numero(m.valor_meta,1) + ' ' + escapar(m.unidade) : 'sem número fixo'}</span>
            </div>
          `).join('') : '<div class="ritmo-empty">Nenhuma meta definida ainda.</div>'}
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Fotos de evolução</h3><span>${foto.devido ? 'registro pendente' : escapar(foto.texto)}</span></div>
        <div class="ritmo-card">
          <div class="ritmo-alert">As fotos ficam privadas no seu perfil. O tablet da Casa e outros moradores não recebem acesso a elas.</div>
          <div class="ritmo-photo-grid">
            ${fotoSlot('frente')}
            ${fotoSlot('lado')}
            ${fotoSlot('costas')}
          </div>
          <div class="ritmo-actions">
            <button class="ritmo-btn" data-foto-posicao="frente">Foto de frente</button>
            <button class="ritmo-btn secondary" data-foto-posicao="lado">Foto de lado</button>
            <button class="ritmo-btn secondary" data-foto-posicao="costas">Foto de costas</button>
          </div>
          <input id="ritmoFotoInput" type="file" accept="image/*" capture="environment" hidden>
          <div class="ritmo-note">${escapar(foto.texto)}</div>
        </div>
      </section>

      ${datasFotos.length >= 2 ? renderComparacaoFotos(datasFotos) : ''}
    `;
  }

  function stat(label, value, meta) {
    return `<div class="ritmo-stat"><div class="ritmo-stat-label">${escapar(label)}</div><div class="ritmo-stat-value">${escapar(value)}</div><div class="ritmo-stat-meta">${escapar(meta)}</div></div>`;
  }

  function rotuloIndicador(v) {
    return {
      peso: 'Peso',
      cintura: 'Cintura',
      abdomen: 'Abdômen',
      quadril_alto: 'Quadril alto',
      quadril_max: 'Quadril',
      peito: 'Peito',
      coxa_d: 'Coxa',
      braco_d: 'Braço',
      panturrilha_d: 'Panturrilha',
    }[v] || v;
  }

  function rotuloEstrategia(v) {
    return {
      reduzir: 'Reduzir',
      aumentar: 'Aumentar',
      manter: 'Manter',
      acompanhar: 'Apenas acompanhar',
    }[v] || v;
  }

  function fotoSlot(posicao) {
    const hoje = isoLocal();
    const f = R.fotos.find(x => x.data === hoje && x.posicao === posicao) || R.fotos.find(x => x.posicao === posicao);
    if (f?.url) return `<div class="ritmo-photo"><img src="${escapar(f.url)}" alt="Foto de evolução · ${escapar(posicao)}"></div>`;
    return `<div class="ritmo-photo">${escapar(posicao)}<br>sem foto</div>`;
  }

  function renderComparacaoFotos(datas) {
    const antiga = datas[datas.length - 1];
    const recente = datas[0];
    const fa = R.fotos.find(f => f.data === antiga && f.posicao === 'frente');
    const fr = R.fotos.find(f => f.data === recente && f.posicao === 'frente');
    if (!fa?.url || !fr?.url) return '';

    return `
      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Comparação</h3><span>frente</span></div>
        <div class="ritmo-card ritmo-photo-compare">
          <figure><img src="${escapar(fa.url)}" alt="Registro anterior"><figcaption>${dataBr(antiga)}</figcaption></figure>
          <figure><img src="${escapar(fr.url)}" alt="Registro recente"><figcaption>${dataBr(recente)}</figcaption></figure>
        </div>
      </section>
    `;
  }

  function renderPlano() {
    return `
      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Metas pessoais</h3><span>editável</span></div>
        <div class="ritmo-card">
          <div class="ritmo-form-grid">
            ${campoMeta('ritmoAltura','Altura (cm)',R.perfil?.altura_cm)}
            ${campoMeta('ritmoCalorias','Calorias/dia',R.perfil?.meta_calorias)}
            ${campoMeta('ritmoProteina','Proteína (g/dia)',R.perfil?.meta_proteina_g)}
            ${campoMeta('ritmoAguaMeta','Água (ml/dia)',R.perfil?.meta_agua_ml)}
            ${campoMeta('ritmoFotoIntervalo','Fotos a cada (dias)',R.perfil?.foto_intervalo_dias || 15)}
          </div>
          <div class="ritmo-actions"><button class="ritmo-btn" id="ritmoSalvarPerfil">Salvar metas</button></div>
          <div class="ritmo-note">Esses valores pertencem ao seu perfil. O outro morador define os próprios.</div>
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Plano alimentar pessoal</h3><span>${R.planosAlimentares.length ? 'ativo' : 'não preenchido'}</span></div>
        ${R.planosAlimentares.length ? R.planosAlimentares.map(renderPlanoAlimentar).join('') : ''}
        <div class="ritmo-card ritmo-import-box">
          <div class="ritmo-eyebrow">Importar plano</div>
          <div style="font-size:14px;font-weight:700;margin-top:5px">Tem um plano em PDF?</div>
          <div class="ritmo-note">Envie o arquivo e o LifeOS organiza refeições, horários e opções para você revisar. O PDF é lido localmente no servidor e o arquivo original não é guardado.</div>
          <input id="ritmoPdfPlano" type="file" accept="application/pdf">
          <div id="ritmoPdfStatus" class="ritmo-note"></div>
        </div>
      </section>

      <section class="ritmo-section">
        <div class="ritmo-section-head"><h3>Alimentação da Casa</h3><span>compartilhado</span></div>
        <div class="ritmo-card">
          ${renderCardapioHoje()}
          <div class="ritmo-actions"><button class="ritmo-btn secondary" id="ritmoAbrirCardapio2">Abrir Cardápio da Casa</button></div>
          <div class="ritmo-note">Receitas, cardápio semanal, estoque e lista de compras continuam únicos no LifeOS. O Ritmo usa esses dados sem criar uma cópia.</div>
        </div>
      </section>
    `;
  }

  function campoMeta(id, label, value) {
    return `<div class="ritmo-field"><label for="${id}">${escapar(label)}</label><input id="${id}" type="number" min="0" step="any" value="${value ?? ''}"></div>`;
  }

  function renderPlanoAlimentar(plano) {
    const refeicoes = plano.conteudo?.refeicoes || [];
    return `
      <div class="ritmo-card">
        <div class="ritmo-section-head" style="margin-bottom:5px">
          <h3>${escapar(plano.nome)}</h3>
          <button data-editar-plano-alimentar="${plano.id}">Editar</button>
        </div>
        ${plano.origem === 'pdf' ? `<span class="ritmo-chip">PDF · ${escapar(plano.arquivo_nome || '')}</span>` : '<span class="ritmo-chip">Plano pessoal</span>'}
        ${refeicoes.length ? refeicoes.map(ref => `
          <div class="ritmo-meal-row" style="align-items:flex-start">
            <div class="ritmo-row-icon">${svg('refeicao')}</div>
            <div class="ritmo-row-main">
              <strong>${escapar(ref.nome)}${ref.horario ? ' · ' + escapar(ref.horario) : ''}</strong>
              ${(ref.opcoes || []).map(op => `
                <div class="ritmo-option">
                  <strong>${escapar(op.titulo || 'Opção')}</strong>
                  <p>${escapar((op.itens || []).join(' · '))}</p>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('') : '<div class="ritmo-empty">O plano foi salvo, mas precisa de revisão manual.</div>'}
      </div>
    `;
  }

  function renderModalBase() {
    return `<div class="ritmo-modal" id="ritmoModal" hidden><div class="ritmo-sheet"><div id="ritmoModalConteudo"></div></div></div>`;
  }

  function abrirModal(html) {
    const modal = el('ritmoModal');
    const conteudo = el('ritmoModalConteudo');
    if (!modal || !conteudo) return;
    conteudo.innerHTML = html;
    modal.hidden = false;
    conteudo.querySelectorAll('[data-fechar-ritmo]').forEach(b => b.addEventListener('click', fecharModal));
    modal.addEventListener('click', eventoFundoModal, { once: true });
  }

  function eventoFundoModal(e) {
    if (e.target?.id === 'ritmoModal') fecharModal();
  }

  function fecharModal() {
    const modal = el('ritmoModal');
    if (modal) modal.hidden = true;
  }

  function modalHead(titulo, subtitulo = '') {
    return `<div class="ritmo-sheet-head"><div><h3>${escapar(titulo)}</h3>${subtitulo ? `<p>${escapar(subtitulo)}</p>` : ''}</div><button class="ritmo-close" data-fechar-ritmo>×</button></div>`;
  }

  function ligarEventos() {
    document.querySelectorAll('[data-ritmo-tab]').forEach(b => b.addEventListener('click', () => {
      R.aba = b.dataset.ritmoTab;
      render();
    }));
    document.querySelectorAll('[data-ritmo-go]').forEach(b => b.addEventListener('click', () => {
      R.aba = b.dataset.ritmoGo;
      render();
    }));
    document.querySelectorAll('[data-checkin]').forEach(b => b.addEventListener('click', () => abrirCheckin(b.dataset.checkin)));
    document.querySelectorAll('[data-abrir-atividade]').forEach(b => b.addEventListener('click', () => abrirAtividadeAgenda(b.dataset.abrirAtividade)));
    document.querySelectorAll('[data-plano-detalhe]').forEach(b => b.addEventListener('click', () => abrirPlanoDetalhe(b.dataset.planoDetalhe)));
    document.querySelectorAll('[data-editar-plano-alimentar]').forEach(b => b.addEventListener('click', () => abrirEditorPlanoAlimentar(b.dataset.editarPlanoAlimentar)));
    document.querySelectorAll('[data-foto-posicao]').forEach(b => b.addEventListener('click', () => iniciarFoto(b.dataset.fotoPosicao)));

    el('ritmoDiaCompleto')?.addEventListener('click', abrirDiaCompleto);
    el('ritmoAguaMais')?.addEventListener('click', () => alterarAgua(500));
    el('ritmoAguaMenos')?.addEventListener('click', () => alterarAgua(-500));
    el('ritmoAbrirCardapio')?.addEventListener('click', abrirCardapioCasa);
    el('ritmoAbrirCardapio2')?.addEventListener('click', abrirCardapioCasa);
    el('ritmoNovaAtividade')?.addEventListener('click', abrirNovaAtividade);
    el('ritmoNovaMedida')?.addEventListener('click', abrirNovaMedida);
    el('ritmoEditarMetas')?.addEventListener('click', abrirEditarMetas);
    el('ritmoSalvarPerfil')?.addEventListener('click', salvarPerfil);
    el('ritmoPdfPlano')?.addEventListener('change', importarPdf);
    el('ritmoFotoInput')?.addEventListener('change', enviarFoto);
  }

  function abrirCheckin(tipo, referenciaId = null) {
    const refeicao = REFEICOES_PRIORITARIAS.find(r => r.tipo === tipo);
    const titulo = refeicao?.nome || 'Atividade';
    abrirModal(`
      ${modalHead(`Check-in · ${titulo}`, 'Registre como aconteceu de verdade.')}
      <div class="ritmo-actions" style="display:grid;grid-template-columns:1fr">
        <button class="ritmo-btn" data-checkin-status="conforme">Feito conforme planejado</button>
        <button class="ritmo-btn secondary" data-checkin-status="ajustes">Fiz com ajustes</button>
        <button class="ritmo-btn danger" data-checkin-status="nao_feito">Não fiz</button>
      </div>
      <div class="ritmo-field" style="margin-top:14px"><label>Observação opcional</label><textarea id="ritmoCheckinObs" placeholder="Ex.: almocei fora, troquei a proteína..."></textarea></div>
    `);
    document.querySelectorAll('[data-checkin-status]').forEach(btn => btn.addEventListener('click', async () => {
      await salvarCheckin(tipo, btn.dataset.checkinStatus, referenciaId, el('ritmoCheckinObs')?.value || '');
      fecharModal();
      await carregarTudo();
    }));
  }

  function abrirDiaCompleto() {
    abrirModal(`
      ${modalHead('Seu dia', 'Você pode registrar uma refeição mesmo depois do horário.')}
      ${REFEICOES_PRIORITARIAS.map(r => {
        const c = checkin(r.tipo);
        return `<div class="ritmo-meal-row">
          <div class="ritmo-row-icon">${svg('refeicao')}</div>
          <div class="ritmo-row-main"><strong>${escapar(r.nome)}</strong><small>${c ? escapar(statusLabel(c.status)) : 'Ainda não registrado'}</small></div>
          <button class="ritmo-btn secondary" data-dia-checkin="${r.tipo}">${c ? 'Alterar' : 'Registrar'}</button>
        </div>`;
      }).join('')}
    `);
    document.querySelectorAll('[data-dia-checkin]').forEach(b => b.addEventListener('click', () => {
      fecharModal();
      abrirCheckin(b.dataset.diaCheckin);
    }));
  }

  async function salvarCheckin(tipo, status, referenciaId = null, observacao = '', valor = null) {
    const data = isoLocal();
    let query = R.client.from('ritmo_checkins')
      .select('id')
      .eq('usuario_id', R.usuario.id)
      .eq('data', data)
      .eq('tipo', tipo);

    query = referenciaId ? query.eq('referencia_id', referenciaId) : query.is('referencia_id', null);
    const { data: existente } = await query.maybeSingle();

    const payload = {
      usuario_id: R.usuario.id,
      data,
      tipo,
      referencia_id: referenciaId,
      status,
      observacao: observacao || null,
      valor,
      registrado_em: new Date().toISOString(),
    };

    if (existente?.id) {
      const { error } = await R.client.from('ritmo_checkins').update(payload).eq('id', existente.id);
      if (error) throw error;
    } else {
      const { error } = await R.client.from('ritmo_checkins').insert(payload);
      if (error) throw error;
    }
  }

  async function alterarAgua(delta) {
    const atual = Number(checkin('agua')?.valor || 0);
    const novo = Math.max(0, atual + delta);
    const meta = Number(R.perfil?.meta_agua_ml || 2000);
    await salvarCheckin('agua', novo >= meta ? 'conforme' : 'ajustes', null, '', novo);
    await carregarTudo();
  }

  function abrirCardapioCasa() {
    window.trocarAba?.('casa');
    requestAnimationFrame(() => window.trocarSub?.('cardapio'));
  }

  function abrirAtividadeAgenda(agendaId) {
    const agenda = R.agenda.find(a => a.id === agendaId);
    if (!agenda) return;
    const plano = R.planos.find(p => p.id === agenda.plano_id);
    abrirSessao(plano, agenda);
  }

  function abrirPlanoDetalhe(planoId) {
    const plano = R.planos.find(p => p.id === planoId);
    if (!plano) return;
    abrirSessao(plano, null, true);
  }

  async function abrirSessao(plano, agenda = null, somenteDetalhe = false) {
    if (!plano) return;
    const { data: ultimas } = await R.client
      .from('ritmo_sessoes')
      .select('id,data,ritmo_sessao_itens(nome,carga,repeticoes)')
      .eq('usuario_id', R.usuario.id)
      .eq('plano_id', plano.id)
      .order('data', { ascending: false })
      .limit(1);

    const ultima = ultimas?.[0] || null;
    const itens = plano.ritmo_plano_itens || [];

    abrirModal(`
      ${modalHead(plano.nome, `${rotuloTipo(plano.tipo)}${plano.local ? ' · ' + plano.local : ''}`)}
      ${plano.descricao ? `<div class="ritmo-note" style="margin-bottom:12px">${escapar(plano.descricao)}</div>` : ''}
      ${ultima ? `<div class="ritmo-alert">Última sessão: ${dataBr(ultima.data)}. Os valores anteriores aparecem como referência.</div>` : ''}
      ${itens.length ? itens.map(item => {
        const ant = ultima?.ritmo_sessao_itens?.find(x => x.nome === item.nome);
        return `<div class="ritmo-exercise" data-exercicio="${item.id}">
          <strong>${escapar(item.nome)}</strong>
          <div class="ritmo-exercise-meta">${item.series ? item.series + ' séries' : ''}${item.repeticoes ? ' · ' + escapar(item.repeticoes) : ''}${ant ? ' · última: ' + (ant.carga ? numero(ant.carga,1) + ' kg / ' : '') + escapar(ant.repeticoes || '') : ''}</div>
          ${!somenteDetalhe ? `<div class="ritmo-exercise-inputs">
            <div class="ritmo-field"><label>Carga</label><input data-carga type="number" min="0" step="0.5" placeholder="${ant?.carga ?? 'kg'}"></div>
            <div class="ritmo-field"><label>Repetições</label><input data-reps type="text" value="${escapar(item.repeticoes || '')}"></div>
          </div>` : ''}
        </div>`;
      }).join('') : `
        <div class="ritmo-form-grid">
          <div class="ritmo-field"><label>Duração (min)</label><input id="ritmoSessaoDuracao" type="number" min="0"></div>
          <div class="ritmo-field"><label>Distância (km)</label><input id="ritmoSessaoDistancia" type="number" min="0" step="0.1"></div>
        </div>
      `}
      ${somenteDetalhe
        ? `<div class="ritmo-actions"><button class="ritmo-btn secondary" id="ritmoEditarPlanoMeta">Editar atividade</button></div>`
        : `<div class="ritmo-actions"><button class="ritmo-btn" id="ritmoConcluirSessao">Concluir atividade</button></div>`
      }
    `);

    if (somenteDetalhe) {
      el('ritmoEditarPlanoMeta')?.addEventListener('click', () => {
        fecharModal();
        abrirNovaAtividade(plano);
      });
      return;
    }

    el('ritmoConcluirSessao')?.addEventListener('click', async () => {
      const botao = el('ritmoConcluirSessao');
      botao.disabled = true;
      try {
        const duracao = Number(el('ritmoSessaoDuracao')?.value || 0) || null;
        const distancia = Number(el('ritmoSessaoDistancia')?.value || 0) || null;
        const { data: sessao, error } = await R.client.from('ritmo_sessoes').insert({
          usuario_id: R.usuario.id,
          plano_id: plano.id,
          data: isoLocal(),
          duracao_min: duracao,
          distancia_km: distancia,
        }).select('id').single();
        if (error) throw error;

        const linhas = [...document.querySelectorAll('[data-exercicio]')].map((row, idx) => {
          const item = itens.find(i => i.id === row.dataset.exercicio);
          return {
            sessao_id: sessao.id,
            usuario_id: R.usuario.id,
            item_plano_id: item?.id || null,
            ordem: idx + 1,
            nome: item?.nome || 'Exercício',
            carga: Number(row.querySelector('[data-carga]')?.value || 0) || null,
            repeticoes: row.querySelector('[data-reps]')?.value?.trim() || item?.repeticoes || null,
            concluido: true,
          };
        });
        if (linhas.length) {
          const { error: e2 } = await R.client.from('ritmo_sessao_itens').insert(linhas);
          if (e2) throw e2;
        }

        if (agenda) await salvarCheckin('atividade', 'conforme', agenda.id);
        fecharModal();
        await carregarTudo();
      } catch (erro) {
        console.error(erro);
        botao.disabled = false;
        botao.textContent = 'Não foi possível salvar';
      }
    });
  }

  function abrirNovaAtividade(plano = null) {
    const agenda = plano ? R.agenda.find(a => a.plano_id === plano.id) : null;
    abrirModal(`
      ${modalHead(plano ? 'Editar atividade' : 'Nova atividade', 'Academia é só uma das possibilidades.')}
      <div class="ritmo-field"><label>Nome</label><input id="ritmoAtivNome" value="${escapar(plano?.nome || '')}" placeholder="Ex.: Pilates, Circo, Ultra A"></div>
      <div class="ritmo-form-grid" style="margin-top:9px">
        <div class="ritmo-field"><label>Tipo</label><select id="ritmoAtivTipo">
          ${['academia','corrida','pilates','circo','bicicleta','natacao','outro'].map(t => `<option value="${t}" ${plano?.tipo === t ? 'selected' : ''}>${rotuloTipo(t)}</option>`).join('')}
        </select></div>
        <div class="ritmo-field"><label>Local</label><input id="ritmoAtivLocal" value="${escapar(plano?.local || '')}" placeholder="Ex.: condomínio"></div>
      </div>
      <div class="ritmo-field" style="margin-top:9px"><label>Descrição</label><textarea id="ritmoAtivDesc">${escapar(plano?.descricao || '')}</textarea></div>
      <div class="ritmo-form-grid" style="margin-top:9px">
        <div class="ritmo-field"><label>Dia da semana</label><select id="ritmoAtivDia">
          <option value="">Sem dia fixo</option>
          ${[1,2,3,4,5,6,0].map(d => `<option value="${d}" ${agenda?.dia_semana === d ? 'selected' : ''}>${DIAS[d]}</option>`).join('')}
        </select></div>
        <div class="ritmo-field"><label>Horário (opcional)</label><input id="ritmoAtivHora" type="time" value="${agenda?.horario?.slice(0,5) || ''}"></div>
      </div>
      <div class="ritmo-actions"><button class="ritmo-btn" id="ritmoSalvarAtividade">Salvar</button></div>
    `);

    el('ritmoSalvarAtividade')?.addEventListener('click', async () => {
      const nome = el('ritmoAtivNome').value.trim();
      if (!nome) return;
      const payload = {
        usuario_id: R.usuario.id,
        nome,
        tipo: el('ritmoAtivTipo').value,
        local: el('ritmoAtivLocal').value.trim() || null,
        descricao: el('ritmoAtivDesc').value.trim() || null,
      };
      let planoId = plano?.id;
      if (planoId) {
        const { error } = await R.client.from('ritmo_planos_atividade').update(payload).eq('id', planoId);
        if (error) throw error;
      } else {
        const { data, error } = await R.client.from('ritmo_planos_atividade').insert(payload).select('id').single();
        if (error) throw error;
        planoId = data.id;
      }

      const diaStr = el('ritmoAtivDia').value;
      const hora = el('ritmoAtivHora').value || null;
      if (diaStr !== '') {
        const agendaPayload = {
          usuario_id: R.usuario.id,
          plano_id: planoId,
          dia_semana: Number(diaStr),
          horario: hora,
          titulo: nome,
          opcional: false,
          ativo: true,
        };
        if (agenda?.id) {
          const { error } = await R.client.from('ritmo_agenda').update(agendaPayload).eq('id', agenda.id);
          if (error) throw error;
        } else {
          const { error } = await R.client.from('ritmo_agenda').insert(agendaPayload);
          if (error) throw error;
        }
      }
      fecharModal();
      await carregarTudo();
    });
  }

  function abrirNovaMedida() {
    const ultima = R.medidas[0] || {};
    abrirModal(`
      ${modalHead('Registrar medidas', 'Use condições parecidas entre os registros.')}
      <div class="ritmo-form-grid">
        ${campoModal('ritmoMedData','Data','date',isoLocal())}
        ${campoModal('ritmoMedPeso','Peso (kg)','number','',ultima.peso_kg)}
        ${campoModal('ritmoMedCintura','Cintura (cm)','number','',ultima.cintura_cm)}
        ${campoModal('ritmoMedAbdomen','Abdômen (cm)','number','',ultima.abdomen_cm)}
        ${campoModal('ritmoMedQuadrilAlto','Quadril alto (cm)','number','',ultima.quadril_alto_cm)}
        ${campoModal('ritmoMedQuadril','Quadril (cm)','number','',ultima.quadril_max_cm)}
        ${campoModal('ritmoMedPeito','Peito (cm)','number','',ultima.peito_cm)}
        ${campoModal('ritmoMedCoxa','Coxa dir. (cm)','number','',ultima.coxa_d_cm)}
        ${campoModal('ritmoMedBraco','Braço dir. (cm)','number','',ultima.braco_d_cm)}
        ${campoModal('ritmoMedPanturrilha','Panturrilha dir. (cm)','number','',ultima.panturrilha_d_cm)}
      </div>
      <div class="ritmo-actions"><button class="ritmo-btn" id="ritmoSalvarMedida">Salvar registro</button></div>
    `);
    el('ritmoSalvarMedida')?.addEventListener('click', salvarMedida);
  }

  function campoModal(id, label, type, value = '', placeholder = '') {
    const step = type === 'number' ? 'step="0.1"' : '';
    return `<div class="ritmo-field"><label>${escapar(label)}</label><input id="${id}" type="${type}" ${step} value="${escapar(value)}" placeholder="${placeholder != null ? escapar(String(placeholder)) : ''}"></div>`;
  }

  async function salvarMedida() {
    const payload = {
      usuario_id: R.usuario.id,
      data: el('ritmoMedData').value || isoLocal(),
      peso_kg: numOuNull(el('ritmoMedPeso').value),
      cintura_cm: numOuNull(el('ritmoMedCintura').value),
      abdomen_cm: numOuNull(el('ritmoMedAbdomen').value),
      quadril_alto_cm: numOuNull(el('ritmoMedQuadrilAlto').value),
      quadril_max_cm: numOuNull(el('ritmoMedQuadril').value),
      peito_cm: numOuNull(el('ritmoMedPeito').value),
      coxa_d_cm: numOuNull(el('ritmoMedCoxa').value),
      braco_d_cm: numOuNull(el('ritmoMedBraco').value),
      panturrilha_d_cm: numOuNull(el('ritmoMedPanturrilha').value),
    };
    const { error } = await R.client.from('ritmo_medidas').upsert(payload, { onConflict: 'usuario_id,data' });
    if (error) throw error;
    fecharModal();
    await carregarTudo();
  }

  function numOuNull(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function abrirEditarMetas() {
    abrirModal(`
      ${modalHead('Metas do ciclo', 'Nem toda medida precisa ter um número-alvo.')}
      ${R.metas.map(m => `
        <div class="ritmo-form-grid" data-meta-id="${m.id}" style="margin-bottom:10px">
          <div class="ritmo-field"><label>${escapar(rotuloIndicador(m.indicador))}</label><select data-meta-estrategia>
            ${['reduzir','aumentar','manter','acompanhar'].map(e => `<option value="${e}" ${m.estrategia === e ? 'selected' : ''}>${rotuloEstrategia(e)}</option>`).join('')}
          </select></div>
          <div class="ritmo-field"><label>Meta (${escapar(m.unidade)})</label><input data-meta-valor type="number" step="0.1" value="${m.valor_meta ?? ''}" placeholder="Opcional"></div>
        </div>
      `).join('')}
      <div class="ritmo-actions"><button class="ritmo-btn" id="ritmoSalvarMetas">Salvar metas</button></div>
    `);
    el('ritmoSalvarMetas')?.addEventListener('click', async () => {
      for (const row of document.querySelectorAll('[data-meta-id]')) {
        const { error } = await R.client.from('ritmo_metas').update({
          estrategia: row.querySelector('[data-meta-estrategia]').value,
          valor_meta: numOuNull(row.querySelector('[data-meta-valor]').value),
          atualizado_em: new Date().toISOString(),
        }).eq('id', row.dataset.metaId);
        if (error) throw error;
      }
      fecharModal();
      await carregarTudo();
    });
  }

  async function salvarPerfil() {
    const payload = {
      usuario_id: R.usuario.id,
      altura_cm: numOuNull(el('ritmoAltura').value),
      meta_calorias: numOuNull(el('ritmoCalorias').value),
      meta_proteina_g: numOuNull(el('ritmoProteina').value),
      meta_agua_ml: numOuNull(el('ritmoAguaMeta').value),
      foto_intervalo_dias: numOuNull(el('ritmoFotoIntervalo').value) || 15,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await R.client.from('ritmo_perfis').upsert(payload, { onConflict: 'usuario_id' });
    if (error) throw error;
    await carregarTudo();
  }

  let fotoPosicaoAtual = null;

  function iniciarFoto(posicao) {
    fotoPosicaoAtual = posicao;
    el('ritmoFotoInput')?.click();
  }

  async function enviarFoto(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || !fotoPosicaoAtual) return;
    const { data: sessao } = await R.client.auth.getSession();
    const authId = sessao?.session?.user?.id;
    if (!authId) return;

    const extOriginal = arquivo.name.split('.').pop()?.toLowerCase();
    const ext = ['jpg','jpeg','png','webp'].includes(extOriginal) ? extOriginal : 'jpg';
    const path = `${authId}/${isoLocal()}/${fotoPosicaoAtual}.${ext}`;

    const { error: uploadError } = await R.client.storage.from('ritmo-fotos').upload(path, arquivo, {
      upsert: true,
      contentType: arquivo.type || 'image/jpeg',
    });
    if (uploadError) throw uploadError;

    const { error } = await R.client.from('ritmo_fotos').upsert({
      usuario_id: R.usuario.id,
      data: isoLocal(),
      posicao: fotoPosicaoAtual,
      storage_path: path,
    }, { onConflict: 'usuario_id,data,posicao' });
    if (error) throw error;

    fotoPosicaoAtual = null;
    e.target.value = '';
    await carregarTudo();
  }

  async function importarPdf(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const status = el('ritmoPdfStatus');
    if (status) status.textContent = 'Lendo o PDF e organizando o plano...';

    try {
      const { data } = await R.client.auth.getSession();
      const token = data?.session?.access_token;
      const resposta = await fetch('/api/ritmo/importar-plano', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/pdf',
          'X-LifeOS-Arquivo': encodeURIComponent(arquivo.name),
        },
        body: arquivo,
      });
      const json = await resposta.json();
      if (!resposta.ok || !json.ok) throw new Error(json.erro || 'Não foi possível importar.');
      if (status) status.textContent = 'Plano importado. Revise as opções abaixo.';
      await carregarTudo();
    } catch (erro) {
      if (status) status.textContent = erro.message || 'Falha ao importar.';
    } finally {
      e.target.value = '';
    }
  }

  function abrirEditorPlanoAlimentar(id) {
    const plano = R.planosAlimentares.find(p => p.id === id);
    if (!plano) return;
    const refs = plano.conteudo?.refeicoes || [];
    abrirModal(`
      ${modalHead('Editar plano alimentar', plano.nome)}
      <div id="ritmoEditorRefeicoes">
        ${refs.map((ref, i) => editorRefeicao(ref, i)).join('')}
      </div>
      <div class="ritmo-actions">
        <button class="ritmo-btn secondary" id="ritmoAddRefeicaoPlano">+ Refeição</button>
        <button class="ritmo-btn" id="ritmoSalvarPlanoAlimentar">Salvar alterações</button>
      </div>
      <div class="ritmo-note">Uma opção por linha. Dentro da opção, separe os itens com ponto e vírgula.</div>
    `);

    el('ritmoAddRefeicaoPlano')?.addEventListener('click', () => {
      const box = el('ritmoEditorRefeicoes');
      const i = box.querySelectorAll('[data-editor-ref]').length;
      box.insertAdjacentHTML('beforeend', editorRefeicao({ nome: '', horario: '', opcoes: [] }, i));
    });

    el('ritmoSalvarPlanoAlimentar')?.addEventListener('click', async () => {
      const refeicoes = [...document.querySelectorAll('[data-editor-ref]')].map(row => {
        const nome = row.querySelector('[data-ref-nome]').value.trim();
        const horario = row.querySelector('[data-ref-hora]').value || null;
        const linhas = row.querySelector('[data-ref-opcoes]').value.split('\n').map(x => x.trim()).filter(Boolean);
        const opcoes = linhas.map((linha, idx) => {
          const partes = linha.split(':');
          const temTitulo = partes.length > 1;
          const titulo = temTitulo ? partes.shift().trim() : `Opção ${idx + 1}`;
          const corpo = partes.join(':').trim() || linha;
          return {
            titulo,
            itens: corpo.split(';').map(x => x.trim()).filter(Boolean),
          };
        });
        return { nome, horario, opcoes };
      }).filter(r => r.nome);

      const conteudo = { ...(plano.conteudo || {}), refeicoes, status: 'revisado' };
      const { error } = await R.client.from('ritmo_planos_alimentares').update({
        conteudo,
        atualizado_em: new Date().toISOString(),
      }).eq('id', plano.id);
      if (error) throw error;
      fecharModal();
      await carregarTudo();
    });
  }

  function editorRefeicao(ref, i) {
    const linhas = (ref.opcoes || []).map((op, idx) => {
      const titulo = op.titulo || `Opção ${idx + 1}`;
      return `${titulo}: ${(op.itens || []).join('; ')}`;
    }).join('\n');
    return `<div class="ritmo-card" data-editor-ref style="margin-bottom:9px">
      <div class="ritmo-form-grid">
        <div class="ritmo-field"><label>Refeição</label><input data-ref-nome value="${escapar(ref.nome || '')}" placeholder="Ex.: Café da manhã"></div>
        <div class="ritmo-field"><label>Horário</label><input data-ref-hora type="time" value="${escapar(ref.horario || '')}"></div>
      </div>
      <div class="ritmo-field" style="margin-top:9px"><label>Opções</label><textarea data-ref-opcoes placeholder="Opção 1: alimento; alimento">${escapar(linhas)}</textarea></div>
    </div>`;
  }

  window.addEventListener('lifeos:ready', () => {
    contexto();
  });

  window.addEventListener('lifeos:ritmo-abrir', () => {
    R.aba = 'hoje';
    carregarTudo();
  });
})();
