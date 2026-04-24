import { AuthStage } from "./types";

export const LOGIN_METHOD_STORAGE_KEY = "wxyc_preferred_login_method";

type PreferredLoginMethod = Extract<AuthStage, "otp-email" | "password">;

const VALID_METHODS: PreferredLoginMethod[] = ["otp-email", "password"];

/**
 * Read the user's preferred login method from localStorage.
 * Returns "otp-email" if nothing is stored or the value is unrecognized.
 */
export function getPreferredLoginMethod(): PreferredLoginMethod {
  if (typeof window === "undefined") return "otp-email";
  try {
    const stored = localStorage.getItem(LOGIN_METHOD_STORAGE_KEY);
    if (stored && VALID_METHODS.includes(stored as PreferredLoginMethod)) {
      return stored as PreferredLoginMethod;
    }
    return "otp-email";
  } catch {
    return "otp-email";
  }
}

/** Persist the user's preferred login method to localStorage. */
export function savePreferredLoginMethod(method: PreferredLoginMethod): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOGIN_METHOD_STORAGE_KEY, method);
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}
