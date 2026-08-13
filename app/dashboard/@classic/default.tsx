import { createServerSideProps } from "@/lib/features/session";
import ExperienceGap from "@/src/components/experiences/classic/ExperienceGap";

/**
 * Fallback for every `/dashboard` URL the classic slot has no page for.
 *
 * Returning `null` here paints an empty container with no navigation, which is
 * indistinguishable from a broken page. Living in `default.tsx` rather than in
 * per-route stubs means a modern-only route added later is covered without a
 * matching classic file.
 */
export default async function ClassicDefault() {
  const { application } = await createServerSideProps();

  return (
    <ExperienceGap
      colorMode={application.colorMode}
      themeId={application.themeId}
    />
  );
}
