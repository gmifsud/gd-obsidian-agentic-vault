import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkWikiLink from 'remark-wiki-link';
import { Link } from 'react-router-dom';

// Obsidian callout type mapping
const CALLOUT_TYPES: Record<string, { className: string; icon: string }> = {
  note: { className: 'callout-note', icon: '📝' },
  tip: { className: 'callout-tip', icon: '💡' },
  hint: { className: 'callout-tip', icon: '💡' },
  important: { className: 'callout-important', icon: '❗' },
  warning: { className: 'callout-warning', icon: '⚠️' },
  caution: { className: 'callout-warning', icon: '⚠️' },
  attention: { className: 'callout-warning', icon: '⚠️' },
  danger: { className: 'callout-danger', icon: '🔴' },
  error: { className: 'callout-danger', icon: '🔴' },
  bug: { className: 'callout-danger', icon: '🐛' },
  success: { className: 'callout-tip', icon: '✅' },
  check: { className: 'callout-tip', icon: '✅' },
  done: { className: 'callout-tip', icon: '✅' },
  question: { className: 'callout-info', icon: '❓' },
  help: { className: 'callout-info', icon: '❓' },
  faq: { className: 'callout-info', icon: '❓' },
  info: { className: 'callout-info', icon: 'ℹ️' },
  abstract: { className: 'callout-note', icon: '📋' },
  summary: { className: 'callout-note', icon: '📋' },
  tldr: { className: 'callout-note', icon: '📋' },
  example: { className: 'callout-note', icon: '📖' },
  quote: { className: 'callout-note', icon: '💬' },
  cite: { className: 'callout-note', icon: '💬' },
  todo: { className: 'callout-info', icon: '☑️' },
};

function preprocessCallouts(content: string): string {
  // Convert Obsidian-style callouts to HTML that ReactMarkdown can handle
  // > [!type] Title
  // > Content
  const lines = content.split('\n');
  const result: string[] = [];
  let inCallout = false;
  let calloutType = '';
  let calloutTitle = '';
  let calloutContent: string[] = [];

  function flushCallout() {
    if (inCallout) {
      const typeInfo = CALLOUT_TYPES[calloutType.toLowerCase()] || CALLOUT_TYPES.note;
      result.push(`<div class="callout ${typeInfo.className}">`);
      if (calloutTitle) {
        result.push(`<div class="callout-title">${typeInfo.icon} ${calloutTitle}</div>`);
      } else {
        result.push(`<div class="callout-title">${typeInfo.icon} ${calloutType}</div>`);
      }
      result.push('');
      result.push(calloutContent.join('\n'));
      result.push('');
      result.push('</div>');
      result.push('');
      inCallout = false;
      calloutContent = [];
    }
  }

  for (const line of lines) {
    const calloutMatch = line.match(/^>\s*\[!(\w+)\][-+]?\s*(.*)?$/);
    
    if (calloutMatch) {
      flushCallout();
      inCallout = true;
      calloutType = calloutMatch[1];
      calloutTitle = calloutMatch[2]?.trim() || '';
      continue;
    }

    if (inCallout) {
      if (line.startsWith('> ')) {
        calloutContent.push(line.slice(2));
      } else if (line.trim() === '>') {
        calloutContent.push('');
      } else {
        flushCallout();
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }
  
  flushCallout();
  return result.join('\n');
}

export function MarkdownViewer({ content }: { content: string }) {
  const processedContent = preprocessCallouts(content);

  return (
    <div className="prose prose-invert max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-a:text-[var(--color-right-hemisphere)] prose-a:no-underline hover:prose-a:underline prose-code:text-[var(--color-system)] prose-pre:bg-[var(--color-bg-primary)] prose-pre:border prose-pre:border-[var(--color-border)] prose-pre:rounded-xl prose-strong:text-[var(--color-text-primary)] prose-blockquote:border-[var(--color-border)] prose-hr:border-[var(--color-border)] prose-th:text-[var(--color-text-secondary)] prose-td:text-[var(--color-text-secondary)]">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          remarkFrontmatter,
          [remarkWikiLink, { 
            pageResolver: (name: string) => [name], 
            hrefTemplate: (permalink: string) => `/note/${encodeURIComponent(permalink)}` 
          }]
        ]}
        components={{
          a: ({ node, href, children, ...props }) => {
            if (href?.startsWith('/note/')) {
              return <Link to={href} {...props}>{children}</Link>;
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
          },
          // Task list checkboxes
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input 
                  type="checkbox" 
                  checked={checked} 
                  readOnly 
                  className="mr-2 accent-[var(--color-right-hemisphere)]"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          // Code blocks with styling
          code: ({ node, className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code 
                  className="bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded text-[0.85em] font-mono text-[var(--color-system)]" 
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Highlight ==text== (Obsidian syntax)
          em: ({ node, children, ...props }) => {
            return <em {...props}>{children}</em>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
