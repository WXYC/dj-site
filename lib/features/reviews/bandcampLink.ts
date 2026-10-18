/**
 * The Bandcamp link a promo arrived with, checked the way POST /intake checks `bandcamp_url`: `https`, on
 * `bandcamp.com` or a subdomain, no credentials, no whitespace, backslash or control character, at most 512
 * characters. The backend's 400 is the backstop; this keeps a link it would refuse from being sent.
 *
 * Returns the trimmed link, null when the field is blank (send no `bandcamp_url` key), or "refused". An edit of a
 * record's link (PATCH) must send the key only when the link changed.
 */
const MAX_LENGTH = 512;
const BANDCAMP_HOST = /(^|\.)bandcamp\.com$/i;

export function bandcampUrlFrom(text: string): string | null | "refused" {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  if (trimmed.length > MAX_LENGTH || /[\s\\\u0000-\u001f\u007f]/.test(trimmed)) {
    return "refused";
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || !BANDCAMP_HOST.test(url.hostname)) {
      return "refused";
    }
    return trimmed;
  } catch {
    return "refused";
  }
}
