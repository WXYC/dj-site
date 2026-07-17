import Image from "next/image";

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
          </td>
        </tr>
      </tbody>
    </table>
  );
}
