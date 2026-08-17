import type { JSX } from "react";
import { resolveAuthGate } from "@/lib/features/authentication/server-utils";
import ThemedLayout, { ThemedLayoutProps } from "@/src/ThemedLayout";
import { StoreProvider } from "@/src/StoreProvider";
import SessionUnavailable from "./SessionUnavailable";

// The full slice/API store is scoped to the authenticated dashboard, nested
// inside the app-wide public store. Dashboard-only feature graphs (admin
// roster, catalog, rotation, autoDJ, bin, metadata, LML) resolve here and stay
// out of the public routes' client bundles.
//
// On a failed session read, `resolveAuthGate` returns `{ ok: false }` instead
// of redirecting, and this branch renders `SessionUnavailable` in place of
// `props.classic` / `props.modern` / `props.information` — those subtrees,
// and every `requireAuth()` gate inside them, never render. Memoization does
// not protect them here: a page under one of those slots would get the same
// cached failed read from `resolveAuthGate`/`requireAuth` and redirect to
// `/login`, overriding this notice and reproducing the exact sign-out this
// branch exists to prevent. What protects them is structural — an
// unavailable read never puts those props in the returned tree at all.
//
// That protection covers full-document loads only — soft navigation does not
// re-run this layout, so a page reached by client-side nav can still bounce
// during an outage. See docs/architecture.md's dashboard-layout section for
// the residue and what would close it.
const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> => {
  const gate = await resolveAuthGate();
  if (!gate.ok) {
    return <SessionUnavailable status={gate.status} />;
  }

  const themed = await ThemedLayout(props);
  return <StoreProvider>{themed}</StoreProvider>;
};

export default Layout;
