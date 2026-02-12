export default function Header() {
  return (
    <table cellPadding="10">
      <tbody>
        <tr>
          <td
            align="center"
            valign="top"
            style={{ display: "flex", justifyContent: "center" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/img/wxyc-logo-classic.gif`}
              alt="WXYC logo"
              style={{ border: 0 }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
