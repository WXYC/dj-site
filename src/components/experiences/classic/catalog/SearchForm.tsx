"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { catalogSlice } from "@/lib/features/catalog/frontend";

export default function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const searchQuery = useAppSelector(catalogSlice.selectors.getSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = searchParams.get("searchString") || "";
    if (query) {
      dispatch(catalogSlice.actions.setSearchQuery(query));
    }
  }, [searchParams, dispatch]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchString = formData.get("searchString") as string;
    
    if (searchString && searchString.trim()) {
      dispatch(catalogSlice.actions.setSearchQuery(searchString.trim()));
      router.push(`/dashboard/catalog?searchString=${encodeURIComponent(searchString.trim())}`);
    } else {
      router.push(`/dashboard/catalog`);
    }
  };

  return (
    <>
      <form
        name="searchForm"
        method="GET"
        action="/dashboard/catalog"
        onSubmit={handleSubmit}
      >
        <div style={{ textAlign: "center" }}>
          <table cellPadding={5} cellSpacing={1} border={0} style={{ width: "75%" }} align="center">
            <tbody>
              <tr>
                <td align="center" valign="top">
                  <span className="title">Search the&nbsp;&nbsp;</span>
                  <img
                    src="/img/wxyc-logo-classic.gif"
                    alt="WXYC logo"
                    style={{ border: 0 }}
                  />
                  <span className="title">&nbsp;&nbsp;Library:</span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <input
                    type="text"
                    name="searchString"
                    size={60}
                    defaultValue={searchQuery}
                    ref={inputRef}
                  />
                </td>
              </tr>
              <tr>
                <td align="center">
                  <input
                    type="submit"
                    value="  Search the WXYC Library!  "
                  />
                  &nbsp;&nbsp;&nbsp;&nbsp;
                  <input
                    type="reset"
                    value="Clear Box"
                    onClick={() => {
                      dispatch(catalogSlice.actions.setSearchQuery(""));
                      if (inputRef.current) {
                        inputRef.current.value = "";
                      }
                    }}
                  />
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span className="text">56,000+ total releases in this database.</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>

      <p>&nbsp;</p>
      <div id="notes" className="smalltext" style={{ textAlign: "center" }}>
        <b>Tips for searching the WXYC Library:</b>
        <p>
          Queries will be matched against library releases based on artist name
          &amp; album/release title.
        </p>
        <p>
          Search results are shown in order of presumed relevance, such that
          "best"/closest matches are shown first.
        </p>
        <p>
          Double quotes("") signify an exact phrase, but in this new search
          implementation, exact phrases<br /> are no longer necessary to quickly
          find the best match. <b>Example:</b>{" "}
          <a href="/dashboard/catalog?searchString=%22jimmy+carl+black%22">
            "jimmy carl black"
          </a>{" "}
          vs.{" "}
          <a href="/dashboard/catalog?searchString=jimmy+carl+black">
            jimmy carl black
          </a>
          .
        </p>
        <p>
          All-caps Boolean operators like <b>AND</b>, <b>OR</b>, &amp;{" "}
          <b>NOT</b> can be used. <b>AND</b> &amp; <b>OR</b> won't yield
          significant<br />
          improvements over default behavior, but <b>NOT</b> can be very
          effective. <b>Example:</b>{" "}
          <a href="/dashboard/catalog?searchString=rolling+NOT+stones">
            rolling NOT stones
          </a>{" "}
          vs.{" "}
          <a href="/dashboard/catalog?searchString=rolling">rolling</a>.
        </p>
        <p>
          An asterisk(*) can be used to signify one or more wildcard
          characters. <b>Example:</b>{" "}
          <a href="/dashboard/catalog?searchString=elect*">elect*</a>.
        </p>
        <p>
          Coming later: searchable song/track names, tags, DJ-generated tags
          comments.
        </p>
        <p>
          Please email any feedback or suggestions to Tim Ross [tubacity AT
          gmail DOT com].
        </p>
      </div>
    </>
  );
}
