/* Minhas Finanças - front-end (vanilla JS, no build step).
 * Money is stored as integer cents to avoid floating point errors.
 * Runs straight from the file (double-click index.html), no server needed.
 * Data lives in the browser's localStorage; JSON backups protect it.
 */
'use strict';

const LS_KEY = 'minhas-financas:dados';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents) => fmtBRL.format((cents || 0) / 100);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const hoje = () => isoDate(new Date());
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtData(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function nomeMes(ym) {
  const [y, m] = ym.split('-').map(Number);
  const t = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function somaMeses(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
/** Same day N months later, clamped to the month's last day (31/01 + 1 -> 28/02). */
function somaMesesData(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(y, m - 1 + n + 1, 0).getDate();
  return isoDate(new Date(y, m - 1 + n, Math.min(d, ultimo)));
}
/** Accepts "1.234,56", "1234,56", "1234.56", "R$ 10" -> cents (integer) or NaN. */
function parseValor(txt) {
  let s = String(txt).replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
const valorInput = (cents) => cents ? (cents / 100).toFixed(2).replace('.', ',') : '';

// ---------------------------------------------------------------- data

function dadosIniciais() {
  return {
    versao: 1,
    contas: [
      { id: 'carteira', nome: 'Carteira', saldoInicial: 0, cor: '#16a34a' },
      { id: 'banco', nome: 'Conta do banco', saldoInicial: 0, cor: '#2563eb' },
    ],
    categorias: [
      ['Moradia', 'despesa', '#6366f1'], ['Mercado', 'despesa', '#16a34a'], ['Alimentação fora', 'despesa', '#f97316'],
      ['Transporte', 'despesa', '#0ea5e9'], ['Saúde', 'despesa', '#ef4444'], ['Educação', 'despesa', '#8b5cf6'],
      ['Lazer', 'despesa', '#ec4899'], ['Contas e serviços', 'despesa', '#eab308'], ['Compras', 'despesa', '#14b8a6'],
      ['Assinaturas', 'despesa', '#a855f7'], ['Impostos e taxas', 'despesa', '#64748b'], ['Outros gastos', 'despesa', '#94a3b8'],
      ['Salário', 'receita', '#22c55e'], ['Trabalhos extras', 'receita', '#10b981'], ['Rendimentos', 'receita', '#06b6d4'],
      ['Outras receitas', 'receita', '#84cc16'],
    ].map(([nome, tipo, cor]) => ({ id: uid(), nome, tipo, cor, orcamento: null })),
    lancamentos: [],
    metas: [],
    config: { tema: 'auto' },
  };
}

const estado = {
  dados: null,
  mes: hoje().slice(0, 7),
};

function carregar() {
  estado.dados = lerLocal() || dadosIniciais();
  normalizar(estado.dados);
}
function lerLocal() {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function normalizar(d) {
  d.contas ??= []; d.categorias ??= []; d.lancamentos ??= []; d.metas ??= []; d.config ??= { tema: 'auto' };
}

let timerSalvar = null;
function salvar() {
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(salvarAgora, 300);
}
function salvarAgora() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(estado.dados)); } catch { aviso('⚠ Não consegui salvar os dados!'); }
}

let timerAviso = null;
function aviso(msg) {
  const el = $('#status');
  el.textContent = msg; el.classList.add('visivel');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('visivel'), 3200);
}

// ---------------------------------------------------------------- lookups / math

const cat = (id) => estado.dados.categorias.find((c) => c.id === id);
const conta = (id) => estado.dados.contas.find((c) => c.id === id);
const doMes = (ym) => estado.dados.lancamentos.filter((l) => l.data.startsWith(ym));

function totaisMes(ym) {
  let receitas = 0, despesas = 0;
  for (const l of doMes(ym)) {
    if (l.tipo === 'receita') receitas += l.valor;
    else if (l.tipo === 'despesa') despesas += l.valor;
  }
  return { receitas, despesas, resultado: receitas - despesas };
}
/** Account balance counting only paid entries. */
function saldoConta(id) {
  let s = conta(id)?.saldoInicial || 0;
  for (const l of estado.dados.lancamentos) {
    if (!l.pago) continue;
    if (l.tipo === 'receita' && l.contaId === id) s += l.valor;
    if (l.tipo === 'despesa' && l.contaId === id) s -= l.valor;
    if (l.tipo === 'transferencia') {
      if (l.contaId === id) s -= l.valor;
      if (l.contaDestinoId === id) s += l.valor;
    }
  }
  return s;
}
function gastoPorCategoria(ym) {
  const m = new Map();
  for (const l of doMes(ym)) if (l.tipo === 'despesa') m.set(l.categoriaId, (m.get(l.categoriaId) || 0) + l.valor);
  return m;
}
const ordenarData = (a, b) => b.data.localeCompare(a.data) || (b.criadoEm || 0) - (a.criadoEm || 0);

// ---------------------------------------------------------------- render

const graficos = {};
function render() {
  $('#mesAtual').textContent = nomeMes(estado.mes);
  renderPainel(); renderLancamentos(); renderOrcamento(); renderMetas(); renderConfig();
}

function linhaLancamento(l, compacta = false) {
  const c = cat(l.categoriaId);
  const sinal = l.tipo === 'receita' ? '+' : l.tipo === 'despesa' ? '−' : '';
  const classe = l.tipo === 'receita' ? 'pos' : l.tipo === 'despesa' ? 'neg' : '';
  const catHtml = l.tipo === 'transferencia'
    ? `<span class="chip">⇄ Transferência</span>`
    : `<span class="chip"><span class="ponto" style="background:${esc(c?.cor || '#999')}"></span>${esc(c?.nome || 'Sem categoria')}</span>`;
  const contaTxt = l.tipo === 'transferencia'
    ? `${esc(conta(l.contaId)?.nome || '?')} → ${esc(conta(l.contaDestinoId)?.nome || '?')}`
    : esc(conta(l.contaId)?.nome || '');
  return `<tr class="clicavel ${l.pago ? '' : 'pendente'}" data-id="${l.id}">
    <td>${fmtData(l.data)}</td>
    <td>${esc(l.descricao)}${l.pago ? '' : ' <small>(pendente)</small>'}</td>
    <td>${catHtml}</td>
    ${compacta ? '' : `<td class="esconder-celular">${contaTxt}</td>`}
    <td class="valor ${classe}">${sinal} ${money(l.valor)}</td>
  </tr>`;
}
function tabela(lista, compacta) {
  if (!lista.length) return '<p class="vazio">Nenhum lançamento.</p>';
  return `<div class="rolagem"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th>${compacta ? '' : '<th class="esconder-celular">Conta</th>'}<th class="valor">Valor</th></tr></thead>
    <tbody>${lista.map((l) => linhaLancamento(l, compacta)).join('')}</tbody></table></div>`;
}

function renderPainel() {
  const t = totaisMes(estado.mes);
  $('#kpiReceitas').textContent = money(t.receitas);
  $('#kpiDespesas').textContent = money(t.despesas);
  const r = $('#kpiResultado');
  r.textContent = money(t.resultado); r.className = t.resultado >= 0 ? 'pos' : 'neg';
  const saldoTotal = estado.dados.contas.reduce((s, c) => s + saldoConta(c.id), 0);
  const k = $('#kpiSaldo'); k.textContent = money(saldoTotal); k.className = saldoTotal >= 0 ? '' : 'neg';

  $('#listaContas').innerHTML = estado.dados.contas.map((c) => {
    const s = saldoConta(c.id);
    return `<li><span><span class="ponto" style="background:${esc(c.cor)}"></span> ${esc(c.nome)}</span><strong class="${s < 0 ? 'neg' : ''}">${money(s)}</strong></li>`;
  }).join('') || '<li class="vazio">Cadastre suas contas em Ajustes.</li>';

  // Budget summary
  const gastos = gastoPorCategoria(estado.mes);
  const comLimite = estado.dados.categorias.filter((c) => c.tipo === 'despesa' && c.orcamento);
  $('#resumoOrcamento').innerHTML = comLimite.length
    ? comLimite.map((c) => barraOrcamento(c, gastos.get(c.id) || 0)).join('')
    : '<p class="vazio">Nenhum limite definido. Vá em <button class="link" data-ir="orcamento">Orçamento</button>.</p>';

  $('#ultimos').innerHTML = tabela([...doMes(estado.mes)].sort(ordenarData).slice(0, 8), true);

  // Charts
  const cor = getComputedStyle(document.documentElement);
  const corTexto = cor.getPropertyValue('--suave').trim();
  const corBorda = cor.getPropertyValue('--borda').trim();
  Chart.defaults.color = corTexto;
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  const itens = [...gastos.entries()].sort((a, b) => b[1] - a[1]);
  $('#semDespesas').classList.toggle('oculto', itens.length > 0);
  graficos.cat?.destroy();
  graficos.cat = new Chart($('#grafCategorias'), {
    type: 'doughnut',
    data: {
      labels: itens.map(([id]) => cat(id)?.nome || 'Sem categoria'),
      datasets: [{ data: itens.map(([, v]) => v / 100), backgroundColor: itens.map(([id]) => cat(id)?.cor || '#999'), borderColor: cor.getPropertyValue('--superficie').trim(), borderWidth: 2 }],
    },
    options: {
      maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10 } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtBRL.format(c.raw)}` } },
      },
    },
  });

  const meses = Array.from({ length: 6 }, (_, i) => somaMeses(estado.mes, i - 5));
  const tot = meses.map(totaisMes);
  graficos.meses?.destroy();
  graficos.meses = new Chart($('#grafMeses'), {
    type: 'bar',
    data: {
      labels: meses.map((m) => new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short' })),
      datasets: [
        { label: 'Receitas', data: tot.map((t) => t.receitas / 100), backgroundColor: cor.getPropertyValue('--pos').trim(), borderRadius: 4 },
        { label: 'Despesas', data: tot.map((t) => t.despesas / 100), backgroundColor: cor.getPropertyValue('--neg').trim(), borderRadius: 4 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: corBorda }, ticks: { callback: (v) => fmtBRL.format(v).replace(',00', '') } },
      },
      plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtBRL.format(c.raw)}` } } },
    },
  });
}

function barraOrcamento(c, gasto) {
  const pct = Math.round((gasto / c.orcamento) * 100);
  const classe = pct > 100 ? 'estourou' : pct >= 80 ? 'alerta' : '';
  const resto = c.orcamento - gasto;
  return `<div class="linha-orc">
    <div class="topo-linha"><span><span class="ponto" style="background:${esc(c.cor)}"></span> ${esc(c.nome)}</span>
    <span>${money(gasto)} de ${money(c.orcamento)} · <span class="${resto < 0 ? 'neg' : ''}">${resto < 0 ? 'passou ' + money(-resto) : 'sobra ' + money(resto)}</span></span></div>
    <div class="progresso ${classe}"><span style="width:${Math.min(pct, 100)}%"></span></div></div>`;
}

function renderLancamentos() {
  // Filters
  const fc = $('#filtroCategoria'), fco = $('#filtroConta');
  const vc = fc.value, vco = fco.value;
  fc.innerHTML = '<option value="">Todas as categorias</option>' + estado.dados.categorias.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  fco.innerHTML = '<option value="">Todas as contas</option>' + estado.dados.contas.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  fc.value = vc; fco.value = vco;

  const busca = $('#busca').value.trim().toLowerCase();
  const tipo = $('#filtroTipo').value;
  const lista = doMes(estado.mes).filter((l) =>
    (!busca || l.descricao.toLowerCase().includes(busca)) &&
    (!tipo || l.tipo === tipo) &&
    (!fc.value || l.categoriaId === fc.value) &&
    (!fco.value || l.contaId === fco.value || l.contaDestinoId === fco.value),
  ).sort(ordenarData);
  $('#tabelaLancamentos').innerHTML = tabela(lista, false);
  const rec = lista.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
  const desp = lista.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
  $('#totalFiltro').innerHTML = lista.length
    ? `${lista.length} lançamento(s) · Receitas <span class="pos">${money(rec)}</span> · Despesas <span class="neg">${money(desp)}</span>`
    : '';
}

function renderOrcamento() {
  const gastos = gastoPorCategoria(estado.mes);
  const cats = estado.dados.categorias.filter((c) => c.tipo === 'despesa');
  const totalLim = cats.reduce((s, c) => s + (c.orcamento || 0), 0);
  const totalGasto = cats.reduce((s, c) => s + (gastos.get(c.id) || 0), 0);
  $('#tabelaOrcamento').innerHTML = `<div class="rolagem"><table><thead><tr><th>Categoria</th><th class="valor">Limite por mês</th><th class="valor">Gasto em ${esc(nomeMes(estado.mes))}</th><th class="esconder-celular" style="width:30%">Uso</th></tr></thead><tbody>
    ${cats.map((c) => {
      const g = gastos.get(c.id) || 0;
      const pct = c.orcamento ? Math.round((g / c.orcamento) * 100) : 0;
      const classe = pct > 100 ? 'estourou' : pct >= 80 ? 'alerta' : '';
      return `<tr><td><span class="ponto" style="background:${esc(c.cor)}"></span> ${esc(c.nome)}</td>
        <td class="valor"><input type="text" inputmode="decimal" placeholder="sem limite" data-orc="${c.id}" value="${valorInput(c.orcamento)}" style="width:120px;text-align:right"></td>
        <td class="valor ${c.orcamento && g > c.orcamento ? 'neg' : ''}">${money(g)}</td>
        <td class="esconder-celular">${c.orcamento ? `<div class="progresso ${classe}"><span style="width:${Math.min(pct, 100)}%"></span></div><small>${pct}%</small>` : ''}</td></tr>`;
    }).join('')}
    <tr><th>Total</th><th class="valor">${money(totalLim)}</th><th class="valor">${money(totalGasto)}</th><th class="esconder-celular"></th></tr>
    </tbody></table></div>`;
}

function renderMetas() {
  const metas = estado.dados.metas;
  $('#listaMetas').innerHTML = metas.length ? metas.map((m) => {
    const pct = m.alvo ? Math.min(100, Math.round((m.guardado / m.alvo) * 100)) : 0;
    let prazo = '';
    if (m.prazo) {
      const [y, mo] = m.prazo.split('-').map(Number);
      const [hy, hm] = hoje().split('-').map(Number);
      const mesesRest = (y - hy) * 12 + (mo - hm);
      const falta = Math.max(0, m.alvo - m.guardado);
      prazo = mesesRest > 0 && falta > 0
        ? `Até ${fmtData(m.prazo)} · guarde ${money(Math.ceil(falta / mesesRest))} por mês`
        : `Prazo: ${fmtData(m.prazo)}`;
    }
    return `<div class="bloco meta">
      <h3>${esc(m.nome)}</h3>
      <div class="numeros"><span>${money(m.guardado)}</span><span class="dica" style="margin:0">de ${money(m.alvo)}</span></div>
      <div class="progresso"><span style="width:${pct}%"></span></div>
      <p class="dica" style="margin-top:8px">${pct}% ${pct >= 100 ? '🎉 Meta alcançada!' : ''}${prazo ? ' · ' + prazo : ''}</p>
      <div class="botoes"><button class="btn" data-meta-add="${m.id}">+ Guardar</button><button class="btn" data-meta-tirar="${m.id}">− Retirar</button><button class="link" data-meta-editar="${m.id}">Editar</button></div>
    </div>`;
  }).join('') : '<p class="vazio">Crie uma meta, como "Reserva de emergência" ou "Viagem".</p>';
}

function renderConfig() {
  $('#tema').value = estado.dados.config.tema || 'auto';
  const ult = estado.dados.config.ultimoBackup;
  $('#infoArmazenamento').innerHTML = 'Seus dados ficam guardados neste navegador, no seu computador. Se limpar os dados de navegação ou trocar de navegador, eles somem: baixe um backup de vez em quando e guarde numa pasta segura.' +
    `<br><strong>Último backup:</strong> ${ult ? fmtData(ult) : 'nunca'}`;

  $('#cfgContas').innerHTML = estado.dados.contas.map((c) => `<div class="cfg-linha" data-conta="${c.id}">
      <input type="color" value="${esc(c.cor)}" data-campo="cor" title="Cor">
      <input type="text" value="${esc(c.nome)}" data-campo="nome" aria-label="Nome da conta">
      <input type="text" inputmode="decimal" value="${valorInput(c.saldoInicial)}" placeholder="saldo inicial" data-campo="saldoInicial" title="Saldo inicial" style="width:130px">
      <button class="icone" data-remover-conta="${c.id}" title="Remover">×</button></div>`).join('');

  const grupo = (tipo, titulo) => `<p class="dica" style="margin:8px 0 6px"><strong>${titulo}</strong></p>` +
    estado.dados.categorias.filter((c) => c.tipo === tipo).map((c) => `<div class="cfg-linha" data-cat="${c.id}">
      <input type="color" value="${esc(c.cor)}" data-campo="cor" title="Cor">
      <input type="text" value="${esc(c.nome)}" data-campo="nome" aria-label="Nome da categoria">
      <button class="icone" data-remover-cat="${c.id}" title="Remover">×</button></div>`).join('');
  $('#cfgCategorias').innerHTML = grupo('despesa', 'Despesas') + grupo('receita', 'Receitas');
}

function aplicarTema() {
  const t = estado.dados.config.tema;
  if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t;
  else delete document.documentElement.dataset.tema;
}

// ---------------------------------------------------------------- modal / forms

const modal = $('#modal');
let aoSalvar = null, aoExcluir = null;
function abrirModal(titulo, html, salvarFn, excluirFn) {
  $('#tituloModal').textContent = titulo;
  $('#corpoModal').innerHTML = html;
  aoSalvar = salvarFn; aoExcluir = excluirFn;
  $('#btnExcluir').classList.toggle('oculto', !excluirFn);
  modal.showModal();
  $('#corpoModal input:not([type=hidden]), #corpoModal select')?.focus();
}
$('#btnCancelar').onclick = () => modal.close();
$('#btnExcluir').onclick = () => { if (aoExcluir && aoExcluir() !== false) { modal.close(); salvar(); render(); } };
$('#formModal').addEventListener('submit', (e) => {
  e.preventDefault();
  if (aoSalvar && aoSalvar(new FormData(e.target)) !== false) { modal.close(); salvar(); render(); }
});

const opcoes = (lista, sel) => lista.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');

function formLancamento(tipo, l = null) {
  const editar = !!l;
  l ??= {
    tipo, descricao: '', valor: 0, contaId: estado.dados.contas[0]?.id, pago: true,
    data: estado.mes === hoje().slice(0, 7) ? hoje() : `${estado.mes}-01`,
  };
  tipo = l.tipo;
  if (!estado.dados.contas.length) { aviso('Cadastre uma conta em Ajustes primeiro.'); return; }
  const cats = estado.dados.categorias.filter((c) => c.tipo === tipo);
  const titulo = { despesa: 'Despesa', receita: 'Receita', transferencia: 'Transferência entre contas' }[tipo];
  const html = `
    <div class="campo"><label>Descrição</label><input name="descricao" required maxlength="120" value="${esc(l.descricao)}" placeholder="${tipo === 'despesa' ? 'Ex.: Supermercado' : tipo === 'receita' ? 'Ex.: Salário' : 'Ex.: Saque'}"></div>
    <div class="campo-linha">
      <div class="campo"><label>Valor (R$)</label><input name="valor" required inputmode="decimal" placeholder="0,00" value="${valorInput(l.valor)}"></div>
      <div class="campo"><label>Data</label><input type="date" name="data" required value="${l.data}"></div>
    </div>
    ${tipo === 'transferencia' ? `
      <div class="campo-linha">
        <div class="campo"><label>De</label><select name="contaId">${opcoes(estado.dados.contas, l.contaId)}</select></div>
        <div class="campo"><label>Para</label><select name="contaDestinoId">${opcoes(estado.dados.contas, l.contaDestinoId || estado.dados.contas[1]?.id)}</select></div>
      </div>` : `
      <div class="campo-linha">
        <div class="campo"><label>Categoria</label><select name="categoriaId">${opcoes(cats, l.categoriaId)}</select></div>
        <div class="campo"><label>Conta</label><select name="contaId">${opcoes(estado.dados.contas, l.contaId)}</select></div>
      </div>`}
    <label class="check"><input type="checkbox" name="pago" ${l.pago ? 'checked' : ''}> ${tipo === 'receita' ? 'Já recebi' : 'Já paguei'}</label>
    ${editar ? (l.grupo ? '<label class="check"><input type="checkbox" name="aplicarGrupo"> Aplicar também às próximas repetições</label>' : '') : `
    <div class="campo-linha">
      <div class="campo"><label>Repetir</label><select name="repetir">
        <option value="nao">Não repete</option>
        <option value="mensal">Todo mês (mesmo valor)</option>
        ${tipo === 'despesa' ? '<option value="parcelado">Parcelado (divide o valor)</option>' : ''}
      </select></div>
      <div class="campo"><label>Quantas vezes</label><input type="number" name="vezes" min="2" max="120" value="12"></div>
    </div>`}
    <div class="campo"><label>Observação (opcional)</label><input name="obs" maxlength="300" value="${esc(l.obs || '')}"></div>`;

  abrirModal(editar ? `Editar ${titulo.toLowerCase()}` : `Nova ${titulo.toLowerCase()}`, html, (f) => {
    const valor = parseValor(f.get('valor'));
    if (!(valor > 0)) { aviso('Digite um valor maior que zero.'); return false; }
    if (tipo === 'transferencia' && f.get('contaId') === f.get('contaDestinoId')) { aviso('Escolha contas diferentes.'); return false; }
    const base = {
      tipo, descricao: f.get('descricao').trim(), valor, data: f.get('data'),
      contaId: f.get('contaId'), pago: f.get('pago') === 'on', obs: f.get('obs').trim(),
      ...(tipo === 'transferencia' ? { contaDestinoId: f.get('contaDestinoId') } : { categoriaId: f.get('categoriaId') }),
    };
    if (editar) {
      if (f.get('aplicarGrupo') === 'on') {
        // Same changes for this and later entries in the series (keeps each one's date).
        for (const x of estado.dados.lancamentos) {
          if (x.grupo === l.grupo && x.data >= l.data) {
            Object.assign(x, { ...base, data: x.id === l.id ? base.data : x.data, descricao: x.id === l.id ? base.descricao : x.descricao, pago: x.id === l.id ? base.pago : x.pago });
          }
        }
      } else Object.assign(l, base);
      aviso('Lançamento atualizado.');
      return;
    }
    const repetir = f.get('repetir'), vezes = Math.min(120, Math.max(2, Number(f.get('vezes')) || 2));
    if (repetir === 'nao') {
      estado.dados.lancamentos.push({ id: uid(), criadoEm: Date.now(), ...base });
    } else {
      const grupo = uid();
      const parcela = Math.floor(valor / vezes), sobra = valor - parcela * vezes;
      for (let i = 0; i < vezes; i++) {
        const data = somaMesesData(base.data, i);
        estado.dados.lancamentos.push({
          ...base, id: uid(), criadoEm: Date.now(), grupo, data,
          valor: repetir === 'parcelado' ? parcela + (i === 0 ? sobra : 0) : valor,
          descricao: repetir === 'parcelado' ? `${base.descricao} (${i + 1}/${vezes})` : base.descricao,
          pago: i === 0 ? base.pago : data <= hoje() && base.pago,
        });
      }
    }
    aviso('Lançamento salvo.');
  }, editar ? () => {
    let todos = false;
    if (l.grupo) todos = confirm('Este lançamento faz parte de uma repetição.\n\nOK = excluir este e os próximos\nCancelar = excluir só este');
    else if (!confirm('Excluir este lançamento?')) return false;
    estado.dados.lancamentos = estado.dados.lancamentos.filter((x) => !(x.id === l.id || (todos && x.grupo === l.grupo && x.data >= l.data)));
    aviso('Lançamento excluído.');
  } : null);
}

function formMeta(m = null) {
  const editar = !!m;
  m ??= { nome: '', alvo: 0, guardado: 0, prazo: '' };
  abrirModal(editar ? 'Editar meta' : 'Nova meta', `
    <div class="campo"><label>Nome</label><input name="nome" required maxlength="80" value="${esc(m.nome)}" placeholder="Ex.: Reserva de emergência"></div>
    <div class="campo-linha">
      <div class="campo"><label>Valor da meta (R$)</label><input name="alvo" required inputmode="decimal" value="${valorInput(m.alvo)}"></div>
      <div class="campo"><label>Já guardado (R$)</label><input name="guardado" inputmode="decimal" value="${valorInput(m.guardado)}"></div>
    </div>
    <div class="campo"><label>Prazo (opcional)</label><input type="date" name="prazo" value="${m.prazo || ''}"></div>`,
  (f) => {
    const alvo = parseValor(f.get('alvo')), guardado = parseValor(f.get('guardado') || '0');
    if (!(alvo > 0) || Number.isNaN(guardado)) { aviso('Confira os valores.'); return false; }
    Object.assign(m, { nome: f.get('nome').trim(), alvo, guardado, prazo: f.get('prazo') });
    if (!editar) estado.dados.metas.push({ id: uid(), ...m });
  }, editar ? () => {
    if (!confirm('Excluir esta meta?')) return false;
    estado.dados.metas = estado.dados.metas.filter((x) => x.id !== m.id);
  } : null);
}

function formMovimentoMeta(m, sinal) {
  abrirModal(sinal > 0 ? `Guardar em "${m.nome}"` : `Retirar de "${m.nome}"`,
    `<div class="campo"><label>Valor (R$)</label><input name="valor" required inputmode="decimal" placeholder="0,00"></div>`,
    (f) => {
      const v = parseValor(f.get('valor'));
      if (!(v > 0)) { aviso('Digite um valor maior que zero.'); return false; }
      m.guardado = Math.max(0, m.guardado + sinal * v);
    });
}

// ---------------------------------------------------------------- CSV

function exportarCsv() {
  const linhas = [['data', 'tipo', 'descricao', 'valor', 'categoria', 'conta', 'conta_destino', 'pago', 'observacao']];
  for (const l of [...estado.dados.lancamentos].sort((a, b) => a.data.localeCompare(b.data))) {
    const v = (l.tipo === 'despesa' ? -l.valor : l.valor) / 100;
    linhas.push([fmtData(l.data), l.tipo, l.descricao, v.toFixed(2).replace('.', ','), cat(l.categoriaId)?.nome || '',
      conta(l.contaId)?.nome || '', conta(l.contaDestinoId)?.nome || '', l.pago ? 'sim' : 'não', l.obs || '']);
  }
  const csv = linhas.map((r) => r.map((c) => /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\r\n');
  baixar(`financas-${hoje()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
}

function lerCsv(texto) {
  const linhas = []; let campo = '', linha = [], aspas = false;
  const sep = (texto.split('\n')[0].match(/;/g) || []).length >= (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (ch !== '\r') campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

function importarCsv(texto) {
  const linhas = lerCsv(texto.replace(/^﻿/, ''));
  if (linhas.length < 2) { aviso('Arquivo CSV vazio.'); return; }
  const cab = linhas[0].map((c) => c.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const col = (...nomes) => cab.findIndex((c) => nomes.includes(c));
  const iData = col('data'), iDesc = col('descricao', 'historico', 'lancamento'), iVal = col('valor', 'quantia');
  const iCat = col('categoria'), iConta = col('conta'), iTipo = col('tipo');
  if (iData < 0 || iDesc < 0 || iVal < 0) { aviso('O CSV precisa das colunas data, descricao e valor.'); return; }

  const acharOuCriarCat = (nome, tipo) => {
    if (!nome) return estado.dados.categorias.find((c) => c.tipo === tipo && /^outr/i.test(c.nome))?.id || estado.dados.categorias.find((c) => c.tipo === tipo)?.id;
    let c = estado.dados.categorias.find((c) => c.tipo === tipo && c.nome.toLowerCase() === nome.toLowerCase());
    if (!c) { c = { id: uid(), nome, tipo, cor: '#94a3b8', orcamento: null }; estado.dados.categorias.push(c); }
    return c.id;
  };
  const acharOuCriarConta = (nome) => {
    if (!nome) return estado.dados.contas[0]?.id;
    let c = estado.dados.contas.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
    if (!c) { c = { id: uid(), nome, saldoInicial: 0, cor: '#64748b' }; estado.dados.contas.push(c); }
    return c.id;
  };

  let ok = 0, erro = 0;
  for (const r of linhas.slice(1)) {
    const d = (r[iData] || '').trim();
    let data = null;
    let m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) data = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    else if ((m = d.match(/^(\d{4})-(\d{2})-(\d{2})/))) data = `${m[1]}-${m[2]}-${m[3]}`;
    const v = parseValor(r[iVal] || '');
    if (!data || Number.isNaN(v) || v === 0) { erro++; continue; }
    const tipoTxt = iTipo >= 0 ? (r[iTipo] || '').trim().toLowerCase() : '';
    if (tipoTxt === 'transferencia') { erro++; continue; }
    const tipo = tipoTxt === 'receita' || tipoTxt === 'despesa' ? tipoTxt : v < 0 ? 'despesa' : 'receita';
    estado.dados.lancamentos.push({
      id: uid(), criadoEm: Date.now(), tipo, data, valor: Math.abs(v), descricao: (r[iDesc] || '').trim() || '(sem descrição)',
      categoriaId: acharOuCriarCat(iCat >= 0 ? (r[iCat] || '').trim() : '', tipo),
      contaId: acharOuCriarConta(iConta >= 0 ? (r[iConta] || '').trim() : ''), pago: data <= hoje(), obs: '',
    });
    ok++;
  }
  salvar(); render();
  aviso(`${ok} lançamento(s) importado(s)${erro ? `, ${erro} linha(s) ignorada(s)` : ''}.`);
}

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- example data

function dadosExemplo() {
  const d = dadosIniciais();
  const c = Object.fromEntries(d.categorias.map((x) => [x.nome, x.id]));
  d.contas[0].saldoInicial = 30000; d.contas[1].saldoInicial = 250000;
  const add = (ym, dia, tipo, descricao, valor, catNome, contaId = 'banco') => {
    const data = `${ym}-${String(dia).padStart(2, '0')}`;
    d.lancamentos.push({ id: uid(), criadoEm: Date.now(), tipo, descricao, valor, data, categoriaId: c[catNome], contaId, pago: data <= hoje(), obs: '' });
  };
  for (let i = -5; i <= 0; i++) {
    const ym = somaMeses(hoje().slice(0, 7), i);
    const vari = (base) => Math.round(base * (0.85 + Math.random() * 0.3));
    add(ym, 5, 'receita', 'Salário', 520000, 'Salário');
    if (i % 2 === 0) add(ym, 18, 'receita', 'Freela de edição', vari(90000), 'Trabalhos extras');
    add(ym, 10, 'despesa', 'Aluguel', 160000, 'Moradia');
    add(ym, 12, 'despesa', 'Conta de luz', vari(18000), 'Contas e serviços');
    add(ym, 12, 'despesa', 'Internet', 9990, 'Contas e serviços');
    add(ym, 3, 'despesa', 'Supermercado', vari(52000), 'Mercado');
    add(ym, 17, 'despesa', 'Supermercado', vari(31000), 'Mercado');
    add(ym, 8, 'despesa', 'Combustível', vari(25000), 'Transporte');
    add(ym, 14, 'despesa', 'Restaurante', vari(12000), 'Alimentação fora', 'carteira');
    d.lancamentos.push({ id: uid(), criadoEm: Date.now(), tipo: 'transferencia', descricao: 'Saque', valor: 30000, data: `${ym}-06`, contaId: 'banco', contaDestinoId: 'carteira', pago: `${ym}-06` <= hoje(), obs: '' });
    add(ym, 20, 'despesa', 'Streaming', 3990, 'Assinaturas');
    add(ym, 22, 'despesa', 'Cinema', vari(8000), 'Lazer', 'carteira');
    if (i % 3 === 0) add(ym, 25, 'despesa', 'Farmácia', vari(9000), 'Saúde');
  }
  d.categorias.find((x) => x.nome === 'Mercado').orcamento = 85000;
  d.categorias.find((x) => x.nome === 'Alimentação fora').orcamento = 15000;
  d.categorias.find((x) => x.nome === 'Lazer').orcamento = 10000;
  d.categorias.find((x) => x.nome === 'Transporte').orcamento = 30000;
  d.metas.push({ id: uid(), nome: 'Reserva de emergência', alvo: 1500000, guardado: 420000, prazo: somaMesesData(hoje(), 12) });
  d.metas.push({ id: uid(), nome: 'Computador novo', alvo: 800000, guardado: 150000, prazo: '' });
  d.config = estado.dados.config;
  return d;
}

// ---------------------------------------------------------------- events

function ligarEventos() {
  $$('.aba').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.tela)));
  document.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir]'); if (ir) irPara(ir.dataset.ir);
  });
  $('#mesAnterior').onclick = () => { estado.mes = somaMeses(estado.mes, -1); render(); };
  $('#mesProximo').onclick = () => { estado.mes = somaMeses(estado.mes, 1); render(); };

  $('#novaDespesa').onclick = () => formLancamento('despesa');
  $('#novaReceita').onclick = () => formLancamento('receita');
  $('#novaTransferencia').onclick = () => {
    if (estado.dados.contas.length < 2) return aviso('Você precisa de pelo menos duas contas.');
    formLancamento('transferencia');
  };
  ['#busca', '#filtroTipo', '#filtroCategoria', '#filtroConta'].forEach((s) => $(s).addEventListener('input', renderLancamentos));
  document.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) formLancamento(null, estado.dados.lancamentos.find((l) => l.id === tr.dataset.id));
  });

  $('#tabelaOrcamento').addEventListener('change', (e) => {
    const id = e.target.dataset.orc; if (!id) return;
    const v = e.target.value.trim() ? parseValor(e.target.value) : null;
    if (v !== null && !(v > 0)) { aviso('Valor inválido.'); renderOrcamento(); return; }
    cat(id).orcamento = v; salvar(); render();
  });

  $('#novaMeta').onclick = () => formMeta();
  $('#listaMetas').addEventListener('click', (e) => {
    const t = e.target, achar = (id) => estado.dados.metas.find((m) => m.id === id);
    if (t.dataset.metaAdd) formMovimentoMeta(achar(t.dataset.metaAdd), 1);
    if (t.dataset.metaTirar) formMovimentoMeta(achar(t.dataset.metaTirar), -1);
    if (t.dataset.metaEditar) formMeta(achar(t.dataset.metaEditar));
  });

  // Settings: accounts & categories (edit in place)
  $('#cfgContas').addEventListener('change', (e) => {
    const linha = e.target.closest('[data-conta]'); if (!linha) return;
    const c = conta(linha.dataset.conta), campo = e.target.dataset.campo;
    if (campo === 'saldoInicial') {
      const v = e.target.value.trim() ? parseValor(e.target.value) : 0;
      if (Number.isNaN(v)) { aviso('Valor inválido.'); return renderConfig(); }
      c.saldoInicial = v;
    } else if (campo === 'nome') c.nome = e.target.value.trim() || c.nome;
    else c[campo] = e.target.value;
    salvar(); render();
  });
  $('#cfgCategorias').addEventListener('change', (e) => {
    const linha = e.target.closest('[data-cat]'); if (!linha) return;
    const c = cat(linha.dataset.cat), campo = e.target.dataset.campo;
    c[campo] = campo === 'nome' ? (e.target.value.trim() || c.nome) : e.target.value;
    salvar(); render();
  });
  document.addEventListener('click', (e) => {
    const rc = e.target.dataset.removerConta, rcat = e.target.dataset.removerCat;
    if (rc) {
      const usado = estado.dados.lancamentos.some((l) => l.contaId === rc || l.contaDestinoId === rc);
      if (usado) return aviso('Essa conta tem lançamentos. Exclua ou mude os lançamentos antes.');
      estado.dados.contas = estado.dados.contas.filter((c) => c.id !== rc); salvar(); render();
    }
    if (rcat) {
      const n = estado.dados.lancamentos.filter((l) => l.categoriaId === rcat).length;
      if (n && !confirm(`${n} lançamento(s) usam esta categoria e vão ficar "Sem categoria". Remover mesmo assim?`)) return;
      estado.dados.categorias = estado.dados.categorias.filter((c) => c.id !== rcat); salvar(); render();
    }
  });
  $('#addConta').onclick = () => { estado.dados.contas.push({ id: uid(), nome: 'Nova conta', saldoInicial: 0, cor: '#64748b' }); salvar(); render(); };
  $('#addCategoria').onclick = () => {
    abrirModal('Nova categoria', `
      <div class="campo"><label>Nome</label><input name="nome" required maxlength="50"></div>
      <div class="campo-linha"><div class="campo"><label>Tipo</label><select name="tipo"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></div>
      <div class="campo"><label>Cor</label><input type="color" name="cor" value="#0ea5e9"></div></div>`,
    (f) => { estado.dados.categorias.push({ id: uid(), nome: f.get('nome').trim(), tipo: f.get('tipo'), cor: f.get('cor'), orcamento: null }); });
  };

  // Backup / CSV
  $('#exportarJson').onclick = () => {
    estado.dados.config.ultimoBackup = hoje();
    baixar(`financas-backup-${hoje()}.json`, JSON.stringify(estado.dados, null, 1), 'application/json');
    salvar(); render(); $('#lembreteBackup')?.remove();
  };
  $('#importarJson').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.lancamentos)) throw new Error();
      if (!confirm('Isso vai SUBSTITUIR todos os dados atuais pelos do backup. Continuar?')) return;
      normalizar(d); estado.dados = d; aplicarTema(); salvar(); render(); aviso('Backup restaurado.');
    } catch { aviso('Arquivo de backup inválido.'); }
  };
  $('#exportarCsv').onclick = exportarCsv;
  $('#importarCsv').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    importarCsv(await f.text());
  };

  $('#tema').onchange = (e) => { estado.dados.config.tema = e.target.value; aplicarTema(); salvar(); render(); };
  $('#dadosExemplo').onclick = () => {
    if (estado.dados.lancamentos.length && !confirm('Isso vai SUBSTITUIR seus dados pelos de exemplo. Continuar?')) return;
    estado.dados = dadosExemplo(); salvar(); render(); aviso('Dados de exemplo carregados.');
  };
  $('#apagarTudo').onclick = () => {
    if (!confirm('Apagar TODOS os dados? (Baixe um backup antes, se quiser.)')) return;
    const tema = estado.dados.config; estado.dados = dadosIniciais(); estado.dados.config = tema; salvar(); render(); aviso('Tudo apagado.');
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (modal.open || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'd') formLancamento('despesa');
    if (e.key === 'r') formLancamento('receita');
    if (e.key === 'ArrowLeft') $('#mesAnterior').click();
    if (e.key === 'ArrowRight') $('#mesProximo').click();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
}

function irPara(tela) {
  $$('.aba').forEach((b) => b.classList.toggle('ativa', b.dataset.tela === tela));
  $$('.tela').forEach((s) => s.classList.toggle('ativa', s.id === `tela-${tela}`));
  if (tela === 'painel') renderPainel(); // charts need a visible canvas to size correctly
}

(function iniciar() {
  carregar();
  aplicarTema();
  ligarEventos();
  render();
  // Gentle reminder: data only lives in this browser.
  const ult = estado.dados.config.ultimoBackup;
  const dias = ult ? (new Date(hoje()) - new Date(ult)) / 864e5 : Infinity;
  if (estado.dados.lancamentos.length >= 10 && dias > 15) {
    const div = document.createElement('div');
    div.className = 'aviso'; div.id = 'lembreteBackup';
    div.innerHTML = `${ult ? `Seu último backup foi em ${fmtData(ult)}.` : 'Você ainda não fez nenhum backup.'} <button class="link" id="backupAgora">Baixar backup agora</button>`;
    $('main').prepend(div);
    $('#backupAgora').onclick = () => $('#exportarJson').click();
  }
})();
