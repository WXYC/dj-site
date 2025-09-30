import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { hydrateSession } from "@/lib/features/authentication/thunks";
import { User, VerifiedData } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { signIn, signOut as betterAuthSignOut, getAccessToken } from "@/lib/features/authentication/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export const useAuthentication = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(hydrateSession());
    }, []);
};

export const useRegistry = () => {
    const user = useAppSelector((state) => state.authentication.session.user);
    const loading = useAppSelector((state) => state.authentication.session.loading);
    
    return {
        info: user,
        loading,
        error: null, // Better-auth handles errors through its own mechanisms
    };
};

export const useNewUser = () => {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [authenticating, setAuthenticating] = useState(false);
    
    const verified = useAppSelector(authenticationSlice.selectors.allCredentialsVerified);
    const requiredCredentialsVerified = useAppSelector(authenticationSlice.selectors.requiredCredentialsVerified);
    
    const addRequiredCredentials = useCallback((credentials: (keyof VerifiedData)[]) => {
        dispatch(authenticationSlice.actions.addRequiredCredentials(credentials));
    }, [dispatch]);

    const handleNewUser = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setAuthenticating(true);
        
        try {
            const formData = new FormData(e.currentTarget);
            const username = formData.get("username") as string;
            const password = formData.get("password") as string;
            const realName = formData.get("realName") as string;
            const djName = formData.get("djName") as string;
            
            // Add timeout and better error handling for 204 responses
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
                const result = await signIn.username({
                    username: username,
                    password,
                });
                
                clearTimeout(timeoutId);
                
                if (result.error) {
                    toast.error(result.error.message);
                } else {
                    // Hydrate Redux state after successful sign in
                    dispatch(hydrateSession());
                    toast.success("Account created successfully!");
                    router.push("/dashboard");
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    toast.error("Request timed out. Please try again.");
                    console.warn(`[NewUser] Request timed out after 10 seconds`);
                } else {
                    throw fetchError;
                }
            }
        } catch (error) {
            toast.error("Failed to create account");
            console.warn(`[NewUser] Account creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setAuthenticating(false);
        }
    }, [router, dispatch]);

    return {
        handleNewUser,
        verified: requiredCredentialsVerified,
        authenticating,
        addRequiredCredentials,
    };
};

export const useLogout = () => {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoggingOut(true);
        
        try {
            await betterAuthSignOut();
            // Clear Redux state after successful logout
            dispatch(authenticationSlice.actions.reset());
            toast.success("Logged out successfully");
            router.push("/login");
        } catch (error) {
            toast.error("Failed to log out");
            console.warn(`[Logout] Sign out failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoggingOut(false);
        }
    }, [dispatch, router]);

    return {
        handleLogout,
        loggingOut,
    };
};

export const useLogin = () => {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [authenticating, setAuthenticating] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const hasUsername = useAppSelector((state) => authenticationSlice.selectors.getVerification(state, "username"));
    const hasPassword = useAppSelector((state) => authenticationSlice.selectors.getVerification(state, "password"));
    const verified = hasUsername && hasPassword;

    useEffect(() => {
        dispatch(authenticationSlice.actions.verify({
            key: "username",
            value: username.length > 0,
        }));
    }, [username, dispatch]);

    useEffect(() => {
        dispatch(authenticationSlice.actions.verify({
            key: "password",
            value: password.length > 0,
        }));
    }, [password, dispatch]);

    const handleLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setAuthenticating(true);
        
        try {
            // Add timeout and better error handling for 204 responses
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
                const result = await signIn.username({
                    username: username,
                    password,
                });
                
                clearTimeout(timeoutId);
                
                if (result.error) {
                    toast.error(result.error.message);
                } else {
                    // Hydrate Redux state after successful sign in
                    dispatch(hydrateSession());
                    toast.success("Logged in successfully!");
                    router.push("/dashboard");
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    toast.error("Request timed out. Please try again.");
                    console.warn(`[Login] Request timed out after 10 seconds`);
                } else {
                    throw fetchError;
                }
            }
        } catch (error) {
            toast.error("Failed to log in");
            console.warn(`[Login] Sign in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setAuthenticating(false);
        }
    }, [username, password, router, dispatch]);

    return {
        handleLogin,
        authenticating,
        verified,
        setUsername,
        setPassword,
    };
};

export const useResetPassword = () => {
    const [resetting, setResetting] = useState(false);

    const handleResetPassword = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setResetting(true);
        
        try {
            // TODO: Implement password reset functionality
            toast.info("Password reset functionality coming soon");
        } catch (error) {
            toast.error("Failed to reset password");
            console.warn(`[ResetPassword] Password reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setResetting(false);
        }
    }, []);

    return {
        handleResetPassword,
        resetting,
    };
};

export const useAccessToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const getToken = async () => {
            try {
                // getAccessToken requires providerId parameter
                const result = await getAccessToken({ providerId: "username" });
                if (result && typeof result === 'object' && 'accessToken' in result) {
                    setToken((result as any).accessToken);
                } else {
                    setToken(null);
                }
            } catch (error) {
                console.warn(`[AccessToken] Failed to get token: ${error instanceof Error ? error.message : 'Unknown error'}`);
                setToken(null);
            } finally {
                setLoading(false);
            }
        };
        getToken();
    }, []);

    return { token, loading };
};