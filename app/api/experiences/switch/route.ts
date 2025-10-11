import { defaultApplicationState } from "@/lib/features/application/types";
import { isExperienceId } from "@/lib/features/experiences/types";
import { sessionOptions } from "@/lib/features/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const body = await request.json();
  
  const requestedExperience = body.experience;
  
  // Validate the experience
  if (!isExperienceId(requestedExperience)) {
    return NextResponse.json(
      { error: "Invalid experience", experience: defaultApplicationState.experience },
      { status: 400 }
    );
  }

  // Get current state
  const data = cookieStore.get("app_state")?.value;
  const currentState = data ? JSON.parse(data) : defaultApplicationState;
  
  // Update with new experience
  const newState = {
    ...currentState,
    experience: requestedExperience,
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

  return NextResponse.json({ experience: requestedExperience }, { status: 200 });
}

