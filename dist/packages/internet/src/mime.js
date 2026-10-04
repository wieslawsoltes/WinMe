/** UTF-8 MIME messages, including binary attachments. No network transport. */
const clean = (value) => String(value ?? '').replace(/[\r\n]/g, ' ');
const bytesToBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
};
const base64Bytes = (value) =>
  Uint8Array.from(atob(value.replace(/\s/g, '')), (c) => c.charCodeAt(0));
const lines = (value) => value.match(/.{1,76}/g)?.join('\r\n') ?? '';
const encodeText = (value) => bytesToBase64(new TextEncoder().encode(value));
const header = (value) =>
  /^[\x20-\x7e]*$/.test(clean(value)) ? clean(value) : `=?UTF-8?B?${encodeText(clean(value))}?=`;
const normalizeLines = (value) => String(value ?? '').replace(/\r\n|\r|\n/g, '\r\n');

export function encodeMessage(message, readAttachment) {
  const boundary = 'millennium_' + crypto.randomUUID().replaceAll('-', '');
  const attachments = message.attachments ?? [];
  const headers = [
    `From: ${clean(message.from)}`,
    `To: ${clean(message.to)}`,
    `Subject: ${header(message.subject)}`,
    `Date: ${new Date(message.date ?? Date.now()).toUTCString()}`,
    'MIME-Version: 1.0',
  ];
  const textPart =
    'Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' +
    lines(encodeText(normalizeLines(message.body)));
  if (!attachments.length) return headers.join('\r\n') + '\r\n' + textPart + '\r\n';
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts = [textPart];
  for (const attachment of attachments) {
    const data = readAttachment?.(attachment) ?? attachment;
    if (!(data.bytes instanceof Uint8Array))
      throw new Error(
        `The attachment “${attachment.name}” is missing. Restore or remove it before exporting.`,
      );
    const name = clean(attachment.name).replace(/["\\]/g, '_');
    const fallback = name.replace(/[^\x20-\x7e]/g, '_');
    parts.push(
      `Content-Type: ${clean(data.mime || 'application/octet-stream')}\r\nContent-Disposition: attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}\r\nContent-Transfer-Encoding: base64\r\n\r\n${lines(bytesToBase64(data.bytes))}`,
    );
  }
  return (
    headers.join('\r\n') +
    '\r\n\r\n' +
    parts.map((part) => `--${boundary}\r\n${part}\r\n`).join('') +
    `--${boundary}--\r\n`
  );
}

function decodeHeader(value = '') {
  return value.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, charset, encoding, text) => {
    try {
      const bytes =
        encoding.toLowerCase() === 'b' ? base64Bytes(text) : quotedBytes(text.replaceAll('_', ' '));
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return text;
    }
  });
}
function quotedBytes(text) {
  const joined = text.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === '=' && /^[0-9a-f]{2}$/i.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(joined.charCodeAt(i) & 255);
  }
  return new Uint8Array(bytes);
}
function parsePart(raw) {
  const at = raw.search(/\r?\n\r?\n/);
  if (at < 0) return { headers: {}, body: raw };
  const headers = {};
  for (const line of raw
    .slice(0, at)
    .replace(/\r?\n[ \t]+/g, ' ')
    .split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i >= 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }
  return { headers, body: raw.slice(at).replace(/^\r?\n\r?\n/, '') };
}
const parameter = (value, key) =>
  new RegExp('(?:^|;)\\s*' + key + '\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))', 'i')
    .exec(value ?? '')
    ?.slice(1)
    .find(Boolean);

export function decodeMessage(raw) {
  if (raw.length > 64 * 1024 * 1024)
    throw new Error('This message exceeds the 64 MB import limit.');
  const root = parsePart(raw),
    attachments = [],
    texts = [];
  const visit = (part, depth = 0) => {
    if (depth > 8) throw new Error('This MIME message is nested too deeply.');
    const type = part.headers['content-type'] ?? 'text/plain';
    if (/^multipart\//i.test(type)) {
      const boundary = parameter(type, 'boundary');
      if (!boundary) throw new Error('Multipart message has no boundary.');
      const sections = part.body.split('--' + boundary).slice(1);
      for (const section of sections) {
        if (section.startsWith('--')) break;
        visit(parsePart(section.replace(/^\r?\n/, '').replace(/\r?\n$/, '')), depth + 1);
      }
      return;
    }
    const encoding = part.headers['content-transfer-encoding']?.toLowerCase();
    const bytes =
      encoding === 'base64'
        ? base64Bytes(part.body)
        : encoding === 'quoted-printable'
          ? quotedBytes(part.body)
          : new TextEncoder().encode(part.body);
    const disposition = part.headers['content-disposition'] ?? '';
    let name = parameter(disposition, 'filename') ?? parameter(type, 'name');
    const extended = parameter(disposition, 'filename\\*');
    if (extended) {
      try {
        name = decodeURIComponent(extended.replace(/^[^']*'[^']*'/, ''));
      } catch {}
    }
    if (name || /^attachment/i.test(disposition))
      attachments.push({
        name: decodeHeader(name || 'Attachment'),
        mime: type.split(';')[0],
        bytes,
      });
    else if (/^text\/plain/i.test(type)) {
      let decoder;
      try {
        decoder = new TextDecoder(parameter(type, 'charset') ?? 'utf-8');
      } catch {
        decoder = new TextDecoder();
      }
      texts.push(decoder.decode(bytes).replaceAll('\r\n', '\n'));
    } else if (/^text\/html/i.test(type) && !texts.length)
      texts.push(
        new TextDecoder()
          .decode(bytes)
          .replace(/<br\s*\/?>|<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replaceAll('&nbsp;', ' ')
          .replaceAll('&lt;', '<')
          .replaceAll('&gt;', '>')
          .replaceAll('&amp;', '&'),
      );
  };
  visit(root);
  return {
    from: decodeHeader(root.headers.from ?? ''),
    to: decodeHeader(root.headers.to ?? ''),
    subject: decodeHeader(root.headers.subject ?? ''),
    date: Date.parse(root.headers.date) || Date.now(),
    body: texts.join('\n'),
    attachments,
  };
}
