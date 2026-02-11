# Email Center – Not Receiving or Forwarding

Use this when **Email Center** is not showing inbound emails or forwards are not working.

## 1. Resend webhook (inbound)

- **URL** must be your **Supabase** Edge Function, not your app domain:
  - `https://<PROJECT_REF>.supabase.co/functions/v1/email-inbound`
- **Event**: enable **`email.received`** (required for receiving).
- **Signing secret**: in Supabase Edge Function secrets, set **`RESEND_WEBHOOK_SECRET`** (or `EMAIL_WEBHOOK_SECRET`) to the value from Resend (starts with `whsec_`).

See [RESEND_WEBHOOK_SETUP.md](./RESEND_WEBHOOK_SETUP.md) for step-by-step setup.

## 2. Edge Function secrets

In **Supabase** → **Edge Functions** → **email-inbound** → **Secrets**, ensure:

| Secret | Purpose |
|--------|--------|
| `RESEND_WEBHOOK_SECRET` or `EMAIL_WEBHOOK_SECRET` | Verify Resend webhook requests |
| `RESEND_API_KEY` | Fetch full email body (Resend only sends `email_id` in the webhook) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Used by the function (usually set globally) |

Without `RESEND_API_KEY`, the function can still store inbound emails but the body may be empty.

## 3. Mailboxes in the app

- In **Admin** → **Email Center** → **Manage Mailboxes**, create a mailbox whose **email address** is exactly the one you receive at (e.g. `support@pablobots.com`).
- Matching is **case-insensitive** and ignores display names (e.g. `Support <support@pablobots.com>` matches `support@pablobots.com`).
- Set the mailbox to **Active**. Inbound emails to that address will be stored and can be forwarded if **Forward to** is set.

## 4. Forwarding

- In **Manage Mailboxes**, set **Forward to** to the email that should receive copies (e.g. your personal address).
- The **email-inbound** function sends the forwarded email via the **admin-email** function using the service role. Ensure **admin-email** is deployed and has **`RESEND_API_KEY`** set so it can send.

## 5. Deploy and logs

- Deploy both functions:
  ```bash
  supabase functions deploy email-inbound
  supabase functions deploy admin-email
  ```
- In Supabase → **Edge Functions** → **email-inbound** → **Logs**, check for:
  - `📧 [email-inbound] Processing Resend email.received event`
  - `✅ Email saved to mailbox …` or `✅ Email saved (no matching mailbox)`
  - Any `❌` or `⚠️` lines (signature, Resend API, insert errors).

## 6. Behaviour after the latest fixes

- **Resend**: The webhook only sends `email_id`. The function now calls Resend’s API to fetch the full email (from, to, subject, html, text) when `RESEND_API_KEY` is set.
- **No matching mailbox**: Inbound emails are still stored with `mailbox_id` = null so they appear in Email Center. Add a mailbox for that address and future emails will be linked and can be forwarded.
- **Address matching**: Matching uses normalized addresses (lowercase, no display name), so `Support <support@pablobots.com>` matches a mailbox `support@pablobots.com`.

## Quick checklist

- [ ] Resend webhook URL = `https://<project>.supabase.co/functions/v1/email-inbound`
- [ ] Resend webhook event `email.received` enabled
- [ ] `RESEND_WEBHOOK_SECRET` (or `EMAIL_WEBHOOK_SECRET`) set in email-inbound secrets
- [ ] `RESEND_API_KEY` set in both **email-inbound** and **admin-email** secrets
- [ ] Mailbox created in Email Center with the receiving address, **Active**
- [ ] Domain verified in Resend for that address
- [ ] Forward to (optional): set in mailbox; admin-email deployed with `RESEND_API_KEY`
