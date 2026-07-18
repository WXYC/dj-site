import AlbumDetailModal from "@/src/components/experiences/modern/catalog/album/AlbumDetailModal";

// Hard-navigation fallback (pasted permalink, refresh): the card renders over
// the default dashboard.
export default function AlbumDetailPage() {
  return <AlbumDetailModal viaHardNavigation />;
}
