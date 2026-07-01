// POST /.netlify/functions/remind-mou
// Body: { adminCode, id }
// Re-sends the signing email to the district recipient who has not yet signed.
const { supa, sendEmail, json, preflight, emailShell, btn, APP_BASE_URL } = require('./_shared');

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

  const { data: rec, error } = await db
    .from('mou_documents')
    .select('status, recipient_token, recipient_email, sender_name, sender_fields, recipient_fields, audit')
    .eq('id', body.id)
    .single();

  if (error || !rec) return json(404, { error: 'MOU not found.' });
  if (rec.status === 'signed') return json(409, { error: 'This MOU has already been signed.' });
  if (rec.status === 'voided') return json(409, { error: 'This MOU has been voided.' });

  const signUrl = `${APP_BASE_URL}/index.html?token=${rec.recipient_token}`;
  const district = (rec.recipient_fields && rec.recipient_fields.district_name) ||
                   (rec.sender_fields && rec.sender_fields.district_name) || 'your district';

  try {
    await sendEmail({
      to: rec.recipient_email,
      subject: 'Reminder: #TEACH Memorandum of Understanding awaiting your signature',
      text: `Hello,

This is a friendly reminder that the #TEACH Memorandum of Understanding for ${district} is still awaiting your signature. It only takes a couple of minutes to complete.

Review & sign the MOU:
${signUrl}

Thank you,
#TEACH`,
      html: emailShell(
        'A quick reminder',
        `<p style="font-size:15px;line-height:1.6;">Hello,</p>
         <p style="font-size:15px;line-height:1.6;">
           This is a friendly reminder that the #TEACH Memorandum of Understanding for
           <strong>${district}</strong> is still awaiting your signature. It only takes a couple of minutes to complete.
         </p>
         ${btn(signUrl, 'Review &amp; sign the MOU')}`
      ),
    });
  } catch (e) {
    return json(502, { error: 'Could not send the reminder email: ' + e.message });
  }

  // Log the reminder in the audit trail (best-effort)
  try {
    const audit = Array.isArray(rec.audit) ? rec.audit : [];
    audit.push({ event: 'reminder_sent', at: new Date().toISOString(), to: rec.recipient_email, detail: 'Reminder email re-sent to district' });
    await db.from('mou_documents').update({ audit }).eq('id', body.id);
  } catch (_) { /* non-fatal */ }

  return json(200, { ok: true, to: rec.recipient_email });
};
