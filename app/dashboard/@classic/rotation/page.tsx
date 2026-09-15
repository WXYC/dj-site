import { Metadata } from "next";
import { cookies } from "next/headers";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole, checkRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import RotationReleaseList from "@/src/components/experiences/classic/rotation/RotationReleaseList";
import { firstSearchParam } from "@/lib/utils/search-params";
import { DEFAULT_ROTATION_STATUS_FILTER, type RotationStatusFilter } from "@/lib/features/rotation/types";

export const metadata: Metadata = {
  title: getPageTitle("Rotation Releases"),
};

const VALID_STATUS_FILTERS: readonly RotationStatusFilter[] = ["all", "active", "killed", "uncataloged"];

function parseStatusFilter(raw: string | undefined): RotationStatusFilter {
  return (VALID_STATUS_FILTERS as readonly string[]).includes(raw ?? "")
    ? (raw as RotationStatusFilter)
    : DEFAULT_ROTATION_STATUS_FILTER;
}

type ClassicRotationListPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

// Gated at authenticated-DJ, never MD, for the *read*: `mainmenu.jsp` places
// both rotation links outside its hasAdminAccess() block, and Backend
// agrees -- `GET /library/rotation` and `GET /library/rotation/uncatalogued`
// are gated at `catalog: ['read']`. Reading the list (and its Awaiting
// Cataloging facet) is DJ-accessible.
//
// Every rotation write is MD, though. `/dashboard/rotation/new`, `/[id]` and
// `/[id]/import` each gate at `Authorization.MD` on their own pages, and
// Backend requires `catalog: ['write']` for the writes this screen's own row
// actions and header link post to. `canWrite` below resolves that once,
// here, and is threaded down as a required prop rather than left for
// `RotationReleaseList` to render controls that always 403.
//
// `status` is read server-side and passed down, matching
// `ClassicCreateLibraryCodePage` -> `CreateLibraryCodeForm`'s convention:
// the JSP's own facet chips are real links to a new `status=` value (a full
// navigation, not a client-side tab), so a URL is the single source of
// truth for which facet is showing -- an unrecognized or absent value
// silently falls back to the default (active-only) rather than erroring.
export default async function ClassicRotationListPage({ searchParams }: ClassicRotationListPageProps) {
  const session = await requireAuth();
  const cookieHeader = (await cookies()).toString();
  await requireRole(session, Authorization.DJ, cookieHeader);

  // Same header, same request -> getOrgRoleCached is a cache hit, no extra
  // fetch: the page has already paid for this answer via requireRole above.
  const canWrite = await checkRole(session, Authorization.MD, cookieHeader);

  const params = await searchParams;
  const statusFilter = parseStatusFilter(firstSearchParam(params.status));

  return (
    <Main>
      <RotationReleaseList statusFilter={statusFilter} canWrite={canWrite} />
    </Main>
  );
}
