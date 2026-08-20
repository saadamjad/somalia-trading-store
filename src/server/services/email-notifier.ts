/**
 * Stubbed email notifier — NOT a real email integration. Per docs/DECISIONS.md D-011
 * (which defers to D-010's original email-provider blocker), no SMTP/email-provider
 * has been chosen yet, so this logs what WOULD be sent instead of actually sending
 * anything. This mirrors the exact interim pattern `authService.requestPasswordReset`
 * already established for password-reset links (src/server/services/auth-service.ts).
 *
 * `notificationService.notify()` is the ONLY call site — swap this function's body for
 * a real provider call (Resend/SES/Postmark/SendGrid) once one is chosen, and every
 * caller (order-service.ts, refund-request-service.ts, quote-service.ts) keeps working
 * unchanged.
 */
export const emailNotifier = {
  async send(to: string, subject: string, body: string): Promise<void> {
    // Server-side console log only — never exposed to any client. Intentionally the
    // entire implementation until an email provider is chosen (D-010/D-011).
    console.log(`[email-notifier] would send email to ${to}: ${subject}\n${body}`);
  },
};
