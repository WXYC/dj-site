"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("searchString") || "";
  const exclusive = searchParams.get("exclusive") === "true";
  const [tipsOpen, setTipsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Tubafrenzy's card catalog is a live search: results update as the DJ
  // types (300ms debounce, matching LiveSearchEngine). The query lives in the
  // URL so results stay shareable and survive reloads.
  const pushQuery = (raw: string, opts?: { exclusive?: boolean }) => {
    const params = new URLSearchParams();
    const trimmed = raw.trim();
    if (trimmed) {
      params.set("searchString", trimmed);
    }
    const wantExclusive = opts?.exclusive ?? exclusive;
    if (wantExclusive) {
      params.set("exclusive", "true");
    }
    const qs = params.toString();
    router.replace(qs ? `/dashboard/catalog?${qs}` : `/dashboard/catalog`);
  };

  const handleInput = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery(value), 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <>
      <div style={{ textAlign: "center" }}>
        <table
          cellPadding={10}
          border={0}
          style={{ width: "75%", margin: "0 auto", borderSpacing: "1px" }}
        >
          <tbody>
            <tr>
              <td style={{ textAlign: "center", verticalAlign: "top" }}>
                <span className="title">Search the&nbsp;&nbsp;</span>
                {/* unoptimized: see next.config.mjs images.unoptimized comment */}
                <Image
                  src="/img/wxyc-logo-classic.gif"
                  alt="WXYC logo"
                  width={148}
                  height={35}
                  unoptimized
                  priority
                  style={{ border: 0 }}
                />
                <span className="title">&nbsp;&nbsp;Library</span>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "center" }}>
                <span className="search-input-container">
                  <input
                    type="text"
                    autoCorrect="off"
                    id="searchInput"
                    name="searchString"
                    placeholder="Type to search 56,000+ releases..."
                    defaultValue={searchQuery}
                    ref={inputRef}
                    onChange={(e) => handleInput(e.target.value)}
                  />
                </span>
                <a
                  href="#"
                  id="searchInfoIcon"
                  title="Search tips"
                  onClick={(e) => {
                    e.preventDefault();
                    setTipsOpen(true);
                  }}
                >
                  ?
                </a>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "center" }}>
                <button
                  type="button"
                  id="browseExclusiveBtn"
                  className="browse-exclusive-btn"
                  onClick={() => {
                    if (inputRef.current) inputRef.current.value = "";
                    pushQuery("", { exclusive: true });
                  }}
                >
                  Browse Exclusive Albums
                </button>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "center", verticalAlign: "top" }}>
                <span id="messageArea" className="title">
                  &nbsp;
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {tipsOpen && (
        <div
          className="modal-overlay wxyc-flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTipsOpen(false);
          }}
        >
          <div className="modal-content smalltext">
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setTipsOpen(false)}
            >
              &times;
            </button>
            <h3 className="modal-title">Search Tips</h3>
            <ul>
              <li>Queries match against artist name and album/release title.</li>
              <li>Results are shown in order of relevance; closest matches first.</li>
              <li>
                Double quotes (&quot;&quot;) signify an exact phrase.{" "}
                <b>Example:</b> <em>&quot;jimmy carl black&quot;</em>
              </li>
              <li>
                All-caps Boolean operators like <b>AND</b>, <b>OR</b>, and{" "}
                <b>NOT</b> can be used. <b>Example:</b> <em>rolling NOT stones</em>
              </li>
              <li>
                An asterisk (*) can be used for wildcard matching.{" "}
                <b>Example:</b> <em>elect*</em>
              </li>
              <li>
                Click <b>Browse Exclusive Albums</b> to discover releases not
                available on streaming services.
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
