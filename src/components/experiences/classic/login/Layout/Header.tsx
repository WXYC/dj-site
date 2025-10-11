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
