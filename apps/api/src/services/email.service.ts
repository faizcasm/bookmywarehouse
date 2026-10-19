import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProviderAdapter {
  name: string;
  send(message: EmailMessage): Promise<{ delivered: boolean; detail: string }>;
}

class ResendAdapter implements EmailProviderAdapter {
  name = 'resend';

  async send(message: EmailMessage): Promise<{ delivered: boolean; detail: string }> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { delivered: false, detail: `Resend ${response.status}: ${body.slice(0, 200)}` };
    }
    return { delivered: true, detail: 'resend accepted' };
  }
}

/**
 * Development adapter: nothing is sent, the message is logged and the
 * unconfigured state is exposed through `describeEmailConfig()`.
 */
class LogOnlyAdapter implements EmailProviderAdapter {
  name = 'log-only';

  async send(message: EmailMessage): Promise<{ delivered: boolean; detail: string }> {
    logger.info('Email (not configured — logged instead)', {
      to: message.to,
      subject: message.subject,
    });
    return { delivered: false, detail: 'EMAIL_PROVIDER not configured; message logged only' };
  }
}

function resolveAdapter(): EmailProviderAdapter {
  if (config.email.provider === 'resend' && config.email.apiKey) return new ResendAdapter();
  return new LogOnlyAdapter();
}

const adapter = resolveAdapter();

export function describeEmailConfig(): { provider: string; configured: boolean } {
  return {
    provider: adapter.name,
    configured: adapter.name !== 'log-only',
  };
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    const result = await adapter.send(message);
    if (!result.delivered) {
      logger.warn('Email not delivered', { provider: adapter.name, detail: result.detail });
    }
  } catch (error) {
    logger.error('Email send failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function renderSimpleEmail(options: {
  heading: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  footer?: string;
}): string {
  const action = options.actionLabel
    ? `<p style="margin:24px 0"><a href="${options.actionUrl}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">${options.actionLabel}</a></p>`
    : '';
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 12px;font-size:20px">${options.heading}</h1>
    <p style="line-height:1.6;margin:0 0 8px">${options.body}</p>
    ${action}
    <p style="color:#64748b;font-size:12px;margin-top:32px">${options.footer ?? 'BookMyWarehouse — B2B storage, equipment and logistics marketplace.'}</p>
  </div>
</body></html>`;
}
