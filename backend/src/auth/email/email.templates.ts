import { EmailMessage, EmailTemplate } from "./email.types";

function shell(title: string, body: string, cta?: { label: string; href: string }) {
  const safeCta = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;display:inline-block">${cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif"><main style="max-width:560px;margin:0 auto;padding:32px 20px"><h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;color:#07194f">RoleBrief</h1><section style="background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:28px"><h2 style="font-size:22px;line-height:1.3;margin:0 0 12px">${title}</h2>${body}${safeCta}<p style="font-size:13px;line-height:1.6;color:#64748b;margin:24px 0 0">This security email was sent by RoleBrief. If you did not request it, you can ignore it.</p></section></main></body></html>`;
}

export function buildAuthEmail(input: { template: EmailTemplate; to: string; frontendOrigin: string; token?: string; replyTo?: string }): EmailMessage {
  if (input.template === "verify-email") {
    const link = `${input.frontendOrigin}/verify-email?token=${encodeURIComponent(input.token ?? "")}`;
    return {
      to: input.to,
      subject: "Verify your RoleBrief email",
      replyTo: input.replyTo,
      text: `Verify your RoleBrief email by opening this secure link: ${link}`,
      html: shell(
        "Verify your email",
        "<p style=\"font-size:16px;line-height:1.6;color:#334155;margin:0\">Confirm this address to activate your RoleBrief account.</p>",
        { label: "Verify email", href: link }
      )
    };
  }

  if (input.template === "reset-password") {
    const link = `${input.frontendOrigin}/reset-password?token=${encodeURIComponent(input.token ?? "")}`;
    return {
      to: input.to,
      subject: "Reset your RoleBrief password",
      replyTo: input.replyTo,
      text: `Reset your RoleBrief password by opening this secure link: ${link}`,
      html: shell(
        "Reset your password",
        "<p style=\"font-size:16px;line-height:1.6;color:#334155;margin:0\">Use this short-lived link to choose a new password.</p>",
        { label: "Reset password", href: link }
      )
    };
  }

  return {
    to: input.to,
    subject: "Your RoleBrief password changed",
    replyTo: input.replyTo,
    text: "Your RoleBrief password was changed. If this was not you, start password recovery immediately.",
    html: shell(
      "Your password changed",
      "<p style=\"font-size:16px;line-height:1.6;color:#334155;margin:0\">Your RoleBrief password was changed. If this was not you, start password recovery immediately.</p>"
    )
  };
}
