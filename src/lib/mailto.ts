/**
 * `mailto:` with the subject and body already typed.
 *
 * Lines are joined with CRLF, which is what RFC 6068 asks for in a body
 * and what every mail client renders as a line break.
 */
export function mailto(email: string, subject: string, body: string[]): string {
  const query = new URLSearchParams({ subject, body: body.join('\r\n') });
  // URLSearchParams encodes a space as "+", which mail clients render
  // literally in a subject line. Only %20 is correct in a mailto query.
  return `mailto:${email}?${query.toString().replace(/\+/g, '%20')}`;
}
