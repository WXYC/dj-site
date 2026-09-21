import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import DeletedArchiveListing from "@/src/components/experiences/classic/catalog/DeletedArchiveListing";

export const metadata: Metadata = {
  title: getPageTitle("Recently Deleted"),
};

/**
 * `GET /library/deleted` and `POST /library/deleted/{batchId}/restore` are
 * both gated `catalog: ['write']` — the same bar as the delete that writes
 * the archive row this screen reads, and as every other librarian-admin
 * screen in this directory. `AuthorizedView`/`RequireMD` hides affordances
 * only; the gate lives here, server-side.
 */
export default async function ClassicDeletedArchivePage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <Main>
      <DeletedArchiveListing />
    </Main>
  );
}
