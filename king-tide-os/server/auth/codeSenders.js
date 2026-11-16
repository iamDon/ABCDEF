// How sign-in codes reach a founder's inbox.
import nodemailer from 'nodemailer';

// Fallback when no mail server is configured: write the code to the server
// log, where only whoever operates the server can read it.
export const consoleCodeSender = async ({ email, code }) => {
  console.log(`[auth] Sign-in code for ${email}: ${code} (valid 10 minutes)`);
};

// Sends the code by email through any SMTP mailbox (for example the company's
// Zoho Mail account). The password stays on the server.
export function createSmtpCodeSender({ host, port, user, pass, from }, transportOptions = {}) {
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    ...transportOptions,
  });
  return async ({ email, name, code }) => {
    const firstName = String(name || '').split(' ')[0] || 'there';
    await transport.sendMail({
      from: `"King Tide OS" <${from}>`,
      to: email,
      subject: `${code} is your King Tide OS sign-in code`,
      text: `Hi ${firstName},\n\nYour King Tide OS sign-in code is ${code}\n\nIt works once and expires in 10 minutes. If you did not ask for it, you can ignore this email.\n\nKing Tide Concepts | Built for momentum.`,
      html: `<div style="font-family:Georgia,serif;color:#0d2b3e;background:#fdf8ec;padding:32px;border-radius:16px;max-width:480px">
<p style="font:14px Arial,sans-serif;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
<p style="font:14px Arial,sans-serif;margin:0 0 8px">Your King Tide OS sign-in code is</p>
<p style="font-size:40px;letter-spacing:8px;margin:0 0 16px;color:#00797d">${code}</p>
<p style="font:13px Arial,sans-serif;color:#4f6470;margin:0">It works once and expires in 10 minutes. If you did not ask for it, you can ignore this email.</p>
<p style="font:12px Arial,sans-serif;color:#4f6470;margin:24px 0 0">King Tide Concepts | Built for momentum.</p></div>`,
    });
  };
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
