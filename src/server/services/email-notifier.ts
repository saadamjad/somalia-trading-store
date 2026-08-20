/**
 * Stubbed email notifier — NOT a real email integration. Per docs/DECISIONS.md D-011
 * (which defers to D-010's original email-provider blocker), no SMTP/email-provider
 * has been chosen yet, so this logs what WOULD be sent instead of actually sending
 * anything. This mirrors the exact interim pattern `authService.requestPasswordReset`
 * already established for password-reset links (src/server/services/auth-service.ts).
 *
 * Called from `notificationService.notify()` (the in-app-notification email echo, used
 * by order-service.ts, refund-request-service.ts, and quote-service.ts) and directly
 * from `authService.requestPasswordReset` (a pre-auth flow with no signed-in session to
 * attach an in-app Notification to, so it calls this stub directly rather than through
 * `notificationService.notify()`). Swap this function's body for a real provider call
 * (Resend/SES/Postmark/SendGrid) once one is chosen, and every caller keeps working
 * unchanged.
 */
export const emailNotifier = {
  async send(to: string, subject: string, body: string): Promise<void> {
    // Server-side console log only — never exposed to any client. Intentionally the
    // entire implementation until an email provider is chosen (D-010/D-011).
    console.log(`[email-notifier] would send email to ${to}: ${subject}\n${body}`);
  },
};
