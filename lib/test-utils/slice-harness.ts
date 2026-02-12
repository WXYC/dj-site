import type { Action, Slice, UnknownAction } from "@reduxjs/toolkit";
import { describe, beforeEach } from "vitest";
import { makeStore } from "@/lib/store";
import type { AppStore, RootState } from "@/lib/store";

/**
 * Describes a Redux slice with automatic harness setup.
 * Eliminates boilerplate for slice testing.
 *
 * @example
 * describeSlice(flowsheetSlice, defaultFlowsheetFrontendState, ({ harness, actions }) => {
 *   it("should set autoplay", () => {
 *     const result = harness().reduce(actions.setAutoplay(true));
 *     expect(result.autoplay).toBe(true);
 *   });
 * });
 */
export function describeSlice<
  State,
  Name extends string,
   
  S extends Slice<State, any, Name>
>(
  slice: S,
  defaultState: State,
  testFn: (ctx: SliceTestContext<State, Name, S>) => void
): void {
  describe(slice.name + "Slice", () => {
    let currentHarness: ReturnType<typeof createSliceHarness<State, Name, S>>;

    beforeEach(() => {
      currentHarness = createSliceHarness(slice, defaultState);
    });

    const context: SliceTestContext<State, Name, S> = {
      harness: () => currentHarness,
      actions: slice.actions as S["actions"],
      selectors: slice.selectors as S["selectors"],
      slice,
    };

    testFn(context);
  });
}

export interface SliceTestContext<
  State,
  Name extends string,
   
  S extends Slice<State, any, Name>
> {
  harness: () => ReturnType<typeof createSliceHarness<State, Name, S>>;
  actions: S["actions"];
  selectors: S["selectors"];
  slice: S;
}

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
   
  S extends Slice<State, any, Name>
>(slice: S, initialState: State) {
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
    reduce(action: UnknownAction, state: State = initialState): State {
      return slice.reducer(state, action as Action);
    },

    /**
     * Apply multiple actions in sequence, returning the final state
     */
    chain(...actions: (UnknownAction)[]): State {
      return actions.reduce(
        (state, action) => slice.reducer(state, action as Action),
        initialState
      );
    },

    /**
     * Apply multiple actions starting from a custom initial state
     */
    chainFrom(state: State, ...actions: (UnknownAction)[]): State {
      return actions.reduce(
        (s, action) => slice.reducer(s, action as Action),
        state
      );
    },

    /**
     * Create a fresh store for testing selectors and store integration.
     * Use this when selectors require the full RootState (combineSlices).
     */
    withStore(): SliceStoreHarness {
      const store = makeStore();
      return {
        store,
        dispatch: (action: UnknownAction) => {
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

export interface SliceStoreHarness {
  store: AppStore;
  dispatch: (action: UnknownAction) => void;
  getState: () => RootState;
  select: <T>(selector: (state: RootState) => T) => T;
}
