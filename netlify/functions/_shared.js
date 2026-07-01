// Shared helpers for all functions: clients, JSON responses, email bodies.
const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SENDGRID_API_KEY,
  FROM_EMAIL,
  FROM_NAME,
  APP_BASE_URL,
} = process.env;

function supa() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env vars are missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  // Accept URLs even if someone pasted the REST endpoint or left a trailing slash.
  // supabase-js needs the bare project URL (https://<ref>.supabase.co) and adds
  // /rest/v1/... itself, so strip any /rest/v1 suffix and trailing slashes.
  const url = SUPABASE_URL.trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  return createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

const BRAND = {
  navy: '#002E5D',
  crimson: '#8B0000',
  sky: '#12A7E6',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function preflight() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: '',
  };
}

// Minimal branded email shell
function emailShell(title, innerHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1a2430;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:${BRAND.navy};border-radius:12px 12px 0 0;padding:20px 24px;">
      <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:.3px;">#TEACH</div>
      <div style="color:${BRAND.sky};font-size:12px;font-weight:600;">Training Educators and Creating Hope</div>
    </div>
    <div style="background:#fff;border:1px solid #e6eaf0;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px;">
      <h1 style="margin:0 0 14px;font-size:19px;color:${BRAND.navy};">${title}</h1>
      ${innerHtml}
    </div>
    <p style="text-align:center;color:#93a1b3;font-size:11px;margin:16px 0 0;">
      TEACH-USA, LLC (#T.E.A.C.H.) · 1098 Ann Arbor Rd. W #279 · Plymouth, MI 48170
    </p>
  </div></body></html>`;
}

function btn(href, label) {
  // Table-based "bulletproof" button — renders reliably in Gmail, Apple Mail,
  // Outlook, and mobile clients (a plain styled <a> can be stripped by some).
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0;">
    <tr><td align="center" bgcolor="${BRAND.crimson}" style="border-radius:8px;">
      <a href="${href}" target="_blank" style="display:inline-block;background:${BRAND.crimson};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;font-family:Arial,Helvetica,sans-serif;padding:14px 30px;border-radius:8px;">${label}</a>
    </td></tr></table>`;
}

async function sendEmail(msg) {
  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set — skipping email to', msg.to);
    return { skipped: true };
  }
  const from = { email: FROM_EMAIL, name: FROM_NAME || '#TEACH' };
  await sgMail.send({ from, ...msg });
  return { sent: true };
}

module.exports = {
  supa, sendEmail, json, preflight, emailShell, btn, BRAND,
  APP_BASE_URL: (APP_BASE_URL || '').replace(/\/$/, ''),
};
