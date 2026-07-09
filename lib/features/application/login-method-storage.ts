import { isQrLoginEnabled } from "@/lib/features/authentication/flags";
import { AuthStage } from "./types";

export const LOGIN_METHOD_STORAGE_KEY = "wxyc_preferred_login_method";

type PreferredLoginMethod = Extract<AuthStage, "otp-email" | "password" | "qr">;

const VALID_METHODS: PreferredLoginMethod[] = ["otp-email", "password", "qr"];

/**
 * Read the user's preferred login method from localStorage.
 *
 * Returns "otp-email" if nothing is stored or the value is unrecognized. A
 * stored "qr" is only honored when {@link isQrLoginEnabled} is on — otherwise
 * (feature off / not yet live in this environment) it falls back to "otp-email"
 * so a control-room browser that opted into QR can't be stranded on a disabled
 * method, and the QR stage (which requests a device code on mount) is never
 * reached while the flag is off.
 */
export function getPreferredLoginMethod(): PreferredLoginMethod {
  if (typeof window === "undefined") return "otp-email";
  try {
    const stored = localStorage.getItem(LOGIN_METHOD_STORAGE_KEY);
    if (stored && VALID_METHODS.includes(stored as PreferredLoginMethod)) {
      if (stored === "qr" && !isQrLoginEnabled()) {
        return "otp-email";
      }
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
