/**
 * INPUT: code content string, optional fileName for language detection
 * OUTPUT: syntax-highlighted code view or rendered markdown
 * POSITION: shared preview component used in skill detail, file viewer etc.
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

// Transparent background theme
const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'transparent',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
  },
};

interface CodePreviewProps {
  content: string;
  fileName?: string;
  showLineNumbers?: boolean;
  wordWrap?: boolean;
}

// File extension to language mapping
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  html: 'html', css: 'css', scss: 'scss', less: 'less', json: 'json',
  py: 'python', java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
  php: 'php', c: 'c', cpp: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin',
  yml: 'yaml', yaml: 'yaml', xml: 'xml', toml: 'toml', ini: 'ini',
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell',
  sql: 'sql', md: 'markdown', mdx: 'markdown',
};

/** Detect language from file extension */
function detectLanguage(fileName?: string): string | null {
  if (!fileName) return null;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? EXTENSION_LANGUAGE_MAP[ext] || null : null;
}

/** Check if file is markdown */
function isMarkdownFile(fileName?: string): boolean {
  if (!fileName) return false;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext === 'md' || ext === 'mdx';
}

/** Check if content looks like HTML */
function looksLikeHtml(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('<!DOCTYPE') ||
         trimmed.startsWith('<html') ||
         (trimmed.startsWith('<') && trimmed.includes('</'));
}

/** Line wrapper props for CSS counter line numbers */
function getLineProps(lineNumber: number): Record<string, unknown> {
  return {
    'data-line-number': lineNumber,
    style: { display: 'block' },
  };
}

/** Render code with syntax highlighting */
export const CodePreview: React.FC<CodePreviewProps> = ({
  content,
  fileName,
  showLineNumbers = true,
  wordWrap = true
}) => {
  const { isMarkdown, language } = useMemo(() => {
    const md = isMarkdownFile(fileName);
    let lang = detectLanguage(fileName);
    if (!lang && looksLikeHtml(content)) lang = 'html';
    return { isMarkdown: md, language: lang };
  }, [content, fileName]);

  if (isMarkdown) {
    return (
      <div className="markdown-container p-4">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const codeContent = String(children).replace(/\n$/, '');
              if (!match) {
                return <code className={className} {...props}>{children}</code>;
              }
              return (
                <SyntaxHighlighter
                  style={customTheme}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0, padding: '12px', borderRadius: '6px',
                    fontSize: '13px', background: '#1D273F',
                  }}
                >
                  {codeContent}
                </SyntaxHighlighter>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // CSS classes for line numbers + word wrap control
  const wrapClass = wordWrap ? 'code-preview--wrap' : '';
  const lineNumClass = showLineNumbers ? 'code-preview--line-numbers' : '';

  return (
    <div className={`code-preview w-full ${wrapClass} ${lineNumClass}`}>
      <SyntaxHighlighter
        style={customTheme}
        language={language || 'text'}
        showLineNumbers={false}
        wrapLines
        lineProps={getLineProps}
        customStyle={{
          margin: 0, padding: '16px',
          fontSize: '13px', lineHeight: '1.6',
          background: 'transparent',
          counterReset: 'line',
        }}
        codeTagProps={{ style: { background: 'transparent' } }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodePreview;
