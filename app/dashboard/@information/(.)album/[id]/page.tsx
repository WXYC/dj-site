import AlbumDetailModal from "@/src/components/experiences/modern/catalog/album/AlbumDetailModal";

// Intercepts soft navigation to /dashboard/album/[id]: the card renders as a
// modal over whatever page the DJ is on.
export default function AlbumDetailInterceptedPage() {
  return <AlbumDetailModal />;
}
