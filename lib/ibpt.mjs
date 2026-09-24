export class ConsultationError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ConsultationError(status, code, message); };
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INPUT', 'Informe os dados da consulta.');
  const tipo = body.tipo;
  if (!['ncm', 'nbs'].includes(tipo)) fail(400, 'INPUT', 'Selecione NCM ou NBS.');
  const rawCode = String(body.codigo ?? '').trim();
  const codigo = rawCode.replace(/[.\s-]/g, '');
  if (!new RegExp(`^\\d{${tipo === 'ncm' ? 8 : 9}}$`).test(codigo)) fail(400, 'INPUT', `Informe um ${tipo.toUpperCase()} com ${tipo === 'ncm' ? 8 : 9} dígitos.`);
  const uf = String(body.uf ?? '').toUpperCase();
  if (!UFS.has(uf)) fail(400, 'INPUT', 'Selecione um estado válido.');
  const ex = tipo === 'ncm' ? String(body.ex ?? '0') : '0';
  if (!/^\d{1,3}$/.test(ex)) fail(400, 'INPUT', 'Informe uma exceção numérica ou use 0.');
  const origem = body.origem ?? 'nacional';
  if (!['nacional', 'importado'].includes(origem)) fail(400, 'INPUT', 'Selecione a origem.');
  let valor = null;
  if (body.valor !== null && body.valor !== undefined && body.valor !== '') {
    if (typeof body.valor !== 'number' || !Number.isFinite(body.valor) || body.valor <= 0 || body.valor > 999999999.99 || Math.abs(body.valor * 100 - Math.round(body.valor * 100)) > 0.0001) fail(400, 'INPUT', 'Informe um valor positivo com até duas casas decimais.');
    valor = body.valor;
  }
  const descricao = String(body.descricao ?? '').trim();
  const unidade = String(body.unidade ?? '').trim();
  const gtin = tipo === 'ncm' ? String(body.gtin ?? '').trim() : '';
  if (descricao.length > 300 || unidade.length > 12 || (gtin && !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin))) fail(400, 'INPUT', 'Confira a descrição, unidade de medida e GTIN.');
  return { tipo, codigo, uf, ex: String(Number(ex)), origem, valor, descricao, unidade, gtin };
}
export function dateISO(value) {
  const text = String(value ?? '');
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === iso ? iso : null;
}
export function normalizeResponse(data, query, now = new Date()) {
  if (Array.isArray(data)) {
    if (!data.length) fail(404, 'NOT_FOUND', 'Nenhum resultado encontrado para este código e estado.');
    if (data.length !== 1) fail(502, 'AMBIGUOUS', 'O IBPT retornou mais de um registro. Confira o código e a exceção.');
    data = data[0];
  }
  if (!data || typeof data !== 'object') fail(502, 'FORMAT', 'O IBPT retornou uma resposta que não pôde ser validada.');
  const fields = Object.fromEntries(Object.entries(data).map(([k,v]) => [k.toLowerCase(), v]));
  const codigo = String(fields.codigo ?? '');
  const uf = String(fields.uf ?? '').toUpperCase();
  if (codigo !== query.codigo || uf !== query.uf) fail(502, 'MISMATCH', 'A resposta do IBPT não corresponde ao código e estado consultados.');
  if (query.tipo === 'ncm' && (fields.ex === null || fields.ex === undefined || !/^\d{1,3}$/.test(String(fields.ex)) || Number(fields.ex) !== Number(query.ex))) fail(502, 'MISMATCH', 'A exceção retornada pelo IBPT não corresponde à consulta.');
  function rate(...keys) {
    const raw = keys.map(k => fields[k]).find(v => v !== undefined && v !== null);
    if (!['string', 'number'].includes(typeof raw) || String(raw).trim() === '') fail(502, 'FORMAT', 'O IBPT retornou percentuais incompletos. Tente novamente.');
    const value = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0 || value > 1000) fail(502, 'FORMAT', 'O IBPT retornou um percentual inválido.');
    return value;
  }
  const nacional = rate('nacional', 'nacionalfederal');
  const importado = rate('importado', 'importadosfederal');
  const estadual = rate('estadual');
  const municipal = rate('municipal');
  const inicio = dateISO(fields.vigenciainicio);
  const fim = dateISO(fields.vigenciafim);
  if (!inicio || !fim || inicio > fim) fail(502, 'VALIDITY', 'Não foi possível confirmar a vigência da tabela retornada pelo IBPT.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Belem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (today < inicio || today > fim) fail(409, 'EXPIRED', `O IBPT retornou uma tabela fora da vigência (${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}). Os percentuais não serão exibidos. Consulte o escritório.`);
  if (typeof fields.descricao !== 'string' || !fields.descricao.trim()) fail(502, 'FORMAT', 'O IBPT não retornou a descrição do item.');
  const federal = query.origem === 'importado' ? importado : nacional;
  const cents = query.valor === null ? null : Math.round(query.valor * 100);
  const amounts = cents === null ? null : [federal, estadual, municipal].map(r => Math.round((cents * r / 100) + 1e-8));
  return {
    codigo, uf, tipo: query.tipo, ex: query.ex, descricao: fields.descricao,
    origem: query.origem, valor: query.valor,
    federal, estadual, municipal, nacional, importado,
    total: Math.round((federal + estadual + municipal) * 10000) / 10000,
    valoresCentavos: amounts && { federal: amounts[0], estadual: amounts[1], municipal: amounts[2], total: amounts.reduce((a,b) => a+b,0) },
    vigenciaInicio: inicio, vigenciaFim: fim,
    versao: String(fields.versao ?? 'Não informada'), chave: String(fields.chave ?? 'Não informada'),
    fonte: String(fields.fonte || 'IBPT / Empresômetro'), consultadoEm: now.toISOString()
  };
}
export async function consult(body, env = process.env, fetcher = fetch, now = new Date()) {
  const query = validateInput(body);
  const token = String(env.IBPT_TOKEN ?? '').trim();
  const cnpj = String(env.IBPT_CNPJ ?? '').replace(/[.\/-]/g, '').trim();
  if (!token || !/^[A-Z0-9]{12}\d{2}$/i.test(cnpj)) fail(503, 'NOT_CONFIGURED', 'A consulta online ainda não foi ativada pelo escritório. Entre em contato com a MV Contadores.');
  const url = new URL(`https://apidoni.ibpt.org.br/api/v1/${query.tipo === 'ncm' ? 'produtos' : 'servicos'}`);
  const params = { token, cnpj, codigo: query.codigo, uf: query.uf, descricao: query.descricao, unidadeMedida: query.unidade, valor: String(query.valor ?? 0) };
  if (query.tipo === 'ncm') Object.assign(params, { ex: query.ex, gtin: query.gtin });
  url.search = new URLSearchParams(params).toString();
  let response;
  try { response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000), redirect: 'error' }); }
  catch { fail(504, 'UNAVAILABLE', 'Não foi possível consultar o IBPT agora. Aguarde alguns instantes e tente novamente.'); }
  if (response.status === 404) fail(404, 'NOT_FOUND', 'Código não encontrado no IBPT. Confira o código, a UF e a exceção.');
  if ([401,403].includes(response.status)) fail(502, 'AUTH', 'O IBPT não autorizou a consulta. O escritório precisa verificar o acesso.');
  if (response.status === 429) fail(429, 'LIMIT', 'O limite de consultas do IBPT foi atingido. Aguarde e tente novamente.');
  if (!response.ok) fail(502, 'UPSTREAM', 'O IBPT não concluiu a consulta. Confira os dados e tente novamente.');
  let data;
  try { data = await response.json(); } catch { fail(502, 'FORMAT', 'O IBPT retornou uma resposta inesperada. Tente novamente mais tarde.'); }
  return normalizeResponse(data, query, now);
}
