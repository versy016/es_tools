# ES Tools — Supabase Auth email templates (branded)

Paste-ready HTML for the built-in Supabase Auth email templates, so they match ES
Tools branding while still being sent through your **custom Auth SMTP** (Gmail). No
edge function / Send Email Hook needed for this — just the dashboard.

## How to use

For each file below: **Authentication → Emails → Templates → (the template)** →
set the **Subject**, then paste the file's contents into the **Message body (source/HTML)**
→ **Save**.

| Dashboard template | Paste this file | Subject |
|---|---|---|
| Confirm sign up | [`confirm-signup.html`](confirm-signup.html) | `Confirm your ES Tools email` |
| Invite user | [`invite-user.html`](invite-user.html) | `You've been invited to ES Tools` |
| Magic link or OTP | [`magic-link.html`](magic-link.html) | `Your ES Tools sign-in link` |
| Change email address | [`change-email.html`](change-email.html) | `Confirm your new ES Tools email` |
| Reset password | [`reset-password.html`](reset-password.html) | `Reset your ES Tools password` |
| Reauthentication | [`reauthentication.html`](reauthentication.html) | `Your ES Tools verification code` |

## Notes

- These use Supabase's template variables (`{{ .ConfirmationURL }}`, `{{ .Token }}`).
  Supabase fills them in; the link already points at the right verify + redirect URL.
- The **Invite** link lands users on `/reset-password` to set a password — that redirect
  is set by the `admin-users` function (SITE_URL / the inviting origin), so add
  `https://estools.com.au/reset-password` to **Auth → URL Configuration → Redirect URLs**.
- If you ever enabled the **Send Email Hook**, turn it OFF (Authentication → Hooks) so
  Supabase uses THESE templates + your Auth SMTP instead of the edge function.
- The `send-email-hook` function in `supabase/functions/` is now unused with this
  approach — safe to leave parked or delete later.
