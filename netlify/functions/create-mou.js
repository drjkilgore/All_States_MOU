// POST /.netlify/functions/create-mou
// Body: { accessCode?, senderName, senderEmail, recipientEmail, recipientName?, senderFields }
// Creates the MOU record and emails the district a private signing link.
const { supa, sendEmail, json, preflight, emailShell, btn, APP_BASE_URL } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  // Optional access-code gate for the sender screen
  const required = process.env.SENDER_ACCESS_CODE || '';
  if (required && body.accessCode !== required) {
    return json(401, { error: 'Invalid access code.' });
  }

  const { senderName, senderEmail, recipientEmail, recipientName, senderFields, recipientFields } = body;
  if (!senderEmail || !recipientEmail) {
    return json(400, { error: 'Sender email and recipient email are required.' });
  }
  if (!senderFields || typeof senderFields !== 'object') {
    return json(400, { error: 'senderFields is required.' });
  }

  let db;
  try { db = supa(); } catch (e) { return json(500, { error: e.message }); }

  // Only keep non-empty pre-filled district values (sender may leave them blank).
  const prefill = {};
  if (recipientFields && typeof recipientFields === 'object') {
    if (recipientFields.district_name && recipientFields.district_name.trim())
      prefill.district_name = recipientFields.district_name.trim();
    if (recipientFields.district_address && recipientFields.district_address.trim())
      prefill.district_address = recipientFields.district_address.trim();
  }

  const { data, error } = await db
    .from('mou_documents')
    .insert({
      sender_name: senderName || null,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      sender_fields: senderFields,
      recipient_fields: prefill,
      status: 'sent',
    })
    .select('id, recipient_token, sender_token')
    .single();

  if (error) return json(500, { error: 'Database error: ' + error.message });

  const signUrl   = `${APP_BASE_URL}/index.html?token=${data.recipient_token}`;
  const statusUrl = `${APP_BASE_URL}/index.html?status=${data.sender_token}`;
  const district  = recipientName || prefill.district_name || 'your district';

  // Email the district the signing link
  try {
    await sendEmail({
      to: recipientEmail,
      subject: 'Action needed: #TEACH Memorandum of Understanding (2025–2027) for signature',
      text: `Hello,

${senderName ? senderName + ' at ' : ''}#TEACH has prepared a Memorandum of Understanding (Teacher Certification Partnership Agreement, 2025-2027) for ${district}.

Please review the agreement, complete the district information, and sign electronically. A signed PDF copy will be emailed to you and to #TEACH automatically.

Review & sign the MOU:
${signUrl}

TEACH-USA, LLC (#T.E.A.C.H.)`,
      html: emailShell(
        'Your #TEACH partnership agreement is ready',
        `<p style="font-size:15px;line-height:1.6;">Hello,</p>
         <p style="font-size:15px;line-height:1.6;">
           ${senderName ? senderName + ' at ' : ''}#TEACH has prepared a Memorandum of Understanding
           (Teacher Certification Partnership Agreement, 2025–2027) for <strong>${district}</strong>.
         </p>
         <p style="font-size:15px;line-height:1.6;">
           Please review the agreement, complete the district information, and sign electronically.
           A signed PDF copy will be emailed to you and to #TEACH automatically.
         </p>
         ${btn(signUrl, 'Review &amp; sign the MOU')}`
      ),
    });
  } catch (e) {
    return json(502, { error: 'Record saved, but sending the district email failed: ' + e.message });
  }

  // Confirmation to the sender with a status link
  try {
    await sendEmail({
      to: senderEmail,
      subject: `MOU sent to ${district} for signature`,
      text: `The Memorandum of Understanding has been emailed to ${recipientEmail} for signature. You will receive the fully executed PDF as soon as ${district} signs.

View signing status:
${statusUrl}`,
      html: emailShell(
        'Your MOU is on its way',
        `<p style="font-size:15px;line-height:1.6;">
           The Memorandum of Understanding has been emailed to <strong>${recipientEmail}</strong> for signature.
           You will receive the fully executed PDF as soon as ${district} signs.
         </p>
         ${btn(statusUrl, 'View signing status')}`
      ),
    });
  } catch (e) {
    // Non-fatal — district email already went out
    console.warn('Sender confirmation email failed:', e.message);
  }

  return json(200, { ok: true, id: data.id, sign_url: signUrl, status_url: statusUrl });
};
