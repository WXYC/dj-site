import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
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

// Gated at authenticated-DJ, never MD: `mainmenu.jsp` places both rotation
// links outside its hasAdminAccess() block, and Backend agrees --
// `GET /library/rotation` and `GET /library/rotation/uncatalogued` are
// gated at `catalog: ['read']`, while every rotation write requires
// `catalog: ['write']`. Reading the list (and its Awaiting Cataloging
// facet) is DJ-accessible; only `/dashboard/rotation/new` -- the write
// surface -- is MD.
//
// `status` is read server-side and passed down, matching
// `ClassicCreateLibraryCodePage` -> `CreateLibraryCodeForm`'s convention:
// the JSP's own facet chips are real links to a new `status=` value (a full
// navigation, not a client-side tab), so a URL is the single source of
// truth for which facet is showing -- an unrecognized or absent value
// silently falls back to the default (active-only) rather than erroring.
export default async function ClassicRotationListPage({ searchParams }: ClassicRotationListPageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.DJ);

  const params = await searchParams;
  const statusFilter = parseStatusFilter(firstSearchParam(params.status));

  return (
    <Main>
      <RotationReleaseList statusFilter={statusFilter} />
    </Main>
  );
}
