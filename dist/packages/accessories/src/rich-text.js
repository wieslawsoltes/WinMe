/** Preserve supported WordPad formatting without loading active external content. */
export function sanitizeRichText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const node of doc.querySelectorAll(
    'script,iframe,object,embed,link,style,meta,base,form,input,button,svg,math,video,audio,source',
  ))
    node.remove();
  const styles = new Set([
    'color',
    'background-color',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'text-decoration',
    'text-align',
    'line-height',
    'margin',
    'margin-left',
    'margin-right',
    'margin-top',
    'margin-bottom',
    'padding',
    'border',
    'border-collapse',
    'vertical-align',
    'list-style-type',
  ]);
  for (const node of doc.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name === 'style') {
        for (const property of Array.from(node.style))
          if (
            !styles.has(property) ||
            /url\s*\(|expression\s*\(|@import/i.test(node.style.getPropertyValue(property))
          )
            node.style.removeProperty(property);
      } else if (
        name === 'src' &&
        node.tagName === 'IMG' &&
        /^data:image\/(png|jpeg|gif|bmp|webp);base64,[a-z0-9+/=\s]+$/i.test(attribute.value)
      ) {
        // Embedded raster pictures are part of the document, including after reopen.
      } else if (
        ![
          'color',
          'face',
          'size',
          'width',
          'height',
          'colspan',
          'rowspan',
          'align',
          'alt',
        ].includes(name)
      )
        node.removeAttribute(attribute.name);
    }
  }
  return doc.body;
}
