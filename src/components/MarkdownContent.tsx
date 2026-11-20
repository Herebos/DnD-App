import { lazy, Suspense } from "react";

type MarkdownContentProps = {
  content: string;
  className?: string;
  compactLinks?: boolean;
};

const MarkdownRenderer = lazy(() => import("../MarkdownRenderer"));

export default function MarkdownContent(props: MarkdownContentProps) {
  const { content, className = "" } = props;
  return (
    <Suspense
      fallback={
        <div className={`markdown-content ${className}`.trim()}>{content}</div>
      }
    >
      <MarkdownRenderer {...props} />
    </Suspense>
  );
}

