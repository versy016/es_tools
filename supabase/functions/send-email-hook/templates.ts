// Branded HTML for every ES Tools transactional auth email. One layout, per-action
// copy. Kept table-based with inline styles for broad email-client compatibility.

const BRAND = {
    name: 'ES Tools',
    org: 'Engineering Surveys',
    ink: '#1B2230',
    yellow: '#F5A623',
    page: '#F3EFE7',
    card: '#FFFFFF',
    text: '#2A2A2A',
    muted: '#6B7280',
};

// A big tappable primary button (bulletproof-ish for Outlook via padding on the <a>).
const button = (label: string, url: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="border-radius:999px;background:${BRAND.yellow};">
      <a href="${url}" target="_blank"
         style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;
                font-size:15px;font-weight:bold;color:${BRAND.ink};text-decoration:none;border-radius:999px;">
        ${label}
      </a>
    </td></tr>
  </table>`;

// Page wrapper: dark header wordmark, white card, muted footer + fallback link.
const layout = ({ preheader, heading, bodyHtml, fallbackUrl }: {
    preheader: string; heading: string; bodyHtml: string; fallbackUrl?: string;
}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${BRAND.page};">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;">
        <tr><td style="padding:8px 4px 18px;">
          <img src="https://estools.com.au/images/ES_Logo_white_background.png" alt="Engineering Surveys" width="200" style="display:block;border:0;height:auto;max-width:200px;">
        </td></tr>
        <tr><td style="background:${BRAND.card};border-radius:16px;padding:32px 30px;
                       box-shadow:0 8px 30px rgba(27,34,48,.08);font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:${BRAND.ink};">${heading}</h1>
          <div style="font-size:15px;line-height:1.6;color:${BRAND.text};">${bodyHtml}</div>
          ${fallbackUrl ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${fallbackUrl}" style="color:${BRAND.muted};word-break:break-all;">${fallbackUrl}</a>
          </p>` : ''}
        </td></tr>
        <tr><td style="padding:20px 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.muted};">
          Sent by ${BRAND.name} · ${BRAND.org} Pty Ltd.<br>
          If you weren't expecting this email you can safely ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

// Map a Supabase email_action_type to a subject + branded HTML body.
// `link` is the verification URL; `token` is the 6-digit OTP (used for reauth).
export function buildEmail(
    actionType: string,
    ctx: { link: string; token: string; email: string },
): { subject: string; html: string; text: string } {
    const { link, token } = ctx;

    switch (actionType) {
        case 'invite':
            return {
                subject: 'You’ve been invited to ES Tools',
                text: `You've been invited to ES Tools. Set up your account: ${link}`,
                html: layout({
                    preheader: 'Set up your ES Tools account.',
                    heading: 'You’ve been invited to ES Tools',
                    fallbackUrl: link,
                    bodyHtml: `<p style="margin:0 0 8px;">You’ve been invited to join <strong>ES Tools</strong>, the Engineering Surveys field-reporting platform.</p>
                        <p style="margin:0;">Click below to accept the invite and set your password.</p>
                        ${button('Set up your account', link)}`,
                }),
            };
        case 'signup':
            return {
                subject: 'Confirm your ES Tools email',
                text: `Confirm your email to finish creating your ES Tools account: ${link}`,
                html: layout({
                    preheader: 'Confirm your email to finish setting up ES Tools.',
                    heading: 'Confirm your email',
                    fallbackUrl: link,
                    bodyHtml: `<p style="margin:0;">Thanks for signing up to <strong>ES Tools</strong>. Confirm your email address to activate your account.</p>
                        ${button('Confirm email address', link)}`,
                }),
            };
        case 'recovery':
            return {
                subject: 'Reset your ES Tools password',
                text: `Reset your ES Tools password: ${link}`,
                html: layout({
                    preheader: 'Choose a new password for ES Tools.',
                    heading: 'Reset your password',
                    fallbackUrl: link,
                    bodyHtml: `<p style="margin:0;">We received a request to reset the password for your <strong>ES Tools</strong> account. Click below to choose a new one. This link expires in 1 hour.</p>
                        ${button('Choose a new password', link)}
                        <p style="margin:0;font-size:13px;color:${BRAND.muted};">Didn’t request this? You can ignore this email — your password won’t change.</p>`,
                }),
            };
        case 'magiclink':
            return {
                subject: 'Your ES Tools sign-in link',
                text: `Sign in to ES Tools: ${link}`,
                html: layout({
                    preheader: 'Your one-time sign-in link for ES Tools.',
                    heading: 'Sign in to ES Tools',
                    fallbackUrl: link,
                    bodyHtml: `<p style="margin:0;">Click below to sign in to <strong>ES Tools</strong>. This link is single-use and expires shortly.</p>
                        ${button('Sign in', link)}`,
                }),
            };
        case 'email_change':
        case 'email_change_new':
            return {
                subject: 'Confirm your new ES Tools email',
                text: `Confirm your new email address for ES Tools: ${link}`,
                html: layout({
                    preheader: 'Confirm your new ES Tools email address.',
                    heading: 'Confirm your new email',
                    fallbackUrl: link,
                    bodyHtml: `<p style="margin:0;">Confirm this address to make it the new sign-in email for your <strong>ES Tools</strong> account.</p>
                        ${button('Confirm email change', link)}`,
                }),
            };
        case 'reauthentication':
            return {
                subject: 'Your ES Tools verification code',
                text: `Your ES Tools verification code is ${token}`,
                html: layout({
                    preheader: 'Your ES Tools verification code.',
                    heading: 'Your verification code',
                    bodyHtml: `<p style="margin:0 0 8px;">Enter this code in <strong>ES Tools</strong> to confirm it’s you:</p>
                        <div style="font-size:30px;letter-spacing:6px;font-weight:bold;color:${BRAND.ink};margin:16px 0;">${token}</div>
                        <p style="margin:0;font-size:13px;color:${BRAND.muted};">This code expires shortly. If you didn’t request it, ignore this email.</p>`,
                }),
            };
        default:
            return {
                subject: 'ES Tools notification',
                text: `Open ES Tools: ${link}`,
                html: layout({
                    preheader: 'An ES Tools account notification.',
                    heading: 'ES Tools',
                    fallbackUrl: link,
                    bodyHtml: `<p style="margin:0;">Please confirm this action on your ES Tools account.</p>${button('Continue', link)}`,
                }),
            };
    }
}
