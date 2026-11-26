// The bulletin's Markdown, by react-markdown with remark-gfm: raw HTML stays off, and our own components
// do links, tables, headings and the small marks (docs/plan-phase6.md). The text comes from the web
// through Codex, so nothing in it becomes HTML.
import { Children, isValidElement, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sectionId } from '../bulletin.js';
import styles from './BulletinMarkdown.module.css';

/** The text of what React would render. */
export function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

const TAG = /(\[(?:kapanış|seans|vadeli|piyasa|spot|banka|teorik|beklenti|gösterge)[^\]]*\])|(\bYorum:)/gi;

/** Price tags as small grey labels, "Yorum:" in Claude's orange. */
function marks(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child;
    const parts: ReactNode[] = [];
    let at = 0;
    for (const found of child.matchAll(TAG)) {
      parts.push(child.slice(at, found.index));
      parts.push(
        found[1] ? (
          <span key={found.index} className={styles.tag}>
            {found[1].slice(1, -1)}
          </span>
        ) : (
          <span key={found.index} className={styles.comment}>
            {found[2]}
          </span>
        ),
      );
      at = found.index + found[0].length;
    }
    parts.push(child.slice(at));
    return parts;
  });
}

/** A number in a cell: aligned right, with its sign's colour. */
function cellKind(text: string): 'up' | 'down' | 'num' | null {
  const t = text.trim();
  if (!/^[+−-]?[%$₺]?\s?\d[\d.,]*\s?[%$₺]?(\s|$)/.test(t)) return null;
  if (t.startsWith('+')) return 'up';
  if (t.startsWith('−') || t.startsWith('-')) return 'down';
  return 'num';
}

const isWeb = (href: string | undefined): href is string => !!href && /^https?:\/\//i.test(href);

const COMPONENTS: Components = {
  h1: () => null,
  h2: ({ children }) => (
    <h2 id={sectionId(textOf(children))} className={styles.h2}>
      {textOf(children).replace(/^\d+[.)]\s*/, '')}
    </h2>
  ),
  h3: ({ children }) => <h3 className={styles.h3}>{marks(children)}</h3>,
  h4: ({ children }) => <h4 className={styles.h3}>{marks(children)}</h4>,
  p: ({ children }) => <p className={styles.p}>{marks(children)}</p>,
  li: ({ children }) => <li className={styles.li}>{marks(children)}</li>,
  a: ({ href, children }) =>
    isWeb(href) ? (
      <a className={styles.a} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: () => null,
  // The prices block is the bridge's; it never shows.
  pre: ({ children }) => (textOf(children).trimStart().startsWith('{"ticker"') ? null : <pre className={styles.pre}>{children}</pre>),
  table: ({ children }) => (
    // A swipe on a wide table scrolls it, and doesn't change the page.
    <div className={styles.tableFrame} data-no-swipe>
      <table className={styles.table}>{children}</table>
    </div>
  ),
  td: ({ children }) => {
    const kind = cellKind(textOf(children));
    return (
      <td className={styles.td} data-kind={kind ?? undefined}>
        {marks(children)}
      </td>
    );
  },
  th: ({ children }) => <th className={styles.th}>{children}</th>,
};

export function BulletinMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className={styles.markdown}>
      <Markdown remarkPlugins={[remarkGfm]} skipHtml components={COMPONENTS}>
        {markdown}
      </Markdown>
    </div>
  );
}
