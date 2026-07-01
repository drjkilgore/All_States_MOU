// POST /.netlify/functions/verify-mou
// Body: { id }  (the document/agreement id — safe to share; used by the ?verify page)
// Public: returns the signed record's canonical data + stored hash so the browser can
// independently recompute the integrity hash and confirm the document is unaltered.
const { supa, json, preflight } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  if (!body.id) return json(400, { error: 'A document ID is required.' });

  let db;
  try { db = supa(); } catch (e) { return json(500, { error: e.message }); }

  const { data, error } = await db
    .from('mou_documents')
    .select('id, status, sender_name, sender_email, sender_fields, recipient_fields, recipient_email, signed_at, signed_ip, signed_name, signed_title, integrity_hash, audit, created_at')
    .eq('id', body.id)
    .single();

  if (error || !data) return json(404, { error: 'No agreement was found with that ID.' });
  if (data.status !== 'signed') return json(409, { error: 'This agreement has not been fully executed yet.' });

  return json(200, {
    ok: true,
    id: data.id,
    status: data.status,
    senderName: data.sender_name,
    senderEmail: data.sender_email,
    senderFields: data.sender_fields || {},
    recipientFields: data.recipient_fields || {},
    recipientEmail: data.recipient_email,
    signedAt: data.signed_at,
    signedIp: data.signed_ip,
    signedName: data.signed_name,
    signedTitle: data.signed_title,
    integrityHash: data.integrity_hash,
    audit: Array.isArray(data.audit) ? data.audit : [],
    createdAt: data.created_at,
  });
};
