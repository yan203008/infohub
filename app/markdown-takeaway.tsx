import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownTakeaway({ value }: { value: string }) {
  return <section className="markdown-takeaway">
    <SafeMarkdown value={value} />
  </section>;
}

export function MarkdownArticle({
  value,
  renderParagraph,
}: {
  value: string;
  renderParagraph?: (paragraph: { children: ReactNode; text: string; key: string }) => ReactNode;
}) {
  return <div className="markdown-article article-body">
    <SafeMarkdown value={value} renderParagraph={renderParagraph} />
  </div>;
}

function nodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(value)) return nodeText(value.props.children);
  return "";
}

function SafeMarkdown({
  value,
  renderParagraph,
}: {
  value: string;
  renderParagraph?: (paragraph: { children: ReactNode; text: string; key: string }) => ReactNode;
}) {
  let paragraphIndex = 0;
  return <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    skipHtml
    components={{
      a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
      p: ({ children, node }) => {
        const key = `markdown:${node?.position?.start.offset ?? paragraphIndex++}`;
        return renderParagraph ? renderParagraph({ children, text: nodeText(children), key }) : <p>{children}</p>;
      },
    }}
  >{value}</ReactMarkdown>;
}
