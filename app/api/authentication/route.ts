import { getSession } from "@/lib/features/authentication/client";

export const runtime = "edge";

export async function GET() {
  try {
    const session = await getSession();
    return Response.json({ session: session?.data || null });
  } catch (error) {
    console.warn(`[Auth API] Error getting session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return Response.json({ session: null });
  }
}
