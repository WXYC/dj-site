import { defaultApplicationState } from "@/lib/features/application/types";
import { sessionOptions } from "@/lib/features/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * @deprecated Use /api/experiences/switch instead
 * This route is maintained for backwards compatibility
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const data = cookieStore.get("app_state")?.value;
  const appState = data ? JSON.parse(data) : defaultApplicationState;
  
  // Toggle between classic and modern
  const newExperience = appState.experience === "classic" ? "modern" : "classic";
  
  const newState = {
    ...appState,
    experience: newExperience,
  };
  
  // Remove old 'classic' property if it exists
  if ("classic" in newState) {
    delete (newState as any).classic;
  }
  
  cookieStore.set({
    ...sessionOptions.cookieOptions,
    name: "app_state",
    value: JSON.stringify(newState),
  });

  return NextResponse.json(newState, {
    status: 200,
  });
}
