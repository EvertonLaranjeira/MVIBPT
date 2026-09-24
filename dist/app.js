const $ = id => document.getElementById(id);
const form = $('search-form');
const formatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = value => formatter.format(value) + '%';
const date = iso => iso.split('-').reverse().join('/');
const states = 'AC:Acre|AL:Alagoas|AP:Amapá|AM:Amazonas|BA:Bahia|CE:Ceará|DF:Distrito Federal|ES:Espírito Santo|GO:Goiás|MA:Maranhão|MT:Mato Grosso|MS:Mato Grosso do Sul|MG:Minas Gerais|PA:Pará|PB:Paraíba|PR:Paraná|PE:Pernambuco|PI:Piauí|RJ:Rio de Janeiro|RN:Rio Grande do Norte|RS:Rio Grande do Sul|RO:Rondônia|RR:Roraima|SC:Santa Catarina|SP:São Paulo|SE:Sergipe|TO:Tocantins';
const online = true;
for (const state of (online ? states : 'PA:Pará').split('|')) {
  const [uf,name] = state.split(':'); const option = new Option(`${uf} · ${name}`, uf); option.selected = uf === 'PA'; $('uf').add(option);
}
let result = null, controller = null, sequence = 0;
function status(message = '', isError = false) {
  $('status').textContent = message; $('status').classList.toggle('error', isError);
}
function busy(value) {
  $('submit').disabled = value;
  $('submit').querySelector('span').textContent = value ? 'Consultando…' : 'Consultar tributos';
  document.querySelector('.result-panel').setAttribute('aria-busy', String(value));
}
function invalidate() {
  sequence++; controller?.abort(); controller = null; busy(false); result = null;
  $('result').hidden = true; $('empty').hidden = false; $('result-tag').textContent = 'Aguardando consulta'; $('copy-status').textContent = ''; status();
}
function setType() {
  const product = form.elements.tipo.value === 'ncm';
  $('code-label').textContent = product ? 'Código NCM' : 'Código NBS';
  $('codigo').placeholder = product ? 'Ex.: 0101.21.00' : 'Ex.: 1.0101.10.00';
  $('code-hint').textContent = `Informe os ${product ? 8 : 9} dígitos do ${product ? 'produto' : 'serviço'}.`;
  $('ex-field').hidden = !product; $('ex').disabled = !product;
  $('gtin-field').hidden = !product; $('gtin').disabled = !product;
}
form.addEventListener('input', () => invalidate());
form.addEventListener('change', e => { invalidate(); if (e.target.name === 'tipo') { $('codigo').value = ''; setType(); } });
function show(data) {
  result = data;
  $('empty').hidden = true; $('result').hidden = false;
  $('result-tag').textContent = 'Vigência conferida';
  $('item-code').textContent = `${data.tipo.toUpperCase()} ${data.codigo} · ${data.uf}${data.tipo === 'ncm' && data.ex !== '0' ? ' · EX ' + data.ex : ''}`;
  $('item-description').textContent = data.descricao;
  $('item-context').textContent = `Origem ${data.origem === 'importado' ? 'importada' : 'nacional'} · ${data.local ? "Tabela IBPT carregada (sem atualização automática)" : "Consulta direta ao IBPT"}`;
  for (const type of ['federal', 'estadual', 'municipal']) {
    $(type).textContent = percent(data[type]);
  }
  $('total-rate').textContent = percent(data.total);
  $('total-base').textContent = 'Soma dos três percentuais';
  $('validity').textContent = `${date(data.vigenciaInicio)} a ${date(data.vigenciaFim)}`;
  $('version').textContent = data.versao; $('key').textContent = data.chave;
  $('queried').textContent = new Date(data.consultadoEm).toLocaleString('pt-BR', { timeZone: 'America/Belem', dateStyle: 'short', timeStyle: 'short' }) + ' (Belém)';
  $('source-name').textContent = data.fonte + ' · De Olho no Imposto ↗';
  status('Consulta concluída. Confira a descrição do item antes de utilizar os percentuais.');
}
form.addEventListener('submit', async event => {
  event.preventDefault(); invalidate();
  let query;
  try {
    const tipo = form.elements.tipo.value;
    const codigo = $('codigo').value.replace(/[.\s-]/g, '');
    if (!new RegExp(`^\\d{${tipo === 'ncm' ? 8 : 9}}$`).test(codigo)) { $('codigo').focus(); throw new Error(`Informe um ${tipo.toUpperCase()} com ${tipo === 'ncm' ? 8 : 9} dígitos.`); }
    query = { tipo, codigo, uf: $('uf').value, ex: $('ex').value, origem: $('origem').value, valor: null, descricao: $('descricao').value, unidade: $('unidade').value, gtin: $('gtin').value };
  } catch (error) { status(error.message, true); return; }
  const ticket = sequence;
  controller = new AbortController();
  const currentController = controller;
  const timer = setTimeout(() => currentController.abort('timeout'), 20000);
  busy(true); status(online ? 'Buscando os percentuais na fonte IBPT…' : 'Consultando a tabela IBPT carregada…'); $('result-tag').textContent = 'Consultando';
  try {
    const base = String(window.MV_CONFIG?.apiBase || '').replace(/\/$/, '');
    const response = await fetch(`${base}/api/consulta`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query), signal: currentController.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error('O endereço da consulta respondeu em formato inesperado (HTTP ' + response.status + '). Atualize a página. Se estiver usando o Live Server, abra o site pelo arquivo Abrir-Site.cmd.'); }
    if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o IBPT. Tente novamente.');
    if (ticket !== sequence) return;
    show(data);
    if (window.matchMedia('(max-width: 720px)').matches) document.querySelector('.result-panel').scrollIntoView({ behavior: 'instant', block: 'start' });
  } catch (error) {
    if (ticket !== sequence) return;
    const message = currentController.signal.aborted ? 'A consulta demorou mais que o esperado. Tente novamente.' : error instanceof TypeError ? 'Não foi possível conectar ao serviço de consulta. Verifique sua conexão ou entre em contato com o escritório.' : error.message;
    status(message, true); $('result-tag').textContent = 'Consulta não concluída';
  } finally { clearTimeout(timer); if (ticket === sequence) { busy(false); controller = null; } }
});
$('copy').addEventListener('click', async () => {
  if (!result) return;
  const d = result;
  const lines = [`MV Contadores — Tributos aproximados`, `${d.tipo.toUpperCase()} ${d.codigo} · ${d.uf}${d.tipo === 'ncm' ? ' · EX ' + d.ex : ''}`, d.descricao, `Origem: ${d.origem}`, d.local ? 'Consulta à tabela carregada; sem atualização automática.' : 'Consulta direta à API do IBPT.'];
  for (const type of ['federal','estadual','municipal']) lines.push(`${type[0].toUpperCase() + type.slice(1)}: ${percent(d[type])}`);
  lines.push(`Total aproximado: ${percent(d.total)}`, `Vigência: ${date(d.vigenciaInicio)} a ${date(d.vigenciaFim)} · Versão ${d.versao} · Chave ${d.chave}`, `Fonte: ${d.fonte} — https://deolhonoimposto.ibpt.org.br/`);
  try { await navigator.clipboard.writeText(lines.join('\n')); $('copy-status').textContent = 'Resultado copiado com a fonte IBPT.'; }
  catch { $('copy-status').textContent = 'O navegador não permitiu copiar. Selecione o resultado e copie manualmente.'; }
});
setType();

$('api-extra').hidden = !online;
if (online) $('data-mode').textContent = 'Consulta direta à API IBPT. Requer acesso autorizado configurado.';

