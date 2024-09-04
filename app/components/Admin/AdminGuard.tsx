'use client';

import { AdminType, getAuthenticatedUser, isAuthenticating, useSelector } from "@/lib/redux";
import { redirect, usePathname } from "next/navigation";

const AdminGuard = () => {

    const authenticating = useSelector(isAuthenticating);

    if (authenticating) {
        return null;
    }

    const pathname = usePathname();
    const user = useSelector(getAuthenticatedUser);

    if (!user) {
        return null;
    }

    if (pathname.includes('/admin') && user.adminType == AdminType.None) {
        redirect('/catalog');
    }

};

export default AdminGuard;