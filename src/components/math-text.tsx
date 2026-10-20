"use client";
import katex from "katex";
export function MathText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
        part.startsWith("$") && part.endsWith("$") ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.slice(1, -1), {
                throwOnError: false,
                trust: false,
                strict: "ignore",
              }),
            }}
          />
        ) : part.startsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : part.startsWith("*") ? (
          <em key={i}>{part.slice(1, -1)}</em>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
