// GET/POST /.netlify/functions/whoami
// Returns the caller's public IP so it can be recorded on the signing certificate.
const { json, preflight } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  const ip = (event.headers['x-nf-client-connection-ip'] ||
              event.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return json(200, { ip: ip || null });
};
