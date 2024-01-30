'use client';
import { isAuthenticating, isLoggedIn, useSelector } from "@/lib/redux";
import { redirect, useSearchParams} from "next/navigation";

export default function LoginPage() {

    const params = useSearchParams();
    const redirectTo = params.get('redirect') ?? '/dashboard';

    const authenticating = useSelector(isAuthenticating);
    const loggedIn = useSelector(isLoggedIn);

    if (!authenticating && loggedIn) redirect(redirectTo);

    return (
        <div>{redirectTo}</div>
    );
}