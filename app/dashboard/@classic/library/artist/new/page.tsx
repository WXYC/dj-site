import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import CreateLibraryCodeForm from "@/src/components/experiences/classic/catalog/CreateLibraryCodeForm";
import { firstSearchParam } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: getPageTitle("Create Library Code"),
};

type ClassicCreateLibraryCodePageProps = {
  searchParams: Promise<{
    genre_id?: string | string[];
    code_letters?: string | string[];
    code_number?: string | string[];
  }>;
};

/**
 * Reproduces `createLibraryCode.jsp`: the miss branch of
 * `findOrCreateLibraryCode` (`ArtistAdminServlet:161`). URL-reachable on its
 * own route, taking the code that missed as query params, ahead of
 * WXYC/dj-site#1198 wiring the chooser's no-match branch into it. Not linked
 * in nav -- see `isClassicLibrarianNavEnabled`.
 */
export default async function ClassicCreateLibraryCodePage({
  searchParams,
}: ClassicCreateLibraryCodePageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const params = await searchParams;

  return (
    <Main>
      <CreateLibraryCodeForm
        genreIdRaw={firstSearchParam(params.genre_id) ?? ""}
        codeLetters={firstSearchParam(params.code_letters) ?? ""}
        codeNumberRaw={firstSearchParam(params.code_number) ?? ""}
      />
    </Main>
  );
}
