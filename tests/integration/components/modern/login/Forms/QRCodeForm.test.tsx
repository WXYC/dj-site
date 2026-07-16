import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import { savePreferredLoginMethod } from "@/lib/features/application/login-method-storage";
import QRCodeForm from "@/src/components/experiences/modern/login/Forms/QRCodeForm";
import type { DeviceAuthorizationStatus } from "@/src/hooks/authenticationHooks";

const mockRestart = vi.fn();

// Controllable stand-in for the PR-1 polling hook. Each test sets `hookState`
// before rendering to exercise one status of the flow.
let hookState: {
  userCode?: string;
  verificationUriComplete?: string;
  status: DeviceAuthorizationStatus;
  restart: () => void;
};

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useDeviceAuthorization: () => hookState,
}));

// Assert what the QR encodes without depending on SVG pixels.
vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: { value: string }) => (
    <div data-testid="qr-code" data-value={props.value} />
  ),
}));

vi.mock("@/lib/features/application/login-method-storage", () => ({
  savePreferredLoginMethod: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  hookState = { status: "loading", restart: mockRestart };
});

describe("QRCodeForm", () => {
  it("shows a generating affordance and no QR while loading", () => {
    hookState = { status: "loading", restart: mockRestart };
    renderWithProviders(<QRCodeForm />);

    expect(screen.getByText(/Generating a sign-in code/i)).toBeInTheDocument();
    expect(screen.queryByTestId("qr-code")).not.toBeInTheDocument();
  });

  it("renders the QR encoding the verification URI and the user code while waiting", () => {
    hookState = {
      status: "waiting",
      userCode: "WDPL-XK9R",
      verificationUriComplete:
        "https://dj.wxyc.org/device?user_code=WDPL-XK9R",
      restart: mockRestart,
    };
    renderWithProviders(<QRCodeForm />);

    expect(screen.getByText("Scan to sign in")).toBeInTheDocument();
    expect(screen.getByTestId("qr-code")).toHaveAttribute(
      "data-value",
      "https://dj.wxyc.org/device?user_code=WDPL-XK9R"
    );
    expect(screen.getByText("WDPL-XK9R")).toBeInTheDocument();
    // Manual-entry hint derives the typable base from the complete URI.
    expect(screen.getByText(/dj\.wxyc\.org\/device/)).toBeInTheDocument();
  });

  it("offers regeneration when the code has expired", async () => {
    hookState = { status: "expired", restart: mockRestart };
    const { user } = renderWithProviders(<QRCodeForm />);

    expect(screen.getByText(/expired/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generate a new code" }));
    expect(mockRestart).toHaveBeenCalledTimes(1);
  });

  it("shows a terminal decline with no regenerate button when denied", () => {
    hookState = { status: "denied", restart: mockRestart };
    renderWithProviders(<QRCodeForm />);

    expect(screen.getByText("Sign-in was declined")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generate a new code" })
    ).not.toBeInTheDocument();
    // Regenerating can't fix an account-level denial, so no restart is offered.
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument();
  });

  it("offers a retry on error", async () => {
    hookState = { status: "error", restart: mockRestart };
    const { user } = renderWithProviders(<QRCodeForm />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRestart).toHaveBeenCalledTimes(1);
  });

  it("falls back to password: persists the choice and switches stage", async () => {
    hookState = { status: "denied", restart: mockRestart };
    const { user, store } = renderWithProviders(<QRCodeForm />);

    await user.click(screen.getByRole("button", { name: "Use a password instead" }));

    expect(savePreferredLoginMethod).toHaveBeenCalledWith("password");
    expect(applicationSlice.selectors.getAuthStage(store.getState())).toBe(
      "password"
    );
  });

  it("falls back to email code: persists the choice and switches stage", async () => {
    hookState = { status: "waiting", userCode: "WDPL-XK9R", restart: mockRestart };
    const { user, store } = renderWithProviders(<QRCodeForm />);

    await user.click(screen.getByRole("button", { name: "Email me a code" }));

    expect(savePreferredLoginMethod).toHaveBeenCalledWith("otp-email");
    expect(applicationSlice.selectors.getAuthStage(store.getState())).toBe(
      "otp-email"
    );
  });
});
