import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkWikiLink from 'remark-wiki-link';
import { Link } from 'react-router-dom';

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-blue max-w-none">
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
            // Handle internal wiki links
            if (href?.startsWith('/note/')) {
              return <Link to={href} {...props}>{children}</Link>;
            }
            // Handle external links
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
