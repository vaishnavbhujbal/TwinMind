/**
 * Minimal markdown renderer for chat messages.
 *
 * Handles what our prompts actually produce: headings (h1-h3), horizontal
 * rules, bold, italic, inline code, fenced code blocks, bullet lists, and
 * paragraph breaks. No external library — we keep the surface small.
 *
 * Output is a plain HTML string. The caller sets it via dangerouslySetInnerHTML
 * after we escape user-provided text to prevent XSS.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(escaped: string): string {
  let out = escaped;

  // Inline code: `code`
  out = out.replace(/`([^`\n]+)`/g, (_m, code) => {
    return `<code class="px-1 py-0.5 rounded bg-bg-card text-[0.85em] font-mono">${code}</code>`;
  });

  // Bold: **bold**
  out = out.replace(/\*\*([^\n*][^\n]*?)\*\*/g, (_m, inner) => {
    return `<strong class="font-semibold">${inner}</strong>`;
  });

  // Italic: *italic* (avoid matching ** by using negative lookbehind/ahead)
  out = out.replace(/(^|[^*])\*(?!\*)([^\n*]+)\*(?!\*)/g, (_m, before, inner) => {
    return `${before}<em class="italic">${inner}</em>`;
  });

  return out;
}

export function renderMarkdown(src: string): string {
  if (!src) return "";

  const escaped = escapeHtml(src);
  const lines = escaped.split("\n");

  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rule: "---", "***", or "___" (at least 3)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(`<hr class="my-3 border-border" />`);
      i++;
      continue;
    }

    // Headings: # / ## / ### / #### (up to 4, enough for chat)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = renderInline(headingMatch[2]);
      // Scale sizes down (chat bubbles shouldn't have massive h1s):
      // h1 -> text-base, h2 -> text-sm font-semibold, h3 -> font-semibold,
      // h4 -> font-medium. All match chat body size or smaller.
      const sizeClass =
        level === 1
          ? "text-base font-semibold"
          : level === 2
          ? "text-sm font-semibold"
          : level === 3
          ? "text-sm font-semibold"
          : "text-sm font-medium";
      blocks.push(`<div class="${sizeClass} mt-3 mb-1">${text}</div>`);
      i++;
      continue;
    }

    // Fenced code block: ```lang ... ```
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        `<pre class="my-2 p-2 rounded bg-bg-card border border-border overflow-x-auto"><code class="text-[0.85em] font-mono whitespace-pre">${codeLines.join("\n")}</code></pre>`,
      );
      continue;
    }

    // Bullet list: lines starting with "- ", "* ", or "• "
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        const indentMatch = lines[i].match(/^(\s*)[-*•]\s+(.*)$/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        const text = indentMatch ? indentMatch[2] : lines[i];
        const padClass =
          indent >= 4 ? "ml-8" : indent >= 2 ? "ml-4" : "";
        items.push(`<li class="${padClass}">${renderInline(text)}</li>`);
        i++;
      }
      blocks.push(
        `<ul class="my-2 space-y-1 list-disc list-inside">${items.join("")}</ul>`,
      );
      continue;
    }

    // Blank line
    if (trimmed === "") {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^#{1,4}\s+/.test(lines[i].trim()) &&
      !/^\s*[-*•]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      `<p class="my-2 leading-relaxed">${renderInline(paraLines.join(" "))}</p>`,
    );
  }

  return blocks.join("");
}