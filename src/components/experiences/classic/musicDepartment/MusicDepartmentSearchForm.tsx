"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The search box from `mainmenu.jsp`, which submits `GET
 * searchCardCatalog`. Classic's card catalog is a live debounced search that
 * reads `searchString` from the URL, so this navigates to that screen with the
 * same parameter name rather than posting anywhere of its own.
 */
export default function MusicDepartmentSearchForm() {
  const router = useRouter();
  const [term, setTerm] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // An empty box carries no `searchString` at all, matching the JSP's GET.
    // Sending an empty one would put a query in the URL that the catalog then
    // has to tell apart from a real search for nothing.
    const trimmed = term.trim();
    const params = new URLSearchParams();
    if (trimmed) {
      params.set("searchString", trimmed);
    }
    const query = params.toString();

    router.push(query ? `/dashboard/catalog?${query}` : "/dashboard/catalog");
  };

  return (
    <form name="searchForm" onSubmit={handleSubmit}>
      <div style={{ textAlign: "center" }}>
        <table
          cellPadding={5}
          border={0}
          style={{ width: "75%", margin: "0 auto", borderSpacing: "1px" }}
        >
          <tbody>
            <tr>
              <td style={{ textAlign: "center", verticalAlign: "top" }}>
                <span className="title">Search for Artists &amp; Releases:</span>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "center" }}>
                <input
                  type="text"
                  name="searchString"
                  size={60}
                  autoCorrect="off"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                />
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: "center" }}>
                <input type="submit" value="&#160;&#160;Search!&#160;&#160;" />
                &nbsp;&nbsp;&nbsp;&nbsp;
                {/* type=reset matches the JSP, but the input is controlled, so
                    the native reset alone would leave React state holding the
                    old term. */}
                <input
                  type="reset"
                  value="Clear Box"
                  onClick={() => setTerm("")}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}
