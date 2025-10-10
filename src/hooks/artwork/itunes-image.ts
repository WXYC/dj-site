import { toast } from "sonner";

export default async function getArtworkFromItunes({
  title,
  artist,
}: {
  title: string;
  artist: string;
}) {
  try {
    const searchTerm = encodeURIComponent(`${title} ${artist}`);
    const url = `https://itunes.apple.com/search?term=${searchTerm}&entity=album`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`Failed to fetch album art from iTunes (${response.status})`);
      return null;
    }
    
    const jsonResponse = await response.json();
    
    const lowResDefault = jsonResponse?.results?.[0]?.artworkUrl100;
    if (!lowResDefault) {
      return null;
    }
    
    return lowResDefault.replace("100x100", "600x600");
  } catch (e) {
    console.log("Error fetching album art from iTunes");
    return null;
  }
}
