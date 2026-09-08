import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import StationSignupForm from "@/src/components/experiences/modern/login/Forms/StationSignupForm";
import type { StationSignupOutcome } from "@/lib/features/authentication/client";

const mockHandleSignup = vi.fn<(request: unknown) => Promise<StationSignupOutcome>>();
const mockSignInAfterSignup =
  vi.fn<(credentials: { email: string; password: string }) => Promise<boolean>>();
const mockReplace = vi.fn<(href: string) => void>();
const mockSearchParams = vi.fn<() => URLSearchParams>();

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useStationSignup: () => ({
    handleSignup: mockHandleSignup,
    signInAfterSignup: mockSignInAfterSignup,
    isLoading: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams(),
}));

const mockSavePreferredLoginMethod = vi.fn<(method: string) => void>();
vi.mock("@/lib/features/application/login-method-storage", () => ({
  savePreferredLoginMethod: (method: string) =>
    mockSavePreferredLoginMethod(method),
}));

// A live OIDC authorize bounce parked on /login: better-auth's authorize
// endpoint sends an unauthenticated DJ here with the whole authorize query
// intact, and useLogin recomputes the resume target from the LIVE search
// params at sign-in time. Backing out of the signup detour must not eat them,
// or the DJ signs in successfully while the relying party never gets its code.
const OIDC_BOUNCE_QUERY =
  "signup=1&client_id=wxyc-relying-party&response_type=code&redirect_uri=https%3A%2F%2Frp.example%2Fcb&state=xyz789";

function expectBackOutKeptTheAuthorizeBounce() {
  expect(mockReplace).toHaveBeenCalledTimes(1);
  const target = new URL(mockReplace.mock.calls[0][0], "https://dj.wxyc.org");
  expect(target.pathname).toBe("/login");
  expect(target.searchParams.get("signup")).toBeNull();
  expect(target.searchParams.get("client_id")).toBe("wxyc-relying-party");
  expect(target.searchParams.get("response_type")).toBe("code");
  expect(target.searchParams.get("redirect_uri")).toBe("https://rp.example/cb");
  expect(target.searchParams.get("state")).toBe("xyz789");
}

// Codes are generated from the ambiguity-free alphabet 23456789ABCDEFGHJKLMNPQRSTUVWXYZ.
const PASSCODE = "K7M2PQ4R";

type User = ReturnType<typeof renderWithProviders>["user"];

/**
 * Fill one field in a single event rather than a keystroke per character.
 *
 * Most cases here only need the field to end up holding a value; almost every
 * test in this file walks both steps to reach the state it is about, and
 * typing all of them out is what put this file's per-test cost near the
 * suite's timeout. Progressive-validation tests still type, since for those
 * the intermediate values are the subject.
 */
async function fillField(user: User, field: HTMLElement, value: string) {
  await user.click(field);
  await user.paste(value);
}

async function fillPasscodeStep(user: User, passcode = PASSCODE) {
  await fillField(user, screen.getByLabelText(/signup passcode/i), passcode);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

async function fillDetailsStep(user: User, email = "newdj@example.com") {
  await fillField(user, screen.getByLabelText(/^username/i), "newdj");
  await fillField(user, screen.getByLabelText(/^email/i), email);
  await fillField(user, screen.getByLabelText(/^password/i), "supersecret");
  await fillField(user, screen.getByLabelText(/real name/i), "New DJ");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams.mockReturnValue(new URLSearchParams(""));
  mockSignInAfterSignup.mockResolvedValue(true);
});

describe("StationSignupForm", () => {
  it("starts on the passcode step and moves to details on continue, with no network call yet", async () => {
    const { user } = renderWithProviders(<StationSignupForm />);

    expect(screen.getByLabelText(/signup passcode/i)).toBeInTheDocument();
    await fillPasscodeStep(user);

    expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
    expect(mockHandleSignup).not.toHaveBeenCalled();
  });

  it("submits passcode and details together, then signs the DJ in with what they just typed instead of asking for it again", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user, PASSCODE);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(mockHandleSignup).toHaveBeenCalledWith({
      passcode: PASSCODE,
      username: "newdj",
      email: "newdj@example.com",
      password: "supersecret",
      realName: "New DJ",
      djName: undefined,
    });
    await waitFor(() =>
      expect(mockSignInAfterSignup).toHaveBeenCalledWith({
        email: "newdj@example.com",
        password: "supersecret",
      })
    );
    // The 201 returns username AND email off the created row -- show both.
    const pending = await screen.findByTestId("signup-signing-in");
    expect(pending).toHaveTextContent("newdj");
    expect(pending).toHaveTextContent("newdj@example.com");
    // The manual "go and sign in" screen is the fallback for a failed
    // automatic sign-in, not the happy path.
    expect(screen.queryByTestId("signup-success")).not.toBeInTheDocument();
  });

  it("signs in with the email the server echoed off the created row, not the one the DJ typed", async () => {
    // better-auth normalizes on write, so the created row is the only
    // authority on this account's identifiers. Signing in with the typed
    // string would work by luck, not by contract.
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user, "NewDJ@Example.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(mockSignInAfterSignup).toHaveBeenCalledWith({
        email: "newdj@example.com",
        password: "supersecret",
      })
    );
  });

  it("shows a pending state while the automatic sign-in is in flight", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    let settleSignIn: (signedIn: boolean) => void = () => {};
    mockSignInAfterSignup.mockReturnValue(
      new Promise<boolean>((resolve) => {
        settleSignIn = resolve;
      })
    );
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByTestId("signup-signing-in")).toHaveTextContent(
      /signing you in/i
    );
    expect(screen.queryByTestId("signup-success")).not.toBeInTheDocument();

    // The account already exists; nothing here may re-submit it.
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();

    settleSignIn(true);
    await waitFor(() => expect(mockSignInAfterSignup).toHaveBeenCalled());
  });

  it("keeps a way out of the pending state, which classic's URL-driven routing cannot clear on its own", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    mockSignInAfterSignup.mockReturnValue(new Promise<boolean>(() => {}));
    mockSearchParams.mockReturnValue(new URLSearchParams(OIDC_BOUNCE_QUERY));
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByTestId("signup-signing-in");
    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    expectBackOutKeptTheAuthorizeBounce();
  });

  it("falls back to a manual sign-in screen when the automatic sign-in fails, without implying the account is broken", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    mockSignInAfterSignup.mockResolvedValue(false);
    mockSearchParams.mockReturnValue(new URLSearchParams(OIDC_BOUNCE_QUERY));
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const fallback = await screen.findByTestId("signup-success");
    expect(fallback).toHaveTextContent("newdj");
    expect(fallback).toHaveTextContent("newdj@example.com");
    // The DJ has no idea what failed, so say what happened, say the account
    // is fine, and give them the one thing left to do.
    expect(fallback).toHaveTextContent(/couldn.t sign you in automatically/i);
    expect(fallback).toHaveTextContent(/account is ready/i);
    expect(fallback).toHaveTextContent(
      /sign in with the username and password you just chose/i
    );
    // A station-signup account is provisioned with the dj role and works
    // immediately -- review happens after the fact. The confirmation must
    // not claim sign-in is blocked on review.
    expect(fallback).toHaveTextContent(/pending a station manager.s review/i);

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    expectBackOutKeptTheAuthorizeBounce();
  });

  it("sends a DJ who must sign in manually to the password form the copy points them at", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    mockSignInAfterSignup.mockResolvedValue(false);
    const { user, store } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByTestId("signup-success");
    await user.click(screen.getByRole("button", { name: /back to sign in/i }));

    // The fallback tells them to use the password they just chose. Landing
    // them on the email-code form would contradict the sentence they just
    // read, for the one DJ in this flow who is already having a bad time.
    expect(applicationSlice.selectors.getAuthStage(store.getState())).toBe("password");
  });

  it("remembers password as the login method for the account it just created", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    // Without this a DJ who signed up with a password is served the email-code
    // form on every later visit. The stored value is the credential they hold,
    // never `signup` — which is not a sign-in method and cannot be stored.
    await waitFor(() =>
      expect(mockSavePreferredLoginMethod).toHaveBeenCalledWith("password")
    );
  });

  it("does not remember a login method when no account was created", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "error",
      code: "USERNAME_TAKEN",
      message: "That username is already in use.",
    });
    const { user, store } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("That username is already in use.");
    expect(mockSavePreferredLoginMethod).not.toHaveBeenCalled();
    expect(applicationSlice.selectors.getAuthStage(store.getState())).not.toBe("password");
  });

  it("folds the passcode to the alphabet it was generated from before submitting", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    const { user } = renderWithProviders(<StationSignupForm />);

    // Codes are drawn from an uppercase-only alphabet and the server neither
    // trims nor case-folds, so a code pasted with surrounding whitespace or
    // typed lowercase (or autocapitalised by a phone) is a miss -- and every
    // miss writes an attempt row against the STATION-WIDE cooldown, burning
    // attempts for every other DJ on that window. Folding is lossless here.
    await fillPasscodeStep(user, "  k7m2pq4r  ");
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(mockHandleSignup).toHaveBeenCalledWith(
      expect.objectContaining({ passcode: "K7M2PQ4R" })
    );
  });

  it("renders the distinct server-off 404 state, not a generic error", async () => {
    mockHandleSignup.mockResolvedValue({ status: "unavailable" });
    mockSearchParams.mockReturnValue(new URLSearchParams(OIDC_BOUNCE_QUERY));
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByTestId("signup-unavailable")).toHaveTextContent(
      /not available right now/i
    );
    // The 404 is the expected state for the whole client-on/server-off
    // rollout window, so it must not be a dead end with no way out.
    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    expectBackOutKeptTheAuthorizeBounce();
  });

  it("renders the cooldown refusal as plainly temporary, using the server's own message", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "error",
      code: "COOLDOWN",
      message: "Temporarily unavailable, try again in 12 minutes",
    });
    mockSearchParams.mockReturnValue(new URLSearchParams(OIDC_BOUNCE_QUERY));
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByTestId("signup-cooldown")).toHaveTextContent(
      "Temporarily unavailable, try again in 12 minutes"
    );
    await user.click(screen.getByRole("button", { name: /back to sign in/i }));
    expectBackOutKeptTheAuthorizeBounce();
  });

  it("routes an invalid/expired passcode back to the passcode step without distinguishing which", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "error",
      code: "INVALID_PASSCODE",
      message: "Invalid or expired signup code",
    });
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Invalid or expired signup code")).toBeInTheDocument();
    expect(screen.getByLabelText(/signup passcode/i)).toBeInTheDocument();
  });

  it("stays on the details step and shows the server's message for a validation or conflict error", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "error",
      code: "USERNAME_TAKEN",
      message: "That username is already in use.",
    });
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("That username is already in use.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
  });

  it("caps the username field at the length the server enforces", async () => {
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);

    expect(screen.getByLabelText(/^username/i)).toHaveAttribute("maxlength", "30");
  });

  it("keeps submit disabled for a username the server's own rules would reject", async () => {
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user);
    await user.type(screen.getByLabelText(/^email/i), "newdj@example.com");
    await user.type(screen.getByLabelText(/^password/i), "supersecret");
    await user.type(screen.getByLabelText(/real name/i), "New DJ");

    const username = screen.getByLabelText(/^username/i);
    const submit = () => screen.getByRole("button", { name: "Submit" });

    // Server rule: 3-30 chars from [a-zA-Z0-9_.]. Every other detail field
    // already pre-checks its shape, so username should not be the one that
    // round-trips a 400 -- the round trip is indistinguishable to the DJ from
    // a taken username, and it costs a signup attempt to find out.
    await user.type(username, "dj");
    expect(submit()).toBeDisabled();

    await user.clear(username);
    await user.type(username, "new dj");
    expect(submit()).toBeDisabled();

    await user.clear(username);
    await user.type(username, "new_dj.1");
    expect(submit()).not.toBeDisabled();
  });

  it("lets a DJ back out to the normal login form, in both modern (stage-driven) and classic (URL-driven) routing", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams("signup=1"));
    const { user, store } = renderWithProviders(<StationSignupForm />);

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));

    expect(applicationSlice.selectors.getAuthStage(store.getState())).not.toBe("signup");
    // Classic's ClassicLoginSlotSwitcher picks this form purely from
    // ?signup=1 in the URL and never reads authFlow.stage, so the dispatch
    // above alone would strand a classic DJ on this component forever.
    // Nothing else was in the query, so the bare path is the whole target.
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("keeps a live OIDC authorize bounce's params when a DJ backs out of signup", async () => {
    mockSearchParams.mockReturnValue(new URLSearchParams(OIDC_BOUNCE_QUERY));
    const { user } = renderWithProviders(<StationSignupForm />);

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));

    // Only the `signup` key is the signup detour's to spend. Replacing the URL
    // with a bare /login would leave the DJ signing in against a query string
    // that no longer describes the authorize round-trip they arrived on.
    expectBackOutKeptTheAuthorizeBounce();
  });
});
