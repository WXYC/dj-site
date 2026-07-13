import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applicationSlice } from "@/lib/features/application/frontend";
import LoginSlotSwitcher from "./LoginSlotSwitcher";

const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamsGet(key),
  }),
}));

function renderSwitcher(isIncomplete: boolean, token: string | null) {
  mockSearchParamsGet.mockImplementation((key: string) =>
    key === "token" ? token : null
  );

  const store = configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
  });

  return render(
    <Provider store={store}>
      <LoginSlotSwitcher
        isIncomplete={isIncomplete}
        normal={<div>Normal login</div>}
        newuser={<div>Incomplete onboarding</div>}
        reset={<div>Password reset</div>}
      />
    </Provider>
  );
}

describe("LoginSlotSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the reset slot when ?token= is present, even if isIncomplete is true", () => {
    renderSwitcher(true, "reset-token-abc");

    expect(screen.getByText("Password reset")).toBeInTheDocument();
    expect(screen.queryByText("Incomplete onboarding")).not.toBeInTheDocument();
  });

  it("shows the incomplete onboarding slot when there is no reset token", () => {
    renderSwitcher(true, null);

    expect(screen.getByText("Incomplete onboarding")).toBeInTheDocument();
  });
});
