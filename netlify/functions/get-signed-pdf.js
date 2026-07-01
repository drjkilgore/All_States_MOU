// POST /.netlify/functions/get-signed-pdf
// Body: { adminCode, id }
// Returns the stored signed PDF (base64) for one MOU so the library can download it.
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

  const { data, error } = await db
    .from('mou_documents')
    .select('status, signed_pdf_base64, sender_fields, recipient_fields, signed_at')
    .eq('id', body.id)
    .single();

  if (error || !data) return json(404, { error: 'MOU not found.' });
  if (!data.signed_pdf_base64) return json(409, { error: 'This MOU has not been signed yet.' });

  const district = (data.recipient_fields && data.recipient_fields.district_name) ||
                   (data.sender_fields && data.sender_fields.district_name) || 'district';
  const datePart = data.signed_at ? '-' + new Date(data.signed_at).toISOString().slice(0, 10) : '';
  const filename = `TEACH-MOU-${String(district).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}${datePart}-signed.pdf`;

  return json(200, { ok: true, filename, pdfBase64: data.signed_pdf_base64 });
};
