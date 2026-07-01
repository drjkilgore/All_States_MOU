// POST /.netlify/functions/sign-mou
// Body: { token, recipientFields, signatureData, signedName, signedTitle, pdfBase64 }
// Records the signature, stores the final PDF, and emails it to both parties.
const { supa, sendEmail, json, preflight, emailShell } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const { token, recipientFields, signatureData, signedName, signedTitle, pdfBase64 } = body;
  if (!token) return json(400, { error: 'Missing token.' });
  if (!signedName) return json(400, { error: 'A printed name is required to sign.' });
  if (!pdfBase64) return json(400, { error: 'Missing signed document.' });

  let db;
  try { db = supa(); } catch (e) { return json(500, { error: e.message }); }

  // Load the record (and guard against double-signing)
  const { data: rec, error: loadErr } = await db
    .from('mou_documents')
    .select('id, status, sender_email, recipient_email, sender_fields')
    .eq('recipient_token', token)
    .single();

  if (loadErr || !rec) return json(404, { error: 'This link is invalid or has expired.' });
  if (rec.status === 'signed') return json(409, { error: 'This MOU has already been signed.' });
  if (rec.status === 'voided') return json(409, { error: 'This MOU has been voided.' });

  const ip = (event.headers['x-nf-client-connection-ip'] ||
              event.headers['x-forwarded-for'] || '').split(',')[0].trim();

  const { error: updErr } = await db
    .from('mou_documents')
    .update({
      status: 'signed',
      recipient_fields: recipientFields || {},
      signature_data: signatureData || null,
      signed_name: signedName,
      signed_title: signedTitle || null,
      signed_ip: ip || null,
      signed_at: new Date().toISOString(),
      signed_pdf_base64: pdfBase64,
    })
    .eq('recipient_token', token);

  if (updErr) return json(500, { error: 'Could not save signature: ' + updErr.message });

  const district = (recipientFields && recipientFields.district_name) ||
                   rec.sender_fields.district_name || 'the district';
  const filename = `TEACH-MOU-${String(district).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}-signed.pdf`;

  const attachment = {
    content: pdfBase64,
    filename,
    type: 'application/pdf',
    disposition: 'attachment',
  };

  const bodyHtml = (who) => emailShell(
    'Fully executed MOU (signed copy attached)',
    `<p style="font-size:15px;line-height:1.6;">${who},</p>
     <p style="font-size:15px;line-height:1.6;">
       The Memorandum of Understanding between <strong>#TEACH</strong> and
       <strong>${district}</strong> has been signed by <strong>${signedName}</strong>${signedTitle ? ', ' + signedTitle : ''}.
     </p>
     <p style="font-size:15px;line-height:1.6;">
       A PDF copy of the fully executed agreement is attached for your records.
     </p>
     <p style="font-size:12px;color:#7a8798;">Signed ${new Date().toLocaleString('en-US', { timeZone: 'America/Detroit' })} (ET)${ip ? ' · IP ' + ip : ''}.</p>`
  );

  const bodyText = `The Memorandum of Understanding between #TEACH and ${district} has been signed by ${signedName}${signedTitle ? ', ' + signedTitle : ''}.

A PDF copy of the fully executed agreement is attached for your records.

Signed ${new Date().toLocaleString('en-US', { timeZone: 'America/Detroit' })} (ET)${ip ? ' · IP ' + ip : ''}.`;

  const results = { recipientEmailed: false, senderEmailed: false, warnings: [] };

  try {
    await sendEmail({
      to: rec.recipient_email,
      subject: `Signed: #TEACH MOU with ${district}`,
      text: bodyText,
      html: bodyHtml('Hello'),
      attachments: [attachment],
    });
    results.recipientEmailed = true;
  } catch (e) { results.warnings.push('recipient email failed: ' + e.message); }

  try {
    await sendEmail({
      to: rec.sender_email,
      subject: `Signed: #TEACH MOU with ${district}`,
      text: bodyText,
      html: bodyHtml('Hello'),
      attachments: [attachment],
    });
    results.senderEmailed = true;
  } catch (e) { results.warnings.push('sender email failed: ' + e.message); }

  return json(200, { ok: true, ...results });
};
