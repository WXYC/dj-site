"use client";

import "@/src/styles/classic/wxyc.css";

export default function HelpScreen() {
  return (
    <div style={{ textAlign: "center" }}>
      <span style={{ fontFamily: "Arial Black" }}>
        <table align="center" cellPadding={5}>
          <tbody>
            <tr>
              <td className="title" colSpan={3} style={{ textAlign: "center" }}>
                <span style={{ color: "rgb(0, 0, 0)" }}>
                  WXYC Electronic Flowsheet
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </span>
      <table
        style={{ textAlign: "center", width: "100%" }}
        cellSpacing={2}
        cellPadding={2}
      >
        <tbody>
          <tr>
            <td className="title" colSpan={4} style={{ textAlign: "center" }}>
              <span style={{ color: "rgb(0, 0, 0)" }}>
                <a name="faCodes"></a>Help Screen
              </span>
            </td>
          </tr>
          <tr>
            <td
              className="subhead"
              colSpan={4}
              style={{
                textAlign: "center",
                fontFamily: "Verdana, Helvetica, sans-serif",
              }}
            >
              <span style={{ color: "rgb(0, 0, 0)" }}>
                <p className="text" style={{ marginLeft: ".5in" }}></p>

                <p className="text">
                  More information will be here eventually....but for now,
                  please contact me with any questions/problems. Thanks!
                </p>

                <p className="text" style={{ textAlign: "center" }}>
                  Tim Ross
                  <br />
                  Email: tubacity@gmail.com
                  <br />
                  Cell Phone: 919.225.0282
                  <br />
                  AOL id: tubafrenzy
                </p>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <br />
    </div>
  );
}
