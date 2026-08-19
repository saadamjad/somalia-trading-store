import type { CMSBlock } from "@/lib/validations/cms";

interface PageRendererProps {
  blocks: unknown;
}

/**
 * Renders a `CMSPage.body` block array. Every block field is interpolated as plain
 * React text — `{block.text}`, `{block.question}`, etc. — never through
 * `dangerouslySetInnerHTML` or any markdown-to-HTML step. React escapes text node
 * content by default, so this is the entire XSS defense for CMS page content: there is
 * no code path here capable of turning stored text into executable markup, regardless
 * of what an admin (or a compromised admin account) submits. See the `CMSPage` schema
 * comment in prisma/schema.prisma for the full design rationale.
 *
 * `blocks` is typed `unknown` because it comes straight off `CMSPage.body` (a Prisma
 * `Json` column) — anything that isn't a recognized, well-formed block (per
 * `cmsBlockSchema`) is silently skipped rather than rendered or thrown on, so a
 * corrupt/legacy row can't break the page.
 */
export function PageRenderer({ blocks }: PageRendererProps) {
  if (!Array.isArray(blocks)) return null;

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function renderBlock(block: unknown, index: number) {
  if (!isRecord(block) || typeof block.type !== "string") return null;

  switch (block.type as CMSBlock["type"]) {
    case "heading":
      if (typeof block.text !== "string") return null;
      return (
        <h2 key={index} className="font-display text-2xl font-bold md:text-3xl">
          {block.text}
        </h2>
      );
    case "paragraph":
      if (typeof block.text !== "string") return null;
      return (
        <p key={index} className="text-sm leading-relaxed text-muted md:text-base">
          {block.text}
        </p>
      );
    case "faqItem":
      if (typeof block.question !== "string" || typeof block.answer !== "string") return null;
      return (
        <div key={index} className="border-b border-border pb-6">
          <h3 className="font-display mb-2 text-lg font-semibold">{block.question}</h3>
          <p className="text-sm leading-relaxed text-muted md:text-base">{block.answer}</p>
        </div>
      );
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
