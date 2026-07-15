import { defaultApplicationState } from "@/lib/features/application/types";
import { isExperienceId } from "@/lib/features/experiences/types";
import { sessionOptions } from "@/lib/features/session";
import { guardAppStateMutation } from "@/lib/features/session-guards";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const guardResponse = await guardAppStateMutation(request);
  if (guardResponse) {
    return guardResponse;
  }

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
  let currentState = defaultApplicationState;
  if (data) {
    try {
      currentState = { ...defaultApplicationState, ...JSON.parse(data) };
    } catch (error) {
      console.error("Failed to parse app_state", error);
    }
  }
  
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

