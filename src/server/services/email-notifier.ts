import { Resend } from "resend";

/**
 * Real email delivery via Resend (D-010/D-011 resolved). This is the single
 * integration point every caller (order-service.ts, refund-request-service.ts,
 * quote-service.ts via notificationService.notify(), and auth-service.ts's
 * requestPasswordReset directly) already routes through — no call-site changes
 * were needed to wire in a real provider.
 *
 * Failures here must never fail the caller's underlying operation (an order must
 * still be created even if its confirmation email fails to send) — every call site
 * already treats this as fire-and-forget / wraps it, but `send` itself also never
 * throws: it logs and swallows, since a delivery failure has nothing useful for a
 * caller to react to synchronously.
 */
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL ?? "Somalia Trading Store <onboarding@resend.dev>";

const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

export const emailNotifier = {
  async send(to: string, subject: string, body: string): Promise<void> {
    if (!resendClient) {
      // No API key configured (e.g. local dev without .env.local set up) — fall back
      // to the original interim behavior instead of throwing, so the app still runs.
      console.error(`[email-notifier] RESEND_API_KEY not set — would send email to ${to}: ${subject}\n${body}`);
      return;
    }

    try {
      const { error } = await resendClient.emails.send({
        from: fromEmail,
        to,
        subject,
        text: body,
      });
      if (error) {
        console.error(`[email-notifier] Resend rejected email to ${to}: ${error.message}`);
      }
    } catch (err) {
      console.error(`[email-notifier] failed to send email to ${to}:`, err);
    }
  },
};
