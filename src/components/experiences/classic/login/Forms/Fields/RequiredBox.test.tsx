import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import RequiredBox from "./RequiredBox";
import { renderWithProviders } from "@/lib/test-utils";
import { authenticationSlice } from "@/lib/features/authentication/frontend";

describe("RequiredBox", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render with label", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="User Login" />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText("User Login:")).toBeInTheDocument();
  });

  it("should render input with text type by default", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "text");
  });

  it("should render input with password type when specified", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="password" title="Password" type="password" />
          </tr>
        </tbody>
      </table>
    );
    // Password inputs don't have role="textbox", find by name
    const input = document.querySelector('input[name="password"]');
    expect(input).toHaveAttribute("type", "password");
  });

  it("should display invalid indicator initially (empty input)", async () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );
    // Initially the input is empty, should show invalid indicator
    await waitFor(() => {
      expect(screen.getByText("❌")).toBeInTheDocument();
    });
  });

  it("should display valid indicator when input has value", async () => {
    const { user } = renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "testuser");

    await waitFor(() => {
      expect(screen.getByText("✅")).toBeInTheDocument();
    });
  });

  it("should update verification state on input change", async () => {
    const { user, store } = renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "testuser");

    await waitFor(() => {
      const state = store.getState();
      expect(
        authenticationSlice.selectors.getVerification(state, "username")
      ).toBe(true);
    });
  });

  it("should set verification to false when input is cleared", async () => {
    const { user, store } = renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "testuser");

    await waitFor(() => {
      expect(
        authenticationSlice.selectors.getVerification(
          store.getState(),
          "username"
        )
      ).toBe(true);
    });

    await user.clear(input);

    await waitFor(() => {
      expect(
        authenticationSlice.selectors.getVerification(
          store.getState(),
          "username"
        )
      ).toBe(false);
    });
  });

  it("should be disabled when disabled prop is true", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" disabled={true} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("should be enabled when disabled prop is false", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" disabled={false} />
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByRole("textbox")).not.toBeDisabled();
  });

  it("should render label in bold", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="User Login" />
          </tr>
        </tbody>
      </table>
    );
    const boldElement = document.querySelector("b");
    expect(boldElement).toHaveTextContent("User Login:");
  });

  it("should have label cell aligned right with label class", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="User Login" />
          </tr>
        </tbody>
      </table>
    );
    const labelCell = screen.getByText("User Login:").closest("td");
    expect(labelCell).toHaveAttribute("align", "right");
    expect(labelCell).toHaveClass("label");
  });

  it("should set input name attribute from name prop", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("name", "username");
  });

  it("should handle password field name", () => {
    renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="password" title="Password" type="password" />
          </tr>
        </tbody>
      </table>
    );
    const input = document.querySelector('input[name="password"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("name", "password");
  });

  it("should sync from DOM on mount with delayed checks", async () => {
    const { store } = renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );

    // Advance timers to trigger the DOM sync effects
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(300);

    // Initially should be false since input is empty
    await waitFor(() => {
      expect(
        authenticationSlice.selectors.getVerification(
          store.getState(),
          "username"
        )
      ).toBe(false);
    });
  });

  it("should handle value change effect when validation state needs update", async () => {
    const { user, store } = renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );

    // Initially, validated is false and value is empty (isValid=false)
    // validated === isValid, so no update needed
    expect(
      authenticationSlice.selectors.getVerification(store.getState(), "username")
    ).toBe(false);

    const input = screen.getByRole("textbox");

    // Type a character - this should trigger the onChange handler
    // which calls reportValidation directly, then the effect runs
    await user.type(input, "a");

    // Now validated should be true
    await waitFor(() => {
      expect(
        authenticationSlice.selectors.getVerification(store.getState(), "username")
      ).toBe(true);
    });
  });

  it("should run cleanup function on unmount", () => {
    const { unmount } = renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );

    // Advance a bit for the timer to be set
    vi.advanceTimersByTime(10);

    // Unmount should clear the timers (the cleanup function)
    unmount();

    // Advance past when timers would fire
    vi.advanceTimersByTime(500);

    // No errors should occur - timers were cleared
  });

  it("should handle syncFromDom when DOM value differs from state", async () => {
    const { store } = renderWithProviders(
      <table>
        <tbody>
          <tr>
            <RequiredBox name="username" title="Username" />
          </tr>
        </tbody>
      </table>
    );

    // Get the input and directly set its value (simulating browser autofill)
    const input = document.querySelector('input[name="username"]') as HTMLInputElement;

    // Directly set the DOM value (simulating browser autofill)
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, "autofilled");

    // Trigger the sync by advancing timers within act()
    await act(async () => {
      vi.advanceTimersByTime(0);
      vi.advanceTimersByTime(300);
    });

    // The syncFromDom should detect the DOM value differs and update state
    await waitFor(() => {
      // After sync, the validation should reflect the filled state
      expect(
        authenticationSlice.selectors.getVerification(store.getState(), "username")
      ).toBe(true);
    });
  });
});
