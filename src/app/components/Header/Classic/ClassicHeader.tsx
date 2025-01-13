import Link from "next/link";
import ClassicLogout from "../../Login/Classic/ClassicLogout";
import LeaveClassic from "../../Theme/Classic/LeaveClassic";

export default function ClassicHeader() {
  return (
    <nav style={{ display: "flex", justifyContent: "space-around" }}>
      <Link href="/dashboard/catalog">Access the Card Catalog</Link>
      <Link href="/dashboard/flowsheet">Visit the Flowsheet</Link>
      <LeaveClassic />
      <ClassicLogout />
    </nav>
  );
}
