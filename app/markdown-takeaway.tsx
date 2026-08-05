import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownTakeaway({ value }: { value: string }) {
  return <section className="markdown-takeaway">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{value}</ReactMarkdown>
  </section>;
}
