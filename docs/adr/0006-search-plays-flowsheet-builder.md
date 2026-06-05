# iOS adopts our `PlaylistAdvancedSearch` shape; future convergence onto `POST /flowsheet/search`

The iOS DJ tool's v2 Search Plays surface mirrors our [`PlaylistAdvancedSearch.tsx`](../../src/components/experiences/modern/playlist-search/PlaylistAdvancedSearch.tsx) UX model directly: unlimited filter rows, per-row field selector (Artist / Song / Album / Label / DJ / Date / Date Range), per-row AND / OR / NOT operator between rows, per-row exact-match checkbox on text fields, date pickers for date fields, linear left-to-right evaluation with no parentheses. iOS builds the equivalent as a builder sheet behind a [Filters] affordance on a single primary search bar — same model, mobile-native presentation.

This means our component shape is now the cross-repo standard for "advanced search builder" in the WXYC ecosystem. The same shape we already pay a duplication cost on internally (catalog `QueryBuilder.tsx` and playlist `PlaylistAdvancedSearch.tsx` are nearly identical) is the shape iOS factored into a reusable primitive (`FilterBuilder<FieldConfig>` in `WXYCDJTool/Sources/Views/FilterBuilder/`) so they don't repeat our drift.

Backend-side, iOS consumes a new endpoint — `POST /flowsheet/search` — that takes a structured JSON body matching the builder's row shape and returns paginated results plus an always-included `year_counts` / `month_counts` histogram side-channel. We continue to use our current playlist-search backend; the two surfaces run in parallel.

Canonical source: [`wxyc-dj-tool-ios/docs/cross-repo-adrs.md` ADR 0009](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/cross-repo-adrs.md#adr-0009--flowsheet-archive-search-is-a-distinct-ios-mode-with-a-reusable-structured-filter-builder) and the repo-local [iOS ADR 0004](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/adr/0004-search-plays-flowsheet-builder.md). BS-side mirror at [`Backend-Service/docs/adr/0010-search-plays-flowsheet-builder.md`](https://github.com/WXYC/Backend-Service/blob/main/docs/adr/0010-search-plays-flowsheet-builder.md).

## Our side of the work (v1)

- **Nothing.** Our playlist search keeps using `PlaylistAdvancedSearch.tsx` against its current backend; nothing about that UX or backend changes for v1.
- **Avoid divergence**: if we change `PlaylistAdvancedSearch.tsx`'s field set, operator set, or per-row semantics in non-trivial ways, file an ADR amendment here so the iOS team can keep its `FilterBuilder` primitive in sync. The two consumers (us + iOS) should evolve together to keep the eventual convergence cheap.

## Our side of the work (future convergence — separate ADR, not v1)

- **File a follow-up ADR** when we're ready to migrate `PlaylistAdvancedSearch.tsx` onto `POST /flowsheet/search`. Migration is a backend-only change from our perspective — the UI component stays exactly the same, only its data-fetching layer swaps. Expected benefits: one backend serving both surfaces, retire the legacy playlist-search backend, gain the histogram side-channel that today's UI doesn't expose, gain date/date-range filters that today's text-syntax doesn't support cleanly.
- **Coordinate timing with Backend-Service**. The endpoint exists in BS for iOS's use as soon as ADR 0010 ships there; the migration is purely "when is it our turn to swap." No deadline; the iOS surface running first is fine and arguably ideal (it lets us watch real usage shape any endpoint refinements before we commit our UI to the same shape).

## Consequences for us

- **Our component design choices have downstream weight.** iOS modelled directly on what we have — field set, operator set, row evaluation semantics. Future redesigns ripple to a second consumer; "we can just change it" is no longer true without coordination.
- **The internal duplication smell (`QueryBuilder.tsx` + `PlaylistAdvancedSearch.tsx`) becomes more visible** now that iOS has built a parameterized primitive solving exactly that problem. Worth a separate refactor task to factor a similar `<FilterBuilder fieldConfig={...} />` on our side — payoff would be consistent behavior across our two builders plus a clean primitive for any third in-app search surface we add later. Not gated on the convergence ADR — internal refactor is independent.
- **The histogram side-channel becomes a UX we don't yet expose.** When we eventually migrate, our playlist-search results page gains a plays-per-year bar chart for free (the response carries `year_counts` / `month_counts` already). Today's UI has nothing to render with; we'd want a small Chart.js (or whatever we're standardized on) integration ticket as part of the migration scope.

## Related repos and tickets

- iOS ADR + sub-tickets in [`wxyc-dj-tool-ios/docs/bs-work-inventory.md`](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/bs-work-inventory.md) BS-32 (endpoint) and BS-33 (OpenAPI).
- BS mirror at [`Backend-Service/docs/adr/0010-...`](https://github.com/WXYC/Backend-Service/blob/main/docs/adr/0010-search-plays-flowsheet-builder.md).
- iOS prototype mockup demonstrating the three UX options considered: [`wxyc-dj-tool-ios/docs/prototypes/search-ux-options.html`](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/prototypes/search-ux-options.html) (option E = builder sheet, the chosen one, matches our `PlaylistAdvancedSearch.tsx` model).
