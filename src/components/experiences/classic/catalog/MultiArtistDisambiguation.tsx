"use client";

import Link from "next/link";

export type ArtistLibraryCodeRow = {
  id: number;
  genreName: string;
  callLettersAndNumbers: string;
  presentationName: string;
};

export type MultiArtistDisambiguationProps = {
  partialLibraryCode: string;
  artistLibraryCodes: ArtistLibraryCodeRow[];
};

/**
 * Reproduces tubafrenzy's `multipleArtistsDisplay.jsp`: the disambiguation
 * screen a partial code search lands on when it matches more than one
 * artist. Presentational only — the caller supplies the match list, since
 * the code-search backend that would produce it is deferred to #1198.
 */
export default function MultiArtistDisambiguation({
  partialLibraryCode,
  artistLibraryCodes,
}: MultiArtistDisambiguationProps) {
  return (
    <div style={{ textAlign: "center" }}>
      <table cellPadding={10} border={0} width="95%" style={{ borderSpacing: "1px", margin: "0 auto" }}>
        <tbody>
          <tr>
            <td>
              <div style={{ textAlign: "center" }}>
                <table cellPadding={4} border={0} width="100%" style={{ borderSpacing: "1px" }}>
                  <tbody>
                    <tr style={{ textAlign: "center" }}>
                      <td className="text" width="33%" style={{ textAlign: "center" }}>
                        <Link href="/dashboard/library">
                          <b>Choose/Add Library Codes</b>
                        </Link>
                      </td>
                      <td className="title" width="34%" style={{ textAlign: "center" }}>
                        {partialLibraryCode}
                      </td>
                      <td className="text" width="33%" style={{ textAlign: "center" }} />
                    </tr>
                  </tbody>
                </table>
                <br />

                {artistLibraryCodes.length > 0 ? (
                  <table className="entry-table">
                    <thead>
                      <tr className="entry-header">
                        <th colSpan={2} style={{ textAlign: "center" }}>
                          Library Code
                        </th>
                        <th style={{ textAlign: "left" }}>Artist Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artistLibraryCodes.map((artistLibraryCode, index) => (
                        <tr
                          key={artistLibraryCode.id}
                          className={`entry-row ${
                            index % 2 === 0 ? "entry-row-even" : "entry-row-odd"
                          }`}
                        >
                          <td style={{ textAlign: "right" }}>{artistLibraryCode.genreName}</td>
                          <td style={{ textAlign: "left" }}>
                            {artistLibraryCode.callLettersAndNumbers}
                          </td>
                          <td>
                            <Link href={`/dashboard/library/artist/${artistLibraryCode.id}`}>
                              {artistLibraryCode.presentationName}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <>
                    <p className="text">
                      There are currently no artists in the catalog that match these criteria.
                    </p>
                    <p className="text">
                      <Link href="/dashboard/library">
                        <b>Do another search</b>
                      </Link>
                    </p>
                  </>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
