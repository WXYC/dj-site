import { Link } from "@mui/joy";
import { type ReactNode } from "react";
import { parseDiscogsMarkup, type ResolvedToken } from "./discogsMarkup";

function renderToken(token: ResolvedToken, key: number): ReactNode {
  switch (token.type) {
    case "plainText":
      return <span key={key}>{token.text}</span>;

    case "artistLink":
      return (
        <Link
          key={key}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {token.displayName}
        </Link>
      );

    case "labelName":
      return <span key={key}>{token.name}</span>;

    case "releaseLink":
      return (
        <Link
          key={key}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {token.title}
        </Link>
      );

    case "masterLink":
      return (
        <Link
          key={key}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {token.title}
        </Link>
      );

    case "bold":
      return <strong key={key}>{token.content}</strong>;

    case "italic":
      return <em key={key}>{token.content}</em>;

    case "underline":
      return (
        <span key={key} style={{ textDecoration: "underline" }}>
          {token.content}
        </span>
      );

    case "urlLink":
      return token.href ? (
        <Link
          key={key}
          href={token.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {token.content}
        </Link>
      ) : (
        <span key={key}>{token.content}</span>
      );
  }
}

/** Renders Discogs markup as React elements with links and formatting. */
export default function DiscogsMarkup({ text }: { text: string }) {
  const tokens = parseDiscogsMarkup(text);
  return <>{tokens.map((token, i) => renderToken(token, i))}</>;
}
