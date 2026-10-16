import DOMPurify from 'dompurify';

export const decodeEntities = (html: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  return textarea.value;
};

export const sanitizeHtml = (html: string, decode = false) => {
  const content = decode ? decodeEntities(html) : html;
  
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe') {
      const src = node.getAttribute('src') || '';
      const allowedDomains = ['youtube.com', 'youtube-nocookie.com', 'player.vimeo.com', 'drive.google.com'];
      if (!allowedDomains.some(domain => src.includes(domain))) {
        node.parentNode?.removeChild(node);
      }
    }
  });

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'img', 'iframe', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['style', 'src', 'alt', 'class', 'allowfullscreen', 'data-video', 'contenteditable', 'frameborder', 'width', 'height'],
  });
};

export const normalizeHtml = (html: string): string => {
  if (!html) return '<p><br></p>';
  
  if (!/<(p|div|ul|ol|li|br)/i.test(html)) {
    const lines = html.split('\n');
    return lines
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<p><br></p>';
        return `<p>${trimmed}</p>`;
      })
      .join('');
  }
  
  return html;
};
