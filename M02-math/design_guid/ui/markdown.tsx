"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { COLORS, RADIUS } from "@/styles/tokens";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, [remarkGfm, { breaks: true }]]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          // 标题组件
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-8 mb-4" style={{ color: COLORS.text }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-6 mb-3" style={{ color: COLORS.text }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-5 mb-2" style={{ color: COLORS.text }}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-4 mb-2" style={{ color: COLORS.text }}>{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-medium mt-3 mb-1" style={{ color: COLORS.text }}>{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-medium mt-2 mb-1" style={{ color: COLORS.text }}>{children}</h6>
          ),
          // 段落组件
          p: ({ children }) => (
            <p className="leading-relaxed mb-4" style={{ color: COLORS.text }}>{children}</p>
          ),
          // 换行组件
          br: (props) => <br {...props} />,
          // 水平线
          hr: () => <hr className="my-6" style={{ borderColor: COLORS.border }} />,
          // 强调
          strong: ({ children }) => (
            <strong style={{ color: COLORS.text }} className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ color: COLORS.text }} className="italic">{children}</em>
          ),
          // 删除线
          del: ({ children }) => (
            <del style={{ color: COLORS.textMuted }} className="line-through">{children}</del>
          ),
          // 上下标
          sub: ({ children }) => (
            <sub className="text-sm" style={{ color: COLORS.textMuted }}>{children}</sub>
          ),
          sup: ({ children }) => (
            <sup className="text-sm" style={{ color: COLORS.textMuted }}>{children}</sup>
          ),
          // 列表
          ul: ({ children }) => (
            <ul className="mb-4 list-disc list-inside space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal list-inside space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed" style={{ color: COLORS.text }}>{children}</li>
          ),
          // 引用
          blockquote: ({ children }) => (
            <blockquote
              className="pl-4 italic py-2 rounded-r mb-4"
              style={{
                borderLeft: `4px solid ${COLORS.primary}`,
                color: COLORS.textMuted,
                backgroundColor: COLORS.bgMuted,
              }}
            >
              {children}
            </blockquote>
          ),
          // 链接
          a: ({ node, href, children, ...props }) => {
            if (!href) return <>{children}</>;
            const isExternal = href.startsWith("http://") || href.startsWith("https://");
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="underline underline-offset-2 transition-colors"
                style={{ color: COLORS.primary }}
                {...props}
              >
                {children}
              </a>
            );
          },
          // 图片组件
          img: ({ node, alt, src, ...props }) => {
            if (!src) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={alt || "图片"}
                src={src}
                className="rounded-lg shadow-sm max-w-full h-auto my-4"
                loading="lazy"
                {...props}
              />
            );
          },
          // 代码
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded text-sm font-mono"
                  style={{
                    backgroundColor: COLORS.bgMuted,
                    color: COLORS.text,
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={codeClassName}
                style={{ color: COLORS.text }}
                {...props}
              >
                {children}
              </code>
            );
          },
          // 代码块
          pre: ({ children }) => (
            <pre
              className="p-4 overflow-x-auto mb-4 text-sm font-mono"
              style={{
                backgroundColor: COLORS.bgMuted,
                color: COLORS.text,
                borderRadius: RADIUS.sm,
              }}
            >
              {children}
            </pre>
          ),
          // 表格
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="border w-full" style={{ borderColor: COLORS.border }}>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead style={{ backgroundColor: COLORS.bgMuted }}>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b" style={{ borderColor: COLORS.border }}>{children}</tr>
          ),
          th: ({ children }) => (
            <th className="border px-4 py-2 text-left font-semibold" style={{ borderColor: COLORS.border, color: COLORS.text }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border px-4 py-2" style={{ borderColor: COLORS.border, color: COLORS.text }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
