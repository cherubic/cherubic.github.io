import { visit } from 'unist-util-visit';

/**
 * Wraps every <pre> block in a .codeblock.variant-terminal div
 * with a chrome bar (language label + copy button).
 */
export function rehypeCodeblock() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !parent) return;

      const code = node.children?.find(c => c.tagName === 'code');
      const langClass = code?.properties?.className?.find?.(c => c.startsWith('language-'));
      const lang = langClass ? langClass.replace('language-', '') : '';

      const chromeDiv = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['codeblock-chrome'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['codeblock-lang'] },
            children: [{ type: 'text', value: lang }],
          },
          {
            type: 'element',
            tagName: 'button',
            properties: {
              className: ['codeblock-copy'],
              'data-copy': '',
              'aria-label': 'Copy code',
            },
            children: [{ type: 'text', value: 'copy' }],
          },
        ],
      };

      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['codeblock', 'variant-terminal'] },
        children: [chromeDiv, node],
      };

      parent.children.splice(index, 1, wrapper);
    });
  };
}
