// POST /.netlify/functions/get-mou
// Body: { token }  (recipient_token) OR { statusToken } (sender_token)
// Returns only the fields the browser needs — never the tokens/emails of the other party.
const { supa, json, preflight } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const { token, statusToken } = body;
  if (!token && !statusToken) return json(400, { error: 'A token is required.' });

  let db;
  try { db = supa(); } catch (e) { return json(500, { error: e.message }); }

  const col = token ? 'recipient_token' : 'sender_token';
  const val = token || statusToken;

  const { data, error } = await db
    .from('mou_documents')
    .select('id, status, sender_name, sender_fields, recipient_fields, recipient_email, signed_at, signed_name, signed_title')
    .eq(col, val)
    .single();

  if (error || !data) return json(404, { error: 'This link is invalid or has expired.' });

  return json(200, {
    ok: true,
    role: token ? 'recipient' : 'sender',
    id: data.id,
    status: data.status,
    senderName: data.sender_name,
    senderFields: data.sender_fields || {},
    recipientFields: data.recipient_fields || {},
    recipientEmail: token ? data.recipient_email : undefined,
    signedAt: data.signed_at,
    signedName: data.signed_name,
    signedTitle: data.signed_title,
  });
};
