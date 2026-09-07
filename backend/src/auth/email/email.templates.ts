import { EmailMessage, EmailTemplate } from "./email.types";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailShell(options: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
  securityNotice: string;
}): string {
  const ctaBlock = options.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 20px 0;">
        <tr>
          <td style="border-radius:8px;background-color:#4f46e5;text-align:center;">
            <a href="${options.cta.href}" style="background-color:#4f46e5;border:1px solid #4f46e5;border-radius:8px;color:#ffffff;display:inline-block;font-size:14px;font-weight:600;line-height:1;padding:14px 24px;text-align:center;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${escapeHtml(options.cta.label)}</a>
          </td>
        </tr>
      </table>
      <div style="margin-top:20px;padding:12px 14px;background-color:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;word-break:break-all;">
        <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Button not working? Copy and paste this URL into your browser:</p>
        <a href="${options.cta.href}" style="font-size:12px;color:#4f46e5;text-decoration:underline;font-family:Consolas,Monaco,monospace;line-height:1.4;">${escapeHtml(options.cta.href)}</a>
      </div>
    `
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;width:100%;background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:0 auto;text-align:left;">
          <!-- Wordmark Header -->
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-family:'Newsreader',Georgia,serif;font-size:26px;font-weight:700;letter-spacing:-0.5px;color:#07194f;">Role<span style="font-weight:400;color:#0ea5e9;">Brief</span></span>
            </td>
          </tr>
          <!-- Main Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px 28px;box-shadow:0 1px 3px 0 rgba(0,0,0,0.05);">
                <tr>
                  <td>
                    <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;line-height:1.3;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${escapeHtml(options.title)}</h1>
                    <div style="font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${options.body}
                    </div>
                    ${ctaBlock}
                    <p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:13px;line-height:1.5;color:#64748b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${escapeHtml(options.securityNotice)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;font-size:12px;line-height:1.5;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0;">This security email was generated automatically by RoleBrief.</p>
              <p style="margin:4px 0 0 0;">If you didn't create an account or initiate this action, you can safely ignore this message.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAuthEmail(input: {
  template: EmailTemplate;
  to: string;
  frontendOrigin: string;
  token?: string;
  replyTo?: string;
}): EmailMessage {
  if (input.template === "verify-email") {
    const link = `${input.frontendOrigin}/verify-email?token=${encodeURIComponent(input.token ?? "")}`;
    const title = "Verify your email address";
    const securityNotice = "This verification link is valid for 24 hours. For security reasons, unconsumed links expire automatically.";

    return {
      to: input.to,
      subject: "Verify your RoleBrief email",
      replyTo: input.replyTo,
      text: `Verify your RoleBrief email address\n\nThank you for joining RoleBrief. Please confirm your email address to activate your account and start receiving your curated daily briefings and smart alerts.\n\nVerify using this link:\n${link}\n\n${securityNotice}\n\nIf you did not create a RoleBrief account, you can safely ignore this email.`,
      html: emailShell({
        title,
        body: `<p style="margin:0 0 12px 0;">Thank you for joining RoleBrief.</p><p style="margin:0;">Please confirm your email address to activate your account and access your personalized Radar briefing and smart alerts.</p>`,
        cta: { label: "Verify email address", href: link },
        securityNotice,
      }),
    };
  }

  if (input.template === "reset-password") {
    const link = `${input.frontendOrigin}/reset-password?token=${encodeURIComponent(input.token ?? "")}`;
    const title = "Reset your password";
    const securityNotice = "This password reset link will expire in 30 minutes and can only be used once. If you did not make this request, your account remains secure and you can ignore this email.";

    return {
      to: input.to,
      subject: "Reset your RoleBrief password",
      replyTo: input.replyTo,
      text: `Reset your RoleBrief password\n\nWe received a request to reset the password for your RoleBrief account (${input.to}). Use this secure link to choose a new password:\n${link}\n\n${securityNotice}`,
      html: emailShell({
        title,
        body: `<p style="margin:0 0 12px 0;">We received a request to reset the password for your RoleBrief account (<strong>${escapeHtml(input.to)}</strong>).</p><p style="margin:0;">Click the button below to choose a new, secure password (12+ characters).</p>`,
        cta: { label: "Reset password", href: link },
        securityNotice,
      }),
    };
  }

  const title = "Your password has been changed";
  const securityNotice = "If you made this change, no further action is required. If you did not change your password, please contact support or immediately reset your password.";

  return {
    to: input.to,
    subject: "Your RoleBrief password changed",
    replyTo: input.replyTo,
    text: `Your RoleBrief password changed\n\nThe password for your RoleBrief account (${input.to}) was recently updated. All previous active login sessions have been revoked for your security.\n\n${securityNotice}`,
    html: emailShell({
      title,
      body: `<p style="margin:0 0 12px 0;">The password for your RoleBrief account (<strong>${escapeHtml(input.to)}</strong>) was recently updated.</p><p style="margin:0;">All previous active login sessions for your account have been revoked for your security.</p>`,
      securityNotice,
    }),
  };
}
