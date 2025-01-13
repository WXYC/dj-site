'use client';
import { getClassicView, useSelector } from "@/lib/redux"
import { redirect, usePathname } from "next/navigation";


const ViewGuard = () => {
    
    const classicView = useSelector(getClassicView);

    const pathname = usePathname();

    if (pathname.includes('login')) return null;

    if (classicView && pathname.includes('dashboard')) {
        let newPath = pathname.replace('dashboard', 'classic');
        redirect(newPath);
    }

    if (!classicView && pathname.includes('classic')) {
        let newPath = pathname.replace('classic', 'dashboard');
        redirect(newPath);
    }

}

export default ViewGuard;