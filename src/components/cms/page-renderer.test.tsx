import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageRenderer } from "@/components/cms/page-renderer";

/**
 * XSS-safety proof (Phase 12 hard requirement). `PageRenderer` never uses
 * `dangerouslySetInnerHTML` — every block field is interpolated as plain React text.
 * Rendering to static HTML and asserting the malicious payload comes back
 * HTML-entity-escaped (not as a live `<script>`/`onerror` attribute) proves the
 * renderer cannot turn stored CMS content into executable markup, regardless of what
 * an admin (or compromised admin account) submitted.
 */
describe("PageRenderer — XSS safety", () => {
  const scriptPayload = "<script>alert(1)</script>";
  const onerrorPayload = '<img src=x onerror="alert(2)">';

  it("renders a <script> payload in a paragraph block as escaped, inert text", () => {
    const html = renderToStaticMarkup(
      <PageRenderer blocks={[{ type: "paragraph", text: scriptPayload }]} />
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script[^&]/);
  });

  it("renders an onerror/img payload in a heading block as escaped, inert text", () => {
    const html = renderToStaticMarkup(
      <PageRenderer blocks={[{ type: "heading", text: onerrorPayload }]} />
    );

    expect(html).not.toContain('<img src=x onerror="alert(2)">');
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("onerror=\"alert(2)\"");
  });

  it("renders a payload inside a faqItem's question/answer as escaped, inert text", () => {
    const html = renderToStaticMarkup(
      <PageRenderer
        blocks={[
          {
            type: "faqItem",
            question: scriptPayload,
            answer: onerrorPayload,
          },
        ]}
      />
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain('<img src=x onerror="alert(2)">');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("silently skips a malformed/unrecognized block instead of rendering or throwing", () => {
    const html = renderToStaticMarkup(
      <PageRenderer
        blocks={[
          { type: "not-a-real-block", html: "<script>alert(3)</script>" },
        ]}
      />
    );

    expect(html).not.toContain("alert(3)");
  });

  it("renders normal, non-malicious content correctly", () => {
    const html = renderToStaticMarkup(
      <PageRenderer
        blocks={[
          { type: "heading", text: "Frequently Asked Questions" },
          { type: "paragraph", text: "Here is some safe copy." },
          { type: "faqItem", question: "Do you deliver?", answer: "Yes, contact us." },
        ]}
      />
    );

    expect(html).toContain("Frequently Asked Questions");
    expect(html).toContain("Here is some safe copy.");
    expect(html).toContain("Do you deliver?");
    expect(html).toContain("Yes, contact us.");
  });
});
