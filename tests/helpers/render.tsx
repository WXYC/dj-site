import type { RenderOptions, RenderResult } from "@testing-library/react";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";

import { CssVarsProvider } from "@mui/joy/styles";
import type { AppStore, RootState } from "@/lib/store";
import { makeStore } from "@/lib/store";

// A caller seeds state via preloadedState (the store is built for them) or
// hands in an already-built store (e.g. to share one across renders) — never
// both, since a supplied store already has its own state and preloadedState
// would be silently discarded. This union makes that combination a type error.
type SeedOptions =
  | { preloadedState?: Partial<RootState>; store?: never }
  | { store: AppStore; preloadedState?: never };

type ExtendedRenderOptions = Omit<RenderOptions, "wrapper"> & SeedOptions;

// Custom render result that includes the store and user event utilities
interface CustomRenderResult extends RenderResult {
  store: AppStore;
  user: ReturnType<typeof userEvent.setup>;
}

// Create a test wrapper with Redux and MUI providers
function createTestWrapper(store: AppStore) {
  return function TestWrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <CssVarsProvider>{children}</CssVarsProvider>
      </Provider>
    );
  };
}

/**
 * Custom render function that wraps components with Redux and MUI providers.
 *
 * @example
 * // Basic usage
 * const { getByText, store } = renderWithProviders(<MyComponent />);
 *
 * @example
 * // Seed state via preloadedState
 * const { store } = renderWithProviders(<MyComponent />, {
 *   preloadedState: { flowsheet: { ...flowsheetSlice.getInitialState(), autoplay: true } },
 * });
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = makeStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
): CustomRenderResult {
  const user = userEvent.setup();
  const wrapper = createTestWrapper(store);

  return {
    ...rtlRender(ui, { wrapper, ...renderOptions }),
    store,
    user,
  };
}

/**
 * Create a store for use in tests.
 * Returns a fresh store instance for each test.
 */
export function createTestStore(preloadedState?: Partial<RootState>): AppStore {
  return makeStore(preloadedState);
}

// Re-export everything from @testing-library/react
export * from "@testing-library/react";
// Override the render export with our custom render
export { renderWithProviders as render };
