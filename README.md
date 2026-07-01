# #TEACH MOU e-Sign

A two-party fill-and-sign workflow for the **#TEACH Memorandum of Understanding (2025–2027)**.

1. **You (#TEACH staff)** open the app, complete the program details and pricing, and enter the district's email. Your President/Founder signature block is pre-applied automatically.
2. The district receives a **private email link**, reviews the agreement, completes their information, and **signs electronically** (draw or type).
3. A **signed PDF is emailed to both the district and to you** automatically. The record is stored in Supabase.

Built to run entirely in the browser with the stack you already use: **GitHub web UI → Netlify → Supabase → SendGrid**. No command line required.

---

## What's in this project

```
index.html                     ← the whole app (create / sign / status views)
netlify.toml                   ← Netlify build + routing config
package.json                   ← function dependencies
supabase-schema.sql            ← run once in Supabase SQL Editor
.env.example                   ← the environment variables to set in Netlify
netlify/functions/
  ├─ _shared.js                ← Supabase + SendGrid clients, branded email shells
  ├─ create-mou.js             ← saves the MOU, emails the district a signing link
  ├─ get-mou.js                ← loads an MOU by token (for the sign + status screens)
  └─ sign-mou.js               ← records the signature, emails the signed PDF to both parties
```

---

## Deploy — step by step (all browser, no CLI)

### 1. Create the database (Supabase)
1. Go to **supabase.com → New project** (or use your existing project).
2. Open **SQL Editor → New query**, paste the entire contents of `supabase-schema.sql`, and click **Run**.
3. Open **Project Settings → API** and copy:
   - **Project URL** → this becomes `SUPABASE_URL`
   - **service_role** secret key → this becomes `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never put this in the browser).

### 2. Set up email (SendGrid)
1. In SendGrid, verify a sender or domain (e.g., `noreply@teach-usa.com`).
2. **Settings → API Keys → Create API Key** (Full Access or Mail Send). Copy it → `SENDGRID_API_KEY`.

### 3. Put the code on GitHub
1. Create a new repository on **github.com** (e.g., `teach-mou-esign`).
2. Use **Add file → Upload files** and drag in every file from this project, preserving the `netlify/functions/` folder. Commit.

### 4. Deploy on Netlify
1. **netlify.com → Add new site → Import an existing project**, pick your GitHub repo.
2. Build settings: leave **Build command** blank; **Publish directory** = `.` (already set in `netlify.toml`). Deploy.
3. Open **Site settings → Environment variables** and add everything from `.env.example`:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** key |
   | `SENDGRID_API_KEY` | your SendGrid key |
   | `FROM_EMAIL` | a verified SendGrid sender, e.g. `noreply@teach-usa.com` |
   | `FROM_NAME` | e.g. `#TEACH Partnerships` |
   | `APP_BASE_URL` | your live site URL, e.g. `https://teach-mou.netlify.app` (no trailing slash) |
   | `SENDER_ACCESS_CODE` | *(optional)* a staff code to gate the create screen; leave blank to disable |
   | `ADMIN_ACCESS_CODE` | *(optional)* a code to unlock the MOU Library at `?admin`; leave blank to keep the library disabled |

4. **Deploys → Trigger deploy → Deploy site** so the new variables take effect.

Done. Visit your site URL and you'll land on the **create** screen.

---

## How to use it

- **Prepare & send:** open the site, fill in **Program details**, **Pricing schedule**, your name/email, and the district recipient's name/email → **Send for Signature**. The district gets an email; you get a confirmation with a **status link**.
- **District signs:** they click the link, complete their info, draw or type a signature, check the consent box, and click **Sign & Send Signed Copy**. The signed PDF is emailed to both parties.
- **Check status:** the status link (`?status=…`) shows whether the district has signed.
- **MOU Library (admin):** visit `/index.html?admin` (or click **MOU Library →** on the create screen) and enter your `ADMIN_ACCESS_CODE`. The library lists every sent and signed MOU with search and a status filter. Signed agreements download as a PDF in one click, or grab them all at once with **Download all signed (ZIP)**. For agreements still awaiting signature, **Copy link** copies that district's private signing URL, and **Send Reminder** re-emails the signing link to the district. Every row has a **Delete** action (for clearing test/sample records) that first offers to download a copy — the delete confirmation stays open after downloading so you can remove it in one more click. The library is only enabled once `ADMIN_ACCESS_CODE` is set.

## Signature authentication (DocuSign-style)

Every executed MOU is sealed like an industry e-signature platform:

- **Signature timestamps** — each signature shows the signer's printed name, title, email, the date/time with time zone (e.g. *July 1, 2026 • 2:43 PM EDT*), and the IP address used to sign, with a green ✓ verified check.
- **Authentication ribbon** — a blue "Digitally Authenticated" bar (with a lock) at the top of the signed document.
- **Certificate of Completion** — an appended final page with the Document ID, Agreement ID, dates created/completed, all signers (name, title, email, timestamp, IP), authentication status, the SHA-256 integrity fingerprint, a public verification URL, and a full audit trail (created → sent → reminders → signed → completed).
- **Footer** — *Electronically Signed & Verified · Powered by the #TEACH Digital Signature Platform*.
- **Tamper detection & independent verification** — at signing, a SHA-256 hash of the executed agreement is computed and stored. Anyone can open the verification URL (`/index.html?verify=<Document ID>`), and the browser independently recomputes the hash from the stored record and compares. A match shows a green **Document Authenticated** banner; any change to the stored agreement produces a different hash and shows a red **Authentication Failed** banner, with the ribbon and certificate flipping to an invalid state.

> **Required migration for existing deployments:** this feature adds two columns. Run this once in the Supabase SQL Editor:
> ```sql
> alter table public.mou_documents
>   add column if not exists audit jsonb not null default '[]'::jsonb,
>   add column if not exists integrity_hash text;
> ```
> Verification uses `crypto.subtle`, which browsers only expose over HTTPS — your Netlify site is HTTPS, so this works in production automatically.



---

## Field ownership (who fills what)

**You (#TEACH) complete:** State (dropdown — the five #TEACH states first, then all others) · Effective date · the five pricing figures. Optionally, you can also pre-fill the **district name and address** if you already know them; leave them blank and the district completes them at signing. The State value fills the single "State of ___" reference in the Background section; all other program language is fixed in this MOU version.

**The district completes:** District/Partner name · Address · Authorized signer name · Signer title · Electronic signature. District name, address, and signer name are required. If you pre-filled the name and address, they appear ready but remain editable. The signing date is captured automatically.

---

## Assumptions & notes (flagged)

- **Fixed values kept as-is from the source MOU:** this revised version hard-codes the previously state-specific language — "Initial Teacher Certification/License," "State Department of Education," "the state mandated years of teaching," "Initial Teaching Certificates/Licenses," and "the state required content and/or pedagogy test/exam" — exactly as it appears in the uploaded document. The only fillable body reference is "State of ___" in the *Background* section. The SPED Course Fee ($225), SPED Endorsement Add-On ($500), the withdrawal-fee schedule, the June 30 2027 expiration, "Governing Law … State of Michigan," and the "Michigan Department of Education" reference in the *Educator Evaluation* clause are also kept exactly as written.
- **PDF generation** happens in the district's browser (html2pdf) and is posted to the server for emailing. This keeps the stack simple and avoids a paid PDF service. If you'd rather generate the PDF server-side (e.g., via PDFShift, which you've used before) for pixel-perfect control, that's a straightforward swap in `sign-mou.js`.
- **Security:** the Supabase table has RLS enabled with no public policies; only the server-side functions (service-role key) can read/write it. Signing links use long random tokens. The optional `SENDER_ACCESS_CODE` gates the create screen — set it if the site is public.
- **e-Signature standing:** this captures intent-to-sign, a consent checkbox, printed name/title, timestamp, and IP — appropriate for an MOU under E-SIGN/UETA. It is not a substitute for a certified e-signature vendor (DocuSign, etc.) if a counterparty later requires that specific chain of custody.
- **#TEACH's own signature** is pre-applied as the President/Founder block, consistent with the source document (which lists Dr. Kilgore as the fixed signatory). If you want #TEACH to also sign live per-agreement, that can be added as a second signing step.
