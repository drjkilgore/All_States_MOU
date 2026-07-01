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
  // Client-proof CTA. Some mail clients and corporate link-security layers rewrite
  // <a> tags into visible "[url]label" text. Bare URLs, by contrast, are reliably
  // auto-linkified by every client. So we present the URL as plain text inside a
  // branded card — it renders as a working link everywhere.
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
    <tr><td align="center" style="border:2px solid ${BRAND.crimson};border-radius:10px;padding:18px 22px;">
      <div style="font-size:15px;font-weight:700;color:${BRAND.navy};margin-bottom:10px;font-family:Arial,Helvetica,sans-serif;">${label}</div>
      <div style="font-size:14px;color:${BRAND.sky};word-break:break-all;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${href}</div>
      <div style="font-size:12px;color:#7a8798;margin-top:10px;font-family:Arial,Helvetica,sans-serif;">Click or tap the link above to open it.</div>
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
  // Always return an absolute URL with an https:// scheme. If APP_BASE_URL was
  // set without the scheme (e.g. "teach-all-states-mou.netlify.app"), links would
  // otherwise be treated as relative paths — breaking the status link (404) and
  // preventing email clients from making the URL clickable.
  APP_BASE_URL: (function(u){
    let s = (u || '').trim().replace(/\/+$/, '');
    if (s && !/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s;
  })(APP_BASE_URL),
};
