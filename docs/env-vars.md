# Environment Variables

Copy `.env.example` to `.env.local`. Defaults:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8082/auth
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED=false

# Optional, server-only — override target for the /auth/:path* rewrite in
# containerized deployments where NEXT_PUBLIC_BETTER_AUTH_URL is reachable
# from the browser but not from inside the dj-site server.
# AUTH_REWRITE_URL=http://auth:8082/auth
```

## Feature flags

- `NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED` — gates the track-search UI surfaces in catalog search: the `matched_via` track-match chip rendering in result rows (both classic and modern experiences) and the classic `SearchForm` help-text refresh (worked track-lookup example replacing the legacy "Coming later" line). Defaults to OFF; set to `"true"` or `"1"` to enable. Helper: `isCatalogTrackSearchUiEnabled()` in `lib/features/catalog/flags.ts`. Flip on after Backend-Service is serving `matched_via` in prod. See WXYC/dj-site#497 and WXYC/dj-site#498.
