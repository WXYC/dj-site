import { describe, it, expect } from "vitest";
import {
  tokenize,
  resolve,
  parseDiscogsMarkup,
  stripDisambiguationSuffix,
  type ResolvedToken,
} from "./discogsMarkup";

/** Helper: extract display text from resolved tokens */
function textContent(tokens: ResolvedToken[]): string {
  return tokens
    .map((t) => {
      switch (t.type) {
        case "plainText": return t.text;
        case "artistLink": return t.displayName;
        case "labelName": return t.name;
        case "releaseLink": return t.title;
        case "masterLink": return t.title;
        case "bold": return t.content;
        case "italic": return t.content;
        case "underline": return t.content;
        case "urlLink": return t.content;
      }
    })
    .join("");
}

// MARK: - Artist Tag Tests

describe("Artist Tag Tests", () => {
  it("parses artist link with name", () => {
    const result = parseDiscogsMarkup("[a=The Beatles]");
    expect(textContent(result)).toBe("The Beatles");
  });

  it("parses artist link with special characters", () => {
    const result = parseDiscogsMarkup("[a=Guns N' Roses]");
    expect(textContent(result)).toBe("Guns N' Roses");
  });

  it("skips artist link by ID in sync mode", () => {
    const result = parseDiscogsMarkup("[a12345]");
    expect(textContent(result)).toBe("");
  });

  it("skips artist link with large ID", () => {
    const result = parseDiscogsMarkup("[a9999999]");
    expect(textContent(result)).toBe("");
  });

  it("preserves text around artist ID link", () => {
    const result = parseDiscogsMarkup("See [a12345] for more");
    expect(textContent(result)).toBe("See  for more");
  });

  it("artist link has correct URL", () => {
    const result = parseDiscogsMarkup("[a=Test Artist]");
    const artistToken = result.find((t) => t.type === "artistLink");
    expect(artistToken).toBeDefined();
    if (artistToken?.type === "artistLink") {
      expect(artistToken.url).toContain("discogs.com/search");
      expect(artistToken.url).toContain("type=artist");
    }
  });
});

// MARK: - Bold Tag Tests

describe("Bold Tag Tests", () => {
  it("parses bold text", () => {
    const result = parseDiscogsMarkup("[b]bold text[/b]");
    expect(textContent(result)).toBe("bold text");
    expect(result).toContainEqual({ type: "bold", content: "bold text" });
  });

  it("parses bold text with surrounding content", () => {
    const result = parseDiscogsMarkup("This is [b]bold[/b] text");
    expect(textContent(result)).toBe("This is bold text");
  });

  it("skips orphaned bold closing tag", () => {
    const result = parseDiscogsMarkup("text [/b] more");
    expect(textContent(result)).toBe("text  more");
  });

  it("handles unclosed bold tag", () => {
    const result = parseDiscogsMarkup("[b]no closing tag");
    expect(textContent(result)).toBe("no closing tag");
  });

  it("handles empty bold content", () => {
    const result = parseDiscogsMarkup("[b][/b]");
    expect(textContent(result)).toBe("");
  });
});

// MARK: - Italic Tag Tests

describe("Italic Tag Tests", () => {
  it("parses italic text", () => {
    const result = parseDiscogsMarkup("[i]italic text[/i]");
    expect(textContent(result)).toBe("italic text");
    expect(result).toContainEqual({ type: "italic", content: "italic text" });
  });

  it("parses italic text with surrounding content", () => {
    const result = parseDiscogsMarkup("This is [i]italic[/i] text");
    expect(textContent(result)).toBe("This is italic text");
  });

  it("skips orphaned italic closing tag", () => {
    const result = parseDiscogsMarkup("text [/i] more");
    expect(textContent(result)).toBe("text  more");
  });

  it("handles unclosed italic tag", () => {
    const result = parseDiscogsMarkup("[i]no closing tag");
    expect(textContent(result)).toBe("no closing tag");
  });
});

// MARK: - Underline Tag Tests

describe("Underline Tag Tests", () => {
  it("parses underlined text", () => {
    const result = parseDiscogsMarkup("[u]underlined text[/u]");
    expect(textContent(result)).toBe("underlined text");
    expect(result).toContainEqual({ type: "underline", content: "underlined text" });
  });

  it("parses underline text with surrounding content", () => {
    const result = parseDiscogsMarkup("This is [u]underlined[/u] text");
    expect(textContent(result)).toBe("This is underlined text");
  });

  it("skips orphaned underline closing tag", () => {
    const result = parseDiscogsMarkup("text [/u] more");
    expect(textContent(result)).toBe("text  more");
  });

  it("handles unclosed underline tag", () => {
    const result = parseDiscogsMarkup("[u]no closing tag");
    expect(textContent(result)).toBe("no closing tag");
  });
});

// MARK: - Label Tag Tests

describe("Label Tag Tests", () => {
  it("parses label link", () => {
    const result = parseDiscogsMarkup("[l=Blue Note Records]");
    expect(textContent(result)).toBe("Blue Note Records");
  });

  it("parses label link with special characters", () => {
    const result = parseDiscogsMarkup("[l=4AD]");
    expect(textContent(result)).toBe("4AD");
  });

  it("parses label link with surrounding text", () => {
    const result = parseDiscogsMarkup("Released on [l=Motown] in 1965");
    expect(textContent(result)).toBe("Released on Motown in 1965");
  });
});

// MARK: - URL Tag Tests

describe("URL Tag Tests", () => {
  it("parses URL link", () => {
    const result = parseDiscogsMarkup("[url=https://example.com]Click here[/url]");
    expect(textContent(result)).toBe("Click here");
    const urlToken = result.find((t) => t.type === "urlLink");
    expect(urlToken).toBeDefined();
    if (urlToken?.type === "urlLink") {
      expect(urlToken.href).toBe("https://example.com");
    }
  });

  it("handles URL without closing tag - shows URL", () => {
    const result = parseDiscogsMarkup("[url=https://example.com]orphaned");
    expect(textContent(result)).toBe("https://example.comorphaned");
  });

  it("handles invalid URL gracefully", () => {
    const result = parseDiscogsMarkup("[url=not a valid url]text[/url]");
    expect(textContent(result)).toBe("text");
  });

  it("parses URL with complex query string", () => {
    const result = parseDiscogsMarkup(
      "[url=https://example.com/path?query=value&other=123]Link[/url]",
    );
    expect(textContent(result)).toBe("Link");
    const urlToken = result.find((t) => t.type === "urlLink");
    if (urlToken?.type === "urlLink") {
      expect(urlToken.href).toBe("https://example.com/path?query=value&other=123");
    }
  });
});

// MARK: - ID-based Tag Tests

describe("ID-based Tag Tests", () => {
  it("skips release link by ID in sync mode", () => {
    expect(textContent(parseDiscogsMarkup("[r12345]"))).toBe("");
  });

  it("skips master link by ID in sync mode", () => {
    expect(textContent(parseDiscogsMarkup("[m123]"))).toBe("");
  });

  it("skips release link by ID with equals sign", () => {
    expect(textContent(parseDiscogsMarkup("[r=621811]"))).toBe("");
  });

  it("skips master link by ID with equals sign", () => {
    expect(textContent(parseDiscogsMarkup("[m=199386]"))).toBe("");
  });

  it("preserves text around release ID", () => {
    const result = parseDiscogsMarkup("See release [r99999] for details");
    expect(textContent(result)).toBe("See release  for details");
  });

  it("preserves text around master ID", () => {
    const result = parseDiscogsMarkup("Master [m456] version");
    expect(textContent(result)).toBe("Master  version");
  });
});

// MARK: - Edge Cases

describe("Edge Cases", () => {
  it("handles plain text without tags", () => {
    const result = parseDiscogsMarkup("Just plain text with no formatting");
    expect(textContent(result)).toBe("Just plain text with no formatting");
  });

  it("handles empty string", () => {
    const result = parseDiscogsMarkup("");
    expect(textContent(result)).toBe("");
  });

  it("handles multiple consecutive tags", () => {
    const result = parseDiscogsMarkup("[a=Artist A][a=Artist B][a=Artist C]");
    expect(textContent(result)).toBe("Artist AArtist BArtist C");
  });

  it("handles mixed tags and text", () => {
    const result = parseDiscogsMarkup(
      "Check out [a=The Beatles] on [l=Apple Records]!",
    );
    expect(textContent(result)).toBe("Check out The Beatles on Apple Records!");
  });

  it("handles nested formatting tags (raw content, no recursion)", () => {
    const result = parseDiscogsMarkup("[b]bold [i]and italic[/i][/b]");
    expect(textContent(result)).toBe("bold [i]and italic[/i]");
  });

  it("handles unclosed bracket", () => {
    const result = parseDiscogsMarkup("Text with [unclosed bracket");
    expect(textContent(result)).toBe("Text with [unclosed bracket");
  });

  it("handles unknown tags", () => {
    const result = parseDiscogsMarkup("[unknown]text[/unknown]");
    expect(textContent(result)).toBe("text");
  });

  it("handles real-world Discogs text", () => {
    const result = parseDiscogsMarkup(
      "Written by [a=John Lennon] and [a=Paul McCartney]. Released on [l=Apple Records] in 1969. See [r123456] for more info.",
    );
    expect(textContent(result)).toBe(
      "Written by John Lennon and Paul McCartney. Released on Apple Records in 1969. See  for more info.",
    );
  });

  it("handles text with only brackets", () => {
    const result = parseDiscogsMarkup("[]");
    expect(textContent(result)).toBe("");
  });

  it("handles deeply nested same-type tags", () => {
    const result = parseDiscogsMarkup("[b]outer [b]inner[/b] outer[/b]");
    expect(textContent(result)).toBe("outer [b]inner[/b] outer");
  });

  it("handles multiple different formatting in sequence", () => {
    const result = parseDiscogsMarkup(
      "[b]bold[/b] then [i]italic[/i] then [u]underline[/u]",
    );
    expect(textContent(result)).toBe("bold then italic then underline");
  });

  it("does not confuse url tag with u tag", () => {
    const result = parseDiscogsMarkup("[url=https://example.com]link[/url]");
    expect(textContent(result)).toBe("link");
    const urlToken = result.find((t) => t.type === "urlLink");
    expect(urlToken).toBeDefined();
    if (urlToken?.type === "urlLink") {
      expect(urlToken.href).toBeTruthy();
    }
  });
});

// MARK: - Token Type Verification

describe("Token Type Verification", () => {
  it("bold produces bold token", () => {
    const result = parseDiscogsMarkup("[b]text[/b]");
    expect(result.some((t) => t.type === "bold")).toBe(true);
  });

  it("italic produces italic token", () => {
    const result = parseDiscogsMarkup("[i]text[/i]");
    expect(result.some((t) => t.type === "italic")).toBe(true);
  });

  it("underline produces underline token", () => {
    const result = parseDiscogsMarkup("[u]text[/u]");
    expect(result.some((t) => t.type === "underline")).toBe(true);
  });

  it("URL produces urlLink token with href", () => {
    const result = parseDiscogsMarkup("[url=https://test.com]link[/url]");
    const urlToken = result.find((t) => t.type === "urlLink");
    expect(urlToken).toBeDefined();
    if (urlToken?.type === "urlLink") {
      expect(urlToken.href).toBe("https://test.com");
    }
  });

  it("plain text produces no special tokens", () => {
    const result = parseDiscogsMarkup("plain text");
    expect(result.every((t) => t.type === "plainText")).toBe(true);
  });
});

// MARK: - Utility Tests

describe("stripDisambiguationSuffix", () => {
  it("removes numeric suffix", () => {
    expect(stripDisambiguationSuffix("Artist (2)")).toBe("Artist");
    expect(stripDisambiguationSuffix("Artist (123)")).toBe("Artist");
  });

  it("preserves non-numeric parentheses", () => {
    expect(stripDisambiguationSuffix("Artist (Band)")).toBe("Artist (Band)");
    expect(stripDisambiguationSuffix("Level 42")).toBe("Level 42");
  });

  it("handles no suffix", () => {
    expect(stripDisambiguationSuffix("Artist")).toBe("Artist");
  });

  it("only strips trailing numeric parentheses", () => {
    expect(stripDisambiguationSuffix("Blink-182")).toBe("Blink-182");
    expect(stripDisambiguationSuffix("Test (Band)")).toBe("Test (Band)");
  });
});

// MARK: - Tokenizer Unit Tests

describe("tokenize", () => {
  it("tokenizes plain text", () => {
    const tokens = tokenize("hello world");
    expect(tokens).toEqual([{ type: "plainText", text: "hello world" }]);
  });

  it("tokenizes artist name tag", () => {
    const tokens = tokenize("[a=Autechre]");
    expect(tokens).toEqual([{ type: "artistName", name: "Autechre" }]);
  });

  it("tokenizes artist ID tag", () => {
    const tokens = tokenize("[a41]");
    expect(tokens).toEqual([{ type: "artistId", id: 41 }]);
  });

  it("tokenizes mixed content", () => {
    const tokens = tokenize("By [a=Rob Brown] and [a=Sean Booth]");
    expect(tokens).toHaveLength(4);
    expect(tokens[0]).toEqual({ type: "plainText", text: "By " });
    expect(tokens[1]).toEqual({ type: "artistName", name: "Rob Brown" });
    expect(tokens[2]).toEqual({ type: "plainText", text: " and " });
    expect(tokens[3]).toEqual({ type: "artistName", name: "Sean Booth" });
  });
});

// MARK: - Resolve Unit Tests

describe("resolve", () => {
  it("resolves artist name to artist link", () => {
    const tokens = tokenize("[a=Autechre]");
    const resolved = resolve(tokens);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].type).toBe("artistLink");
    if (resolved[0].type === "artistLink") {
      expect(resolved[0].displayName).toBe("Autechre");
    }
  });

  it("strips disambiguation suffix from artist names", () => {
    const tokens = tokenize("[a=Salamanda (8)]");
    const resolved = resolve(tokens);
    if (resolved[0].type === "artistLink") {
      expect(resolved[0].displayName).toBe("Salamanda");
    }
  });

  it("drops ID-only tokens in sync mode", () => {
    const tokens = tokenize("[a41]");
    const resolved = resolve(tokens);
    expect(resolved).toHaveLength(0);
  });
});
