import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders a Cala markdown answer in the app's type scale. Links open in a new tab; images are not rendered. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="pt-1 text-[15px] font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="pt-1 text-[15px] font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="pt-1 text-sm font-semibold">{children}</h4>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50 text-left text-xs text-muted-foreground">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="border-t px-3 py-2">{children}</td>,
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
