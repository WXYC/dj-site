import React from "react";
import { screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./render";
import type { AppStore, RootState } from "@/lib/store";

type UserEvent = ReturnType<typeof userEvent.setup>;

export interface ComponentHarnessResult extends RenderResult {
  store: AppStore;
  user: UserEvent;
  getState: () => RootState;
}

/**
 * Creates a reusable test harness for a React component.
 * Reduces boilerplate by pre-configuring default props and common queries.
 *
 * @example
 * const setup = createComponentHarness(SearchBar, { color: "primary" });
 *
 * // In tests:
 * it("should render", () => {
 *   const { getByPlaceholder } = setup();
 *   expect(getByPlaceholder("Search")).toBeInTheDocument();
 * });
 *
 * // Override props:
 * it("should accept different colors", () => {
 *   setup({ color: "success" });
 * });
 */
export function createComponentHarness<P extends object>(
  Component: React.ComponentType<P>,
  defaultProps: P
) {
  return function setup(propsOverride?: Partial<P>): ComponentHarnessResult {
    const props = { ...defaultProps, ...propsOverride } as P;
    const result = renderWithProviders(React.createElement(Component, props));

    return {
      ...result,
      getState: () => result.store.getState(),
    };
  };
}

/**
 * Creates a component harness with pre-defined element queries.
 * Queries are lazily evaluated, so they always return fresh elements.
 *
 * @example
 * const setup = createComponentHarnessWithQueries(
 *   SearchBar,
 *   { color: "primary" },
 *   {
 *     input: () => screen.getByPlaceholderText("Search"),
 *     label: () => screen.getByText("Search for an album or artist"),
 *     clearButton: () => screen.queryByRole("button", { name: "" }),
 *   }
 * );
 *
 * // In tests:
 * it("should clear search", async () => {
 *   const { input, clearButton, user } = setup();
 *   await user.type(input(), "test");
 *   await user.click(clearButton()!);
 *   expect(input()).toHaveValue("");
 * });
 */
export function createComponentHarnessWithQueries<
  P extends object,
  Q extends Record<string, () => HTMLElement | null>
>(
  Component: React.ComponentType<P>,
  defaultProps: P,
  queries: Q
): (propsOverride?: Partial<P>) => ComponentHarnessResult & Q {
  return function setup(propsOverride?: Partial<P>) {
    const props = { ...defaultProps, ...propsOverride } as P;
    const result = renderWithProviders(React.createElement(Component, props));

    return {
      ...result,
      ...queries,
      getState: () => result.store.getState(),
    };
  };
}

/**
 * Common query factories for frequently used element lookups.
 */
export const queryFactories = {
  byPlaceholder: (text: string) => () => screen.getByPlaceholderText(text),
  byText: (text: string) => () => screen.getByText(text),
  byRole: (role: string, options?: { name?: string }) => () =>
    screen.getByRole(role, options),
  byTestId: (testId: string) => () => screen.getByTestId(testId),
  byLabelText: (text: string) => () => screen.getByLabelText(text),

  // Query variants (return null if not found)
  queryByPlaceholder: (text: string) => () => screen.queryByPlaceholderText(text),
  queryByText: (text: string) => () => screen.queryByText(text),
  queryByRole: (role: string, options?: { name?: string }) => () =>
    screen.queryByRole(role, options),
  queryByTestId: (testId: string) => () => screen.queryByTestId(testId),
};

/**
 * Helper to test that a component renders without errors with various prop combinations.
 *
 * @example
 * testPropVariants(SearchBar, { color: "primary" }, [
 *   { color: "success" },
 *   { color: "neutral" },
 *   { color: undefined },
 * ]);
 */
export function testPropVariants<P extends object>(
  Component: React.ComponentType<P>,
  defaultProps: P,
  variants: Partial<P>[],
  assertion: (result: ComponentHarnessResult) => void = () => {}
) {
  const setup = createComponentHarness(Component, defaultProps);

  variants.forEach((variant, index) => {
    const result = setup(variant);
    assertion(result);
    result.unmount();
  });
}
