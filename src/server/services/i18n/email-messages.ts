import { defaultLocale, type Locale } from "@/config/i18n";

type EmailTemplate = { subject: string; body: string };
type EmailMessages = Record<string, EmailTemplate>;

const cache = new Map<Locale, Promise<EmailMessages>>();

function loadEmailMessages(locale: Locale): Promise<EmailMessages> {
  let promise = cache.get(locale);
  if (!promise) {
    promise = import(`../../../../messages/${locale}/email.json`).then(
      (mod) => mod.default ?? mod
    );
    cache.set(locale, promise);
  }
  return promise;
}

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? params[key] : match
  );
}

/**
 * Server-only email template resolver — deliberately separate from next-intl's
 * React-bound `getTranslations`/`useTranslations`, since email sending happens
 * outside any request render tree (background-ish service calls, no React context
 * to read a "current locale" from). Falls back to English on a missing locale file
 * or missing key, same "never blank/undefined" guarantee as the page-rendering
 * fallback in src/i18n/messages.ts (requirement §27, §32).
 */
export async function resolveEmailTemplate(
  locale: Locale,
  key: string,
  params: Record<string, string> = {}
): Promise<EmailTemplate> {
  let messages: EmailMessages;
  try {
    messages = await loadEmailMessages(locale);
  } catch {
    messages = {};
  }

  let template = messages[key];
  if (!template && locale !== defaultLocale) {
    template = (await loadEmailMessages(defaultLocale))[key];
  }
  if (!template) {
    return { subject: key, body: key };
  }

  return {
    subject: interpolate(template.subject, params),
    body: interpolate(template.body, params),
  };
}
