'use client';

import Link from "next/link";
import AuthenticationGuard from "../components/Authentication/AuthenticationGuard";
import LeaveClassic from "../components/Classic/LeaveClassic";
import LogoutClassic from "../components/Classic/LogoutClassic";
import ViewGuard from "../components/General/ViewGuard";


export default function ClassicLayout(props: React.PropsWithChildren) {
    

    return (
        <div>
        <ViewGuard />
        <AuthenticationGuard redirectTo='/login' savePath />
        <nav style = {{ display: 'flex', justifyContent: 'space-around' }}>
            <Link href="/classic/catalog" >
                Access the Card Catalog
            </Link>
            <Link href="/classic/flowsheet" >
                Visit the Flowsheet
            </Link>
            <LeaveClassic />
            <LogoutClassic />
        </nav>
        <hr />
            <ViewGuard />
            <AuthenticationGuard redirectTo='/login' savePath />
            {props.children}
        </div>
    )
}