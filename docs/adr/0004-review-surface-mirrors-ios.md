# Reviews surface mirrors the iOS model — one per album, author-owned, MD-curated queue, internal-only

The reviews model gets extended in Backend-Service (one Review per Album, owned by `author_dj_id`, with `headline`, `rotation_hint`, `fcc_explicit`, tags, callouts, `rating`, and an MD-curated `review_queue` with 14-day soft claim locks). The iOS DJ tool is the first surface to consume this; **this app needs a parallel review view** so DJs and MDs can author, edit, claim queued albums, and browse reviews from the web too.

Scope for the dj-site mirror, deferred until iOS proves the UX:
1. **Review editor** (per-album) — headline, rotation_hint, fcc_explicit, tags, callouts, rating. Author edits anytime; MD can transfer authorship.
2. **MD review queue dashboard** — list claimable albums, claim/release, see soft-lock expiration.
3. **Album → existing review** — link from catalog detail to the canonical review if one exists.

Reviews are internal-only for v1 (signed-in DJs see them on iOS and dj-site, not on listener-facing wxyc.org). A `published_publicly` flag on the Backend-Service schema is the forward-compatible hook for the future listener-facing rollout paired with the [`694-public-dj-handle`](https://github.com/WXYC/dj-site) DJ-profile work.

Canonical source: [`wxyc-dj-tool-ios/docs/cross-repo-adrs.md` ADR 0005](https://github.com/WXYC/wxyc-dj-tool-ios/blob/main/docs/cross-repo-adrs.md#adr-0005--reviews-are-one-per-album-author-owned-internal-only-with-an-md-curated-queue).

## Consequences

- We can ship the parallel review surface after iOS proves the model — the Backend-Service schema and endpoints land once and we consume the same shape iOS does. No coordination cliff.
- The MD queue is a new operational surface for us; if iOS ships the dashboard first, we have a real reference UX rather than designing in a vacuum.
- Tag vocabulary is MD-curated (not freeform). Our admin surface needs a tag-vocabulary CRUD view for MDs — a small lift that complements the queue dashboard.
- "Internal-only for v1" means the existing public review snippets on wxyc.org (if any) are out of scope for this work; the public migration is the C4 coordination item in the iOS cross-repo doc.
