/**
 * Parses Discogs markup to structured tokens for rendering.
 *
 * Follows the same 3-phase architecture as the iOS DiscogsMarkupParser:
 * 1. Tokenize — parse markup into a flat token list
 * 2. Resolve — resolve ID-based tokens (sync mode skips them)
 * 3. Render — convert tokens to a renderable format
 *
 * Supported formats:
 * - `[a=Artist Name]` — artist link (displays the artist name)
 * - `[a12345]` — artist link by ID (skipped in sync mode)
 * - `[l=Label Name]` — label link (displays the label name)
 * - `[b]text[/b]` — bold text
 * - `[i]text[/i]` — italic text
 * - `[u]text[/u]` — underlined text
 * - `[url=http://example.com]Link Text[/url]` — URL link
 * - `[r12345]` or `[r=12345]` — release link by ID (skipped in sync mode)
 * - `[m123]` or `[m=123]` — master link by ID (skipped in sync mode)
 */

// MARK: - Token Types

export type DiscogsToken =
  | { type: "plainText"; text: string }
  | { type: "artistName"; name: string }
  | { type: "artistId"; id: number }
  | { type: "releaseId"; id: number }
  | { type: "masterId"; id: number }
  | { type: "labelName"; name: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "underline"; content: string }
  | { type: "url"; href: string; content: string };

export type ResolvedToken =
  | { type: "plainText"; text: string }
  | { type: "artistLink"; displayName: string; url: string }
  | { type: "labelName"; name: string }
  | { type: "releaseLink"; title: string; url: string }
  | { type: "masterLink"; title: string; url: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "underline"; content: string }
  | { type: "urlLink"; href: string | null; content: string };

// MARK: - Tag Patterns

const ARTIST_NAME_PATTERN = /^a=(.+)$/;
const ARTIST_ID_PATTERN = /^a(\d+)$/;
const RELEASE_ID_PATTERN = /^r=?(\d+)$/;
const MASTER_ID_PATTERN = /^m=?(\d+)$/;
const LABEL_NAME_PATTERN = /^l=(.+)$/;
const URL_OPEN_PATTERN = /^url=(.+)$/;
const CLOSING_TAG_PATTERN = /^\/(.+)$/;

// MARK: - Phase 1: Tokenize

/**
 * Finds a closing tag like [/tag] in the remaining text, handling same-type
 * nesting via depth tracking. Returns the content between tags and the index
 * after the closing tag, or null if not found.
 */
function findClosingTag(
  text: string,
  startIndex: number,
  tag: string,
): { content: string; endIndex: number } | null {
  let searchStart = startIndex;
  let depth = 1;

  while (searchStart < text.length) {
    const openBracket = text.indexOf("[", searchStart);
    if (openBracket === -1) break;

    const closeBracket = text.indexOf("]", openBracket);
    if (closeBracket === -1) break;

    const tagContent = text.slice(openBracket + 1, closeBracket);

    if (tagContent === tag) {
      depth += 1;
    } else if (tagContent === `/${tag}`) {
      depth -= 1;
      if (depth === 0) {
        const content = text.slice(startIndex, openBracket);
        return { content, endIndex: closeBracket + 1 };
      }
    }

    searchStart = closeBracket + 1;
  }

  return null;
}

export function tokenize(text: string): DiscogsToken[] {
  const tokens: DiscogsToken[] = [];
  let pos = 0;

  while (pos < text.length) {
    const bracketIndex = text.indexOf("[", pos);
    if (bracketIndex === -1) {
      tokens.push({ type: "plainText", text: text.slice(pos) });
      break;
    }

    // Add plain text before the bracket
    if (bracketIndex > pos) {
      tokens.push({ type: "plainText", text: text.slice(pos, bracketIndex) });
    }

    // Find closing bracket
    const closingBracket = text.indexOf("]", bracketIndex);
    if (closingBracket === -1) {
      tokens.push({ type: "plainText", text: text.slice(bracketIndex) });
      break;
    }

    const tagContent = text.slice(bracketIndex + 1, closingBracket);
    pos = closingBracket + 1;

    if (tagContent.length === 0) continue;

    // Classify the tag
    const token = classifyTag(tagContent, text, pos);
    if (token) {
      tokens.push(token.token);
      pos = token.newPos;
    }
    // Unknown/orphaned/empty tags are silently skipped
  }

  return tokens;
}

function classifyTag(
  tag: string,
  fullText: string,
  posAfterTag: number,
): { token: DiscogsToken; newPos: number } | null {
  let match: RegExpMatchArray | null;

  // Artist name: [a=Name]
  match = tag.match(ARTIST_NAME_PATTERN);
  if (match) {
    return { token: { type: "artistName", name: match[1] }, newPos: posAfterTag };
  }

  // Artist ID: [a12345]
  match = tag.match(ARTIST_ID_PATTERN);
  if (match) {
    return { token: { type: "artistId", id: parseInt(match[1], 10) }, newPos: posAfterTag };
  }

  // Release ID: [r12345] or [r=12345]
  match = tag.match(RELEASE_ID_PATTERN);
  if (match) {
    return { token: { type: "releaseId", id: parseInt(match[1], 10) }, newPos: posAfterTag };
  }

  // Master ID: [m123] or [m=123]
  match = tag.match(MASTER_ID_PATTERN);
  if (match) {
    return { token: { type: "masterId", id: parseInt(match[1], 10) }, newPos: posAfterTag };
  }

  // Label name: [l=Name]
  match = tag.match(LABEL_NAME_PATTERN);
  if (match) {
    return { token: { type: "labelName", name: match[1] }, newPos: posAfterTag };
  }

  // URL: [url=...]...[/url]
  match = tag.match(URL_OPEN_PATTERN);
  if (match) {
    const href = match[1];
    const closing = findClosingTag(fullText, posAfterTag, "url");
    if (closing) {
      return {
        token: { type: "url", href, content: closing.content },
        newPos: closing.endIndex,
      };
    }
    // No closing tag — show URL and remaining text combined
    const remaining = fullText.slice(posAfterTag);
    return {
      token: { type: "plainText", text: href + remaining },
      newPos: fullText.length,
    };
  }

  // Formatting tags: [b]...[/b], [i]...[/i], [u]...[/u]
  if (tag === "b" || tag === "i" || tag === "u") {
    const closing = findClosingTag(fullText, posAfterTag, tag);
    if (closing) {
      const tokenType = tag === "b" ? "bold" : tag === "i" ? "italic" : "underline";
      return {
        token: { type: tokenType, content: closing.content },
        newPos: closing.endIndex,
      };
    }
    // Unclosed tag — skip the tag, content becomes plain text
    return null;
  }

  // Orphaned closing tags — skip
  if (CLOSING_TAG_PATTERN.test(tag)) {
    return null;
  }

  // Unknown tag — skip
  return null;
}

// MARK: - Phase 2: Resolve

/** Removes Discogs disambiguation suffix like " (8)" from artist names. */
export function stripDisambiguationSuffix(name: string): string {
  return name.replace(/ \(\d+\)$/, "");
}

export function resolve(tokens: DiscogsToken[]): ResolvedToken[] {
  return tokens.flatMap((token): ResolvedToken[] => {
    switch (token.type) {
      case "plainText":
        return [{ type: "plainText", text: token.text }];

      case "artistName": {
        const displayName = stripDisambiguationSuffix(token.name);
        const encoded = encodeURIComponent(token.name);
        const url = `https://www.discogs.com/search/?q=${encoded}&type=artist`;
        return [{ type: "artistLink", displayName, url }];
      }

      case "labelName":
        return [{ type: "labelName", name: token.name }];

      case "bold":
        return [{ type: "bold", content: token.content }];

      case "italic":
        return [{ type: "italic", content: token.content }];

      case "underline":
        return [{ type: "underline", content: token.content }];

      case "url":
        return [{ type: "urlLink", href: token.href, content: token.content }];

      // ID-based tokens are skipped in sync mode (no resolver)
      case "artistId":
      case "releaseId":
      case "masterId":
        return [];
    }
  });
}

// MARK: - Public API

/** Parses Discogs markup and returns resolved tokens for rendering. */
export function parseDiscogsMarkup(text: string): ResolvedToken[] {
  return resolve(tokenize(text));
}
