/*
 * Outgoing email over SMTP. Any provider works: Gmail or Google Workspace with
 * an app password, Zoho, Resend, SendGrid, Mailgun, Brevo -- they all speak SMTP.
 * Settings come from the environment (see .env.example). When SMTP is not
 * configured, nothing is sent and callers fall back to showing the admin the
 * message so they can send it by hand.
 */
import nodemailer from 'nodemailer';

let transport = null;
let testTransport = null;

export function mailConfigured() {
  return Boolean(testTransport || (process.env.SMTP_HOST && process.env.MAIL_FROM));
}

function getTransport() {
  if (testTransport) return testTransport;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      disableFileAccess: true,
      disableUrlAccess: true,
      // Fail fast rather than leave an admin waiting on an unreachable server.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transport;
}

/** Sends one message. Throws if mail is not configured or the server refuses it. */
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) throw new Error('mail_not_configured');
  await getTransport().sendMail({
    from: process.env.MAIL_FROM || 'Vong <no-reply@localhost>',
    to,
    // A title typed by a seller must never become an extra header line.
    subject: subject.replace(/[\r\n]+/g, ' '),
    text,
    html,
  });
}

/** Tests pass an object with a sendMail(message) method. Never used by the app. */
export function setMailTransportForTests(value) {
  testTransport = value;
}
