import { Fragment } from "react";

/**
 * Renders one Halku message's text with light, safe structure — bullet and
 * numbered lists, and **bold** emphasis — so a coach-style answer can be
 * scanned in seconds instead of read as one paragraph. Never uses
 * dangerouslySetInnerHTML: everything is parsed into plain React elements
 * from a small, fixed set of line patterns.
 *
 * This is presentation only — it does not change, add to, or infer any
 * content. A response with none of these patterns (every current
 * respond.ts/Gemini answer today) renders exactly as a single paragraph,
 * identical to before this component existed.
 */
export function HalkuMessageContent({ text }: { text: string }) {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  type Block =
    | { kind: "paragraph"; text: string }
    | { kind: "bullets"; items: string[] }
    | { kind: "numbered"; items: string[] };

  const blocks: Block[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bulletMatch = /^[-•]\s+(.*)/.exec(line);
    const numberedMatch = /^\d+[.)]\s+(.*)/.exec(line);

    if (bulletMatch) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "bullets") last.items.push(bulletMatch[1] ?? "");
      else blocks.push({ kind: "bullets", items: [bulletMatch[1] ?? ""] });
    } else if (numberedMatch) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "numbered") last.items.push(numberedMatch[1] ?? "");
      else blocks.push({ kind: "numbered", items: [numberedMatch[1] ?? ""] });
    } else {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "paragraph") last.text += ` ${line}`;
      else blocks.push({ kind: "paragraph", text: line });
    }
  }

  return (
    <div className="space-y-1.5">
      {blocks.map((block, index) => {
        if (block.kind === "bullets") {
          return (
            <ul key={index} className="list-disc space-y-0.5 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "numbered") {
          return (
            <ol key={index} className="list-decimal space-y-0.5 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}

/** Splits on **bold** spans only — the one inline emphasis Halku's answers
 * (local or Gemini) might reasonably produce. Everything else stays plain
 * text, so there's no markup-injection surface. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
