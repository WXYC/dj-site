import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import StationSignupForm from "@/src/components/experiences/modern/login/Forms/StationSignupForm";
import type { StationSignupOutcome } from "@/lib/features/authentication/client";

const mockHandleSignup = vi.fn<(request: unknown) => Promise<StationSignupOutcome>>();
const mockReplace = vi.fn<(href: string) => void>();
const mockSearchParams = vi.fn<() => URLSearchParams>();

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useStationSignup: () => ({
    handleSignup: mockHandleSignup,
    isLoading: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams(),
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

async function fillPasscodeStep(user: ReturnType<typeof renderWithProviders>["user"], passcode = "abc-123") {
  await user.type(screen.getByLabelText(/signup passcode/i), passcode);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

async function fillDetailsStep(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.type(screen.getByLabelText(/^username/i), "newdj");
  await user.type(screen.getByLabelText(/^email/i), "newdj@example.com");
  await user.type(screen.getByLabelText(/^password/i), "supersecret");
  await user.type(screen.getByLabelText(/real name/i), "New DJ");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams.mockReturnValue(new URLSearchParams(""));
});

describe("StationSignupForm", () => {
  it("starts on the passcode step and moves to details on continue, with no network call yet", async () => {
    const { user } = renderWithProviders(<StationSignupForm />);

    expect(screen.getByLabelText(/signup passcode/i)).toBeInTheDocument();
    await fillPasscodeStep(user);

    expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
    expect(mockHandleSignup).not.toHaveBeenCalled();
  });

  it("submits passcode and details together and shows a pending-review confirmation on success", async () => {
    mockHandleSignup.mockResolvedValue({
      status: "success",
      username: "newdj",
      email: "newdj@example.com",
    });
    const { user } = renderWithProviders(<StationSignupForm />);

    await fillPasscodeStep(user, "abc-123");
    await fillDetailsStep(user);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(mockHandleSignup).toHaveBeenCalledWith({
      passcode: "abc-123",
      username: "newdj",
      email: "newdj@example.com",
      password: "supersecret",
      realName: "New DJ",
      djName: undefined,
    });
    expect(await screen.findByTestId("signup-success")).toHaveTextContent(/pending/i);
    expect(screen.getByTestId("signup-success")).toHaveTextContent("newdj");
    // The 201 returns username AND email off the created row -- show both.
    expect(screen.getByTestId("signup-success")).toHaveTextContent("newdj@example.com");
    // A station-signup account is provisioned with the dj role and works
    // immediately -- review happens after the fact. The confirmation must
    // not claim sign-in is blocked on review.
    expect(screen.getByTestId("signup-success")).toHaveTextContent(/sign in with it right away/i);
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

  it("never joins the remembered login-method preference: the entry stage is not persisted", () => {
    renderWithProviders(<StationSignupForm />, {
      preloadedState: {
        application: {
          rightbar: { sidebarOpen: false, panel: { type: "default" } },
          authFlow: { stage: "signup" },
        },
      },
    });

    // Rendering the signup stage directly must never touch localStorage's
    // preferred-method key — that bookkeeping belongs only to otp-email/password/qr.
    expect(localStorage.getItem("wxyc_preferred_login_method")).toBeNull();
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
