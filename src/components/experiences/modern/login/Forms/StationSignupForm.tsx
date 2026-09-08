"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useStationSignup } from "@/src/hooks/authenticationHooks";
import { isValidEmail } from "@wxyc/shared/validation";
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  FormLabel,
  Input,
  Link,
  Typography,
} from "@mui/joy";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { loginHrefWithoutSignup } from "@/src/utilities/loginHref";
import { savePreferredLoginMethod } from "@/lib/features/application/login-method-storage";
import {
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  getUsernameError,
} from "@/src/utilities/usernameValidation";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

const PASSCODE_MAX_LENGTH = 128;
const TEXT_MAX_LENGTH = 255;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

type Phase =
  | "passcode"
  | "details"
  | "cooldown"
  | "unavailable"
  | "signing-in"
  | "success";

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
 * method picker. Signup itself is never written to `login-method-storage` —
 * it is not a sign-in method, and a returning DJ must not be nudged toward a
 * second account — but a completed signup does record `password`, which is
 * the credential the DJ now holds.
 *
 * A 201 leads straight into the site: the endpoint mints no session, so the
 * form signs the DJ in with the credentials still in hand rather than making
 * them retype what they just chose. That sign-in is allowed to fail — the
 * account exists regardless — so `success` is now the fallback render, a
 * manual sign-in path, not the happy path.
 *
 * Terminal renders besides the two steps: `unavailable` (server flag off — a
 * bare 404 with no body) and `cooldown` are full-form states because neither
 * is specific to what the DJ typed; an invalid/expired passcode routes back to
 * the passcode step without saying which (the server answers both identically,
 * by design); a shape/validation/conflict error stays on the details step;
 * `signing-in` and `success` both name the created account and offer the way
 * back to the normal login form.
 */
export default function StationSignupForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleSignup, signInAfterSignup, isLoading } = useStationSignup();

  const [phase, setPhase] = useState<Phase>("passcode");
  const [passcode, setPasscode] = useState("");
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [passcodeError, setPasscodeError] = useState<string | undefined>();
  const [detailsError, setDetailsError] = useState<string | undefined>();
  const [cooldownMessage, setCooldownMessage] = useState<string | undefined>();
  const [createdAccount, setCreatedAccount] = useState<
    { username: string; email: string } | undefined
  >();

  /**
   * Leave the signup detour for the normal login form.
   *
   * `stage` is the form the DJ should land on. Before an account exists that
   * is the site default; once one does, it is `password`, because the only
   * credential this flow hands a DJ is the password they just chose — sending
   * them to the email-code form would contradict the sentence they just read.
   */
  const leaveSignup =
    (stage: "otp-email" | "password") =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      dispatch(applicationSlice.actions.setAuthStage(stage));
      // Modern picks its form from authFlow.stage (the dispatch above is enough
      // there), but classic reaches this component through `?signup=1` in
      // ClassicLoginSlotSwitcher, which never reads authFlow.stage — without
      // clearing the URL a DJ who clicks this stays stuck on the signup slot.
      // Clear only `signup`: /login is also where an OIDC authorize bounce lands,
      // and useLogin recomputes the resume target from the live params at
      // sign-in time, so replacing with a bare path would strand the relying
      // party without its code.
      router.replace(loginHrefWithoutSignup(searchParams));
    };

  const backToSignIn = leaveSignup("otp-email");
  const backToPasswordSignIn = leaveSignup("password");

  const handlePasscodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasscodeError(undefined);
    setPhase("details");
  };

  const handleDetailsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDetailsError(undefined);

    const outcome = await handleSignup({
      // Passcodes are generated from an uppercase-only alphabet, so trimming
      // and folding is lossless — and it matters: the server compares raw, and
      // every miss writes an attempt row against the station-wide cooldown, so
      // one DJ pasting a code with a stray newline (or a phone autocapitalising
      // it) would burn attempts for everyone else on that window.
      passcode: passcode.trim().toUpperCase(),
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
      // The account now exists and its only credential is a password, so that
      // is the form this browser should offer next time — whether the DJ gets
      // there through the fallback below or comes back weeks later. This is
      // not the entry link's forbidden write: what is remembered is a sign-in
      // method the DJ now holds, never `signup`, which is not a storable
      // method and would nudge a returning DJ toward a second account.
      savePreferredLoginMethod("password");
      setPhase("signing-in");
      // The created row is the authority on this account's identifiers —
      // better-auth normalizes usernames and emails on write — so sign in
      // with what the server echoed, not with what was typed.
      const signedIn = await signInAfterSignup({
        email: outcome.email,
        password: details.password,
      });
      if (!signedIn) {
        setPhase("success");
      }
      // A successful sign-in navigates away; staying on `signing-in` keeps the
      // spinner up until the route changes rather than flashing a screen that
      // tells an already-signed-in DJ to go and sign in.
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

  // `getUsernameError` mirrors better-auth's username rules, the same copy the
  // admin "Add DJ" form fails fast against. The server stays the authority;
  // this only spares a DJ a 400 that reads exactly like a taken username, and
  // spares the station-wide cooldown an attempt spent on a typo.
  const detailsValid =
    getUsernameError(details.username.trim()) === null &&
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

  if (phase === "signing-in" && createdAccount) {
    return (
      <>
        <Alert
          color="success"
          data-testid="signup-signing-in"
          startDecorator={<CircularProgress size="sm" />}
        >
          Account created for <strong>{createdAccount.username}</strong>{" "}
          ({createdAccount.email}). Signing you in&hellip;
        </Alert>
        {/* A second way out while the sign-in is still in flight: the DJ may
            simply be tired of waiting, and the account already exists. */}
        <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
          <Link component="button" type="button" onClick={backToPasswordSignIn}>
            Back to sign in
          </Link>
        </Typography>
      </>
    );
  }

  if (phase === "success" && createdAccount) {
    return (
      <>
        {/* Reached only when the automatic sign-in failed. The DJ has no way
            to know what went wrong, so name the account, say it works, and
            give them the one step left. */}
        <Alert color="success" data-testid="signup-success">
          Account created for <strong>{createdAccount.username}</strong>{" "}
          ({createdAccount.email}). We couldn&apos;t sign you in automatically,
          but the account is ready &mdash; sign in with the username and
          password you just chose. It&apos;s pending a station manager&apos;s
          review.
        </Alert>
        <Typography level="body-sm" sx={{ mt: 2, textAlign: "center" }}>
          <Link component="button" type="button" onClick={backToPasswordSignIn}>
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
          slotProps={{ input: { maxLength: MAX_USERNAME_LENGTH } }}
          value={details.username}
          disabled={isLoading}
          onChange={(event) =>
            setDetails({ ...details, username: event.target.value })
          }
        />
        <Typography level="body-xs" sx={{ mt: 0.5 }}>
          {MIN_USERNAME_LENGTH}&ndash;{MAX_USERNAME_LENGTH} characters: letters,
          numbers, underscores, and dots.
        </Typography>
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
