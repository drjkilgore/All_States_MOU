// POST /.netlify/functions/list-mous
// Body: { adminCode }
// Returns metadata for every MOU (no PDF blobs) for the admin library.
const { supa, json, preflight } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const required = process.env.ADMIN_ACCESS_CODE || '';
  if (!required) return json(403, { error: 'The MOU Library is not enabled yet. Set ADMIN_ACCESS_CODE in your environment variables to turn it on.' });
  if (body.adminCode !== required) return json(401, { error: 'Invalid admin code.' });

  let db;
  try { db = supa(); } catch (e) { return json(500, { error: e.message }); }

  // Do NOT select signed_pdf_base64 here — it can be large. has_pdf is derived from status.
  const { data, error } = await db
    .from('mou_documents')
    .select('id, status, recipient_token, sender_token, sender_name, sender_email, recipient_email, sender_fields, recipient_fields, created_at, signed_at, signed_name, signed_title')
    .order('created_at', { ascending: false });

  if (error) return json(500, { error: 'Database error: ' + error.message });

  const rows = (data || []).map(r => ({
    id: r.id,
    status: r.status,
    recipient_token: r.recipient_token,
    sender_token: r.sender_token,
    district: (r.recipient_fields && r.recipient_fields.district_name) ||
              (r.sender_fields && r.sender_fields.district_name) || '',
    state: (r.sender_fields && r.sender_fields.state) || '',
    effective_date: (r.sender_fields && r.sender_fields.effective_date) || '',
    sender_name: r.sender_name || '',
    sender_email: r.sender_email || '',
    recipient_email: r.recipient_email || '',
    created_at: r.created_at,
    signed_at: r.signed_at,
    signed_name: r.signed_name || '',
    signed_title: r.signed_title || '',
    has_pdf: r.status === 'signed',
  }));

  return json(200, { ok: true, rows });
};
