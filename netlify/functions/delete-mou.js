// POST /.netlify/functions/delete-mou
// Body: { adminCode, id }
// Permanently removes an MOU from the library (used to clear test/sample records).
const { supa, json, preflight } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const required = process.env.ADMIN_ACCESS_CODE || '';
  if (!required) return json(403, { error: 'The MOU Library is not enabled.' });
  if (body.adminCode !== required) return json(401, { error: 'Invalid admin code.' });
  if (!body.id) return json(400, { error: 'Missing id.' });

  let db;
  try { db = supa(); } catch (e) { return json(500, { error: e.message }); }

  const { error } = await db.from('mou_documents').delete().eq('id', body.id);
  if (error) return json(500, { error: 'Delete failed: ' + error.message });

  return json(200, { ok: true });
};
