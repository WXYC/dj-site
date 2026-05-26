import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyAlbumRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/catalog/album/${encodeURIComponent(id)}`);
}
