"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useStationSignup } from "@/src/hooks/authenticationHooks";
import { isValidEmail } from "@wxyc/shared/validation";
import { Alert, Button, FormControl, FormLabel, Input, Link, Typography } from "@mui/joy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

const PASSCODE_MAX_LENGTH = 128;
const TEXT_MAX_LENGTH = 255;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

type Phase = "passcode" | "details" | "cooldown" | "unavailable" | "success";

type Details = {
  username: string;
  email: string;
  password: string;
  realName: string;
  djName: string;
};

const emptyDetails: Details = {
  username: "",
  email: "",
  password: "",
  realName: "",
  djName: "",
};

/**
 * The DJ-facing station-signup form: a passcode gate, then account details,
 * submitted together as a single POST (there is no separate passcode-verify
 * call). Reached only from a link on the normal login form — never from the
 * method picker, and never written to `login-method-storage`, since this is
 * not a sign-in method a returning DJ should be nudged toward.
 *
 * Five terminal renders besides the two steps: `unavailable` (server flag
 * off — a bare 404 with no body) and `cooldown` are full-form states because
 * neither is specific to what the DJ typed; an invalid/expired passcode
 * routes back to the passcode step without saying which (the server answers
 * both identically, by design); a shape/validation/conflict error stays on
 * the details step; `success` hands off to the normal login form.
 */
export default function StationSignupForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { handleSignup, isLoading } = useStationSignup();

  const [phase, setPhase] = useState<Phase>("passcode");
  const [passcode, setPasscode] = useState("");
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [passcodeError, setPasscodeError] = useState<string | undefined>();
  const [detailsError, setDetailsError] = useState<string | undefined>();
  const [cooldownMessage, setCooldownMessage] = useState<string | undefined>();
  const [createdAccount, setCreatedAccount] = useState<
    { username: string; email: string } | undefined
  >();

  const backToSignIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dispatch(applicationSlice.actions.setAuthStage("otp-email"));
    // Modern picks its form from authFlow.stage (the dispatch above is enough
    // there), but classic reaches this component through `?signup=1` in
    // ClassicLoginSlotSwitcher, which never reads authFlow.stage — without
    // clearing the URL a DJ who clicks this stays stuck on the signup slot.
    router.replace("/login");
  };

  const handlePasscodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasscodeError(undefined);
    setPhase("details");
  };

  const handleDetailsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDetailsError(undefined);

    const outcome = await handleSignup({
      passcode,
      username: details.username.trim(),
      email: details.email.trim(),
      password: details.password,
      realName: details.realName.trim(),
      djName: details.djName.trim() || undefined,
    });

    if (outcome.status === "unavailable") {
      setPhase("unavailable");
      return;
    }

    if (outcome.status === "success") {
      setCreatedAccount({ username: outcome.username, email: outcome.email });
      setPhase("success");
      return;
    }

    if (outcome.code === "COOLDOWN") {
      setCooldownMessage(outcome.message);
      setPhase("cooldown");
      return;
    }

    if (outcome.code === "INVALID_PASSCODE") {
      setPasscodeError(outcome.message);
      setPhase("passcode");
      return;
    }

    setDetailsError(outcome.message);
  };

  const detailsValid =
    details.username.trim().length > 0 &&
    isValidEmail(details.email.trim()) &&
    details.password.length >= PASSWORD_MIN_LENGTH &&
    details.password.length <= PASSWORD_MAX_LENGTH &&
    details.realName.trim().length > 0;

  if (phase === "unavailable") {
    return (
      <>
        <Alert color="neutral" data-testid="signup-unavailable">
          Station signup is not available right now. Ask a station manager
          for an account, or check back later.
        </Alert>
        <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
          <Link component="button" type="button" onClick={backToSignIn}>
            Back to sign in
          </Link>
        </Typography>
      </>
    );
  }

  if (phase === "cooldown") {
    return (
      <>
        <Alert color="warning" data-testid="signup-cooldown">
          {cooldownMessage}
        </Alert>
        <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
          <Link component="button" type="button" onClick={backToSignIn}>
            Back to sign in
          </Link>
        </Typography>
      </>
    );
  }

  if (phase === "success" && createdAccount) {
    return (
      <>
        <Alert color="success" data-testid="signup-success">
          Account created for <strong>{createdAccount.username}</strong>.
          It&apos;s pending a station manager&apos;s review before you can
          sign in.
        </Alert>
        <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
          <Link component="button" type="button" onClick={backToSignIn}>
            Back to sign in
          </Link>
        </Typography>
      </>
    );
  }

  if (phase === "passcode") {
    return (
      <form onSubmit={handlePasscodeSubmit} method="post">
        <Typography level="body-sm" sx={{ mb: 2 }}>
          Enter the signup passcode a station manager gave you.
        </Typography>
        <FormControl required error={!!passcodeError}>
          <FormLabel>Signup passcode</FormLabel>
          <Input
            name="passcode"
            type="text"
            autoFocus
            slotProps={{ input: { maxLength: PASSCODE_MAX_LENGTH } }}
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
          />
        </FormControl>
        {passcodeError && (
          <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>
            {passcodeError}
          </Typography>
        )}
        <Button
          type="submit"
          disabled={!passcode.trim()}
          fullWidth
          sx={{ mt: 2 }}
        >
          Continue
        </Button>
        <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
          <Link component="button" type="button" onClick={backToSignIn}>
            Back to sign in
          </Link>
        </Typography>
      </form>
    );
  }

  return (
    <form onSubmit={handleDetailsSubmit} method="post">
      {detailsError && (
        <Alert color="danger" sx={{ mb: 2 }} data-testid="signup-details-error">
          {detailsError}
        </Alert>
      )}
      <FormControl required>
        <FormLabel>Username</FormLabel>
        <Input
          name="username"
          value={details.username}
          disabled={isLoading}
          onChange={(event) =>
            setDetails({ ...details, username: event.target.value })
          }
        />
      </FormControl>
      <FormControl required>
        <FormLabel>Email</FormLabel>
        <Input
          name="email"
          type="email"
          slotProps={{ input: { maxLength: TEXT_MAX_LENGTH } }}
          value={details.email}
          disabled={isLoading}
          onChange={(event) =>
            setDetails({ ...details, email: event.target.value })
          }
        />
      </FormControl>
      <FormControl required>
        <FormLabel>Password</FormLabel>
        <Input
          name="password"
          type="password"
          slotProps={{ input: { maxLength: PASSWORD_MAX_LENGTH } }}
          value={details.password}
          disabled={isLoading}
          onChange={(event) =>
            setDetails({ ...details, password: event.target.value })
          }
        />
        <Typography level="body-xs" sx={{ mt: 0.5 }}>
          At least {PASSWORD_MIN_LENGTH} characters.
        </Typography>
      </FormControl>
      <FormControl required>
        <FormLabel>Real name</FormLabel>
        <Input
          name="realName"
          slotProps={{ input: { maxLength: TEXT_MAX_LENGTH } }}
          value={details.realName}
          disabled={isLoading}
          onChange={(event) =>
            setDetails({ ...details, realName: event.target.value })
          }
        />
      </FormControl>
      <FormControl>
        <FormLabel>DJ name (optional)</FormLabel>
        <Input
          name="djName"
          slotProps={{ input: { maxLength: TEXT_MAX_LENGTH } }}
          value={details.djName}
          disabled={isLoading}
          onChange={(event) =>
            setDetails({ ...details, djName: event.target.value })
          }
        />
      </FormControl>
      <ValidatedSubmitButton
        authenticating={isLoading}
        valid={detailsValid}
        fullWidth
        sx={{ mt: 2 }}
      />
      <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
        <Link
          component="button"
          type="button"
          onClick={() => setPhase("passcode")}
          disabled={isLoading}
        >
          Back
        </Link>
      </Typography>
    </form>
  );
}
