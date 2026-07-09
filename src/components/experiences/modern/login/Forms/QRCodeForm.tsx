"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { savePreferredLoginMethod } from "@/lib/features/application/login-method-storage";
import { useAppDispatch } from "@/lib/hooks";
import { useDeviceAuthorization } from "@/src/hooks/authenticationHooks";
import { Box, Button, CircularProgress, Link, Typography } from "@mui/joy";
import { QRCodeSVG } from "qrcode.react";

/**
 * Derive the human-typable base of the verification URL from the QR's
 * `verification_uri_complete` (which embeds the user code as a query param) so
 * the manual-entry hint can say "go to <base> and enter <code>". Returns
 * `undefined` if the value is missing or unparseable, in which case the hint is
 * simply omitted.
 */
function verificationUriBase(complete: string | undefined): string | undefined {
  if (!complete) return undefined;
  try {
    const url = new URL(complete);
    return `${url.host}${url.pathname}`;
  } catch {
    return undefined;
  }
}

/**
 * The RFC 8628 QR sign-in form for the shared control-room browser.
 *
 * Driven entirely by {@link useDeviceAuthorization}: on mount the hook requests
 * a device code and begins polling, and on approval it navigates away itself
 * (this component never sees a "success" state). The five states it does render
 * are the waiting screen (QR + user code) and the four non-happy outcomes.
 *
 * A password/email fallback is always offered — critical when a non-DJ approves
 * on their phone and the backend returns `access_denied` (the `denied` state).
 */
export default function QRCodeForm() {
  const dispatch = useAppDispatch();
  const { userCode, verificationUriComplete, status, restart } =
    useDeviceAuthorization();

  const switchToPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    savePreferredLoginMethod("password");
    dispatch(applicationSlice.actions.setAuthStage("password"));
  };

  const switchToEmail = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    savePreferredLoginMethod("otp-email");
    dispatch(applicationSlice.actions.setAuthStage("otp-email"));
  };

  const fallbackLinks = (
    <Typography
      level="body-sm"
      sx={{ mt: 3, display: "flex", justifyContent: "center", gap: 2 }}
    >
      <Link component="button" type="button" onClick={switchToPassword}>
        Use a password instead
      </Link>
      <Link component="button" type="button" onClick={switchToEmail}>
        Email me a code
      </Link>
    </Typography>
  );

  return (
    <Box sx={{ textAlign: "center" }}>
      {status === "loading" && (
        <Box sx={{ py: 4 }}>
          <CircularProgress />
          <Typography level="body-sm" sx={{ mt: 2 }}>
            Generating a sign-in code&hellip;
          </Typography>
        </Box>
      )}

      {status === "waiting" && (
        <Box>
          <Typography level="title-md" sx={{ mb: 1 }}>
            Scan to sign in
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2 }}>
            Open the camera on your phone and scan this code to approve sign-in.
          </Typography>
          {verificationUriComplete && (
            <Box
              sx={{
                display: "inline-flex",
                p: 2,
                bgcolor: "common.white",
                borderRadius: "md",
              }}
            >
              <QRCodeSVG
                value={verificationUriComplete}
                size={200}
                aria-label="QR code to approve sign-in"
              />
            </Box>
          )}
          {userCode && (
            <Box sx={{ mt: 2 }}>
              <Typography level="body-xs">
                Or enter this code
                {verificationUriBase(verificationUriComplete)
                  ? ` at ${verificationUriBase(verificationUriComplete)}`
                  : ""}
                :
              </Typography>
              <Typography
                level="h3"
                data-testid="device-user-code"
                sx={{ fontFamily: "monospace", letterSpacing: "0.2em", mt: 0.5 }}
              >
                {userCode}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {status === "expired" && (
        <Box sx={{ py: 3 }}>
          <Typography level="title-md" sx={{ mb: 1 }}>
            This code expired
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2 }}>
            Sign-in codes are only valid for a few minutes.
          </Typography>
          <Button onClick={restart}>Generate a new code</Button>
        </Box>
      )}

      {status === "denied" && (
        <Box sx={{ py: 3 }}>
          <Typography level="title-md" sx={{ mb: 1 }}>
            Sign-in was declined
          </Typography>
          <Typography level="body-sm">
            That account isn&apos;t allowed to sign in with a QR code. Sign in
            with your password, or ask a station manager for access.
          </Typography>
        </Box>
      )}

      {status === "error" && (
        <Box sx={{ py: 3 }}>
          <Typography level="title-md" sx={{ mb: 1 }}>
            Something went wrong
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2 }}>
            We couldn&apos;t start the QR sign-in. Please try again.
          </Typography>
          <Button onClick={restart}>Try again</Button>
        </Box>
      )}

      {fallbackLinks}
    </Box>
  );
}
