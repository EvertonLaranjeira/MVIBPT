import { consult, ConsultationError } from '../lib/ibpt.mjs';
const requests = new Map();
function limited(key) {
  const now = Date.now();
  for (const [k,v] of requests) if (v.until <= now) requests.delete(k);
  const record = requests.get(key) || { count: 0, until: now + 60000 };
  if (!requests.has(key) && requests.size >= 10000) return true;
  record.count++; requests.set(key, record); return record.count > 30;
}
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  const allowed = process.env.ALLOWED_ORIGIN?.replace(/\/$/, '');
  if (origin && allowed && origin === allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  function send(status, value) { res.statusCode = status; res.end(JSON.stringify(value)); }
  if (req.method !== 'POST') { res.setHeader('Allow','POST, OPTIONS'); return send(405, { error: 'Use o formulário para consultar.' }); }
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return send(415, { error: 'Formato de consulta inválido.' });
  const key = process.env.VERCEL ? String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown') : req.socket?.remoteAddress || 'local';
  if (limited(key)) { res.setHeader('Retry-After', '60'); return send(429, { error: 'Muitas consultas em sequência. Aguarde um minuto.' }); }
  try {
    let body = req.body;
    if (body === undefined) {
      let text = '';
      for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 8192) throw new ConsultationError(413, 'SIZE', 'A consulta excedeu o tamanho permitido.'); }
      try { body = JSON.parse(text); } catch { throw new ConsultationError(400, 'JSON', 'Não foi possível ler os dados da consulta.'); }
    } else {
      if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body)) > 8192) throw new ConsultationError(413,'SIZE','A consulta excedeu o tamanho permitido.');
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new ConsultationError(400,'JSON','Dados inválidos.'); } }
    }
    return send(200, await consult(body));
  } catch (error) {
    // Não registrar URLs de consulta: elas contêm o token do IBPT.
    return send(error instanceof ConsultationError ? error.status : 500, { error: error instanceof ConsultationError ? error.message : 'Não foi possível concluir a consulta.', code: error instanceof ConsultationError ? error.code : 'INTERNAL' });
  }
}
