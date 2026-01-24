import type { Action, Slice, UnknownAction } from "@reduxjs/toolkit";
import { makeStore } from "@/lib/store";
import type { AppStore, RootState } from "@/lib/store";

/**
 * Creates a test harness for Redux slices that provides utilities for
 * both direct reducer testing and store-based testing.
 *
 * @example
 * // Direct reducer testing
 * const harness = createSliceHarness(flowsheetSlice, defaultState);
 * const result = harness.reduce(flowsheetSlice.actions.setAutoplay(true));
 * expect(result.autoplay).toBe(true);
 *
 * @example
 * // Chaining multiple actions
 * const result = harness.chain(
 *   flowsheetSlice.actions.setAutoplay(true),
 *   flowsheetSlice.actions.setSearchOpen(true)
 * );
 *
 * @example
 * // Store-based testing (for selectors with combineSlices)
 * const { dispatch, select } = harness.withStore();
 * dispatch(flowsheetSlice.actions.setAutoplay(true));
 * expect(select(flowsheetSlice.selectors.getAutoplay)).toBe(true);
 */
export function createSliceHarness<
  State,
  Name extends string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  S extends Slice<State, any, Name>
>(slice: S, initialState: State) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type SliceActions = ReturnType<Extract<S["actions"][keyof S["actions"]], (...args: any) => any>>;

  return {
    /**
     * The slice being tested
     */
    slice,

    /**
     * The initial state used for testing
     */
    initialState,

    /**
     * Apply a single action to the state
     */
    reduce(action: SliceActions | UnknownAction, state: State = initialState): State {
      return slice.reducer(state, action as Action);
    },

    /**
     * Apply multiple actions in sequence, returning the final state
     */
    chain(...actions: (SliceActions | UnknownAction)[]): State {
      return actions.reduce(
        (state, action) => slice.reducer(state, action as Action),
        initialState
      );
    },

    /**
     * Apply multiple actions starting from a custom initial state
     */
    chainFrom(state: State, ...actions: (SliceActions | UnknownAction)[]): State {
      return actions.reduce(
        (s, action) => slice.reducer(s, action as Action),
        state
      );
    },

    /**
     * Create a fresh store for testing selectors and store integration.
     * Use this when selectors require the full RootState (combineSlices).
     */
    withStore(): SliceStoreHarness<S> {
      const store = makeStore();
      return {
        store,
        dispatch: (action: SliceActions | UnknownAction) => {
          store.dispatch(action as Action);
        },
        getState: () => store.getState(),
        select: <T>(selector: (state: RootState) => T): T => {
          return selector(store.getState());
        },
      };
    },
  };
}

export interface SliceStoreHarness<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  S extends Slice<any, any, any>
> {
  store: AppStore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: (action: ReturnType<Extract<S["actions"][keyof S["actions"]], (...args: any) => any>> | UnknownAction) => void;
  getState: () => RootState;
  select: <T>(selector: (state: RootState) => T) => T;
}
