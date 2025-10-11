import { defaultApplicationState } from "@/lib/features/application/types";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const data = cookieStore.get("app_state");
  let experience = defaultApplicationState.experience;
  
  if (data?.value) {
    try {
      const appState = JSON.parse(data.value);
      // Support both old 'classic' boolean and new 'experience' string
      if ("experience" in appState) {
        experience = appState.experience;
      } else if ("classic" in appState) {
        experience = appState.classic ? "classic" : "modern";
      }
    } catch (e) {
      console.error("Failed to parse app_state", e);
    }
  }

  return NextResponse.json({ experience }, { status: 200 });
}

