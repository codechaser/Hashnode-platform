import ReactMarkdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import supportedLanguages from "react-syntax-highlighter/dist/esm/languages/prism/supported-languages.js";

SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("c++", cpp);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("sh", bash);

function MarkdownRenderer({ content = "" }) {
  return (
    <ReactMarkdown
      skipHtml={true}
      components={{
        code({ className, children, inline, ...props }) {
          const language = /language-([\w-+]+)/.exec(className || "")?.[1];
          const code = String(children).replace(/\n$/, "");

          if (inline) {
            return <code className="markdown-inline-code" {...props}>{code}</code>;
          }

          if (!className) {
            return (
              <pre className="markdown-code-fallback">
                <code>{code}</code>
              </pre>
            );
          }

          const normalizedLanguage = language && language.toLowerCase();
          const supportedLanguage = normalizedLanguage && supportedLanguages.includes(normalizedLanguage);

          if (!normalizedLanguage || !supportedLanguage) {
            return (
              <pre className="markdown-code-fallback">
                <code>{code}</code>
              </pre>
            );
          }

          return (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={normalizedLanguage}
              PreTag="pre"
              className="markdown-code-block"
              customStyle={{ margin: 0, overflowX: "auto" }}
              showLineNumbers={false}
              wrapLongLines={true}
              {...props}
            >
              {code}
            </SyntaxHighlighter>
          );
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default MarkdownRenderer;