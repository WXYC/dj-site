import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import "server-only";
import { defaultApplicationState } from "./application/types";
import { AuthenticationSession } from "./authentication/types";
import { defaultAuthenticationData } from "./authentication/utilities";
import { SiteProps } from "./types";


export const runtime = "edge";

const SESSION_SECRET = process.env.SESSION_SECRET;
const ENCODED_KEY = new TextEncoder().encode(SESSION_SECRET);

export const sessionOptions: {
  cookieName: string;
  cookieOptions: {
    secure: boolean;
    httpOnly: boolean;
    sameSite: "strict" | "lax" | "none";
    path: string;
  };
} = {
  cookieName: "app_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  },
};

export async function setSession(refreshToken: string | undefined) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({ refreshToken, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(
    sessionOptions.cookieName,
    session,
    sessionOptions.cookieOptions
  );
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(sessionOptions.cookieName)?.value;
  return await decrypt(session);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionOptions.cookieName);
}

export async function encrypt(payload: AuthenticationSession) {
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not set");

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(ENCODED_KEY);
}

export async function decrypt(session: string | undefined) {
  if (!session) return undefined;

  try {
    const { payload } = await jwtVerify(session, ENCODED_KEY, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    console.log("Failed to verify session");
  }
}

export const createServerSideProps = async (): Promise<SiteProps> => {
  const cookieStore = await cookies();

  const appStateValue = cookieStore.get("app_state")?.value;
  let appState = defaultApplicationState;
  
  if (appStateValue) {
    try {
      const parsed = JSON.parse(appStateValue);
      // Migrate old 'classic' boolean to new 'experience' string
      if (parsed && typeof parsed === "object") {
        if ("classic" in parsed && !("experience" in parsed)) {
          appState = {
            ...defaultApplicationState,
            ...parsed,
            experience: parsed.classic ? "classic" : "modern",
          };
        } else {
          appState = { ...defaultApplicationState, ...parsed };
        }
      }
    } catch (e) {
      console.error("Failed to parse app_state cookie", e);
    }
  }

  return {
    application: appState,
    authentication:
      JSON.parse(
        String(
          cookieStore.get("auth_state")?.value ??
            JSON.stringify(defaultAuthenticationData)
        )
      ) ?? defaultAuthenticationData,
  };
};
