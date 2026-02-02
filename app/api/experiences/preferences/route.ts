import { defaultApplicationState } from "@/lib/features/application/types";
import { parseAppSkinPreference, toAppSkinPreference, isColorMode } from "@/lib/features/experiences/preferences";
import { isExperienceId } from "@/lib/features/experiences/types";
import { sessionOptions } from "@/lib/features/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const body = await request.json();

  const { preference, experience, colorMode } = body ?? {};
  const parsedPreference = parseAppSkinPreference(preference);

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

  const resolvedExperience = parsedPreference?.experience ?? experience ?? currentState.experience;
  const resolvedColorMode = parsedPreference?.colorMode ?? colorMode ?? currentState.colorMode;

  if (!isExperienceId(resolvedExperience)) {
    return NextResponse.json(
      { error: "Invalid experience", experience: currentState.experience },
      { status: 400 }
    );
  }

  if (!isColorMode(resolvedColorMode)) {
    return NextResponse.json(
      { error: "Invalid color mode", colorMode: currentState.colorMode },
      { status: 400 }
    );
  }

  const newState = {
    ...currentState,
    experience: resolvedExperience,
    colorMode: resolvedColorMode,
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

  return NextResponse.json(
    {
      experience: resolvedExperience,
      colorMode: resolvedColorMode,
      preference: toAppSkinPreference(resolvedExperience, resolvedColorMode),
    },
    { status: 200 }
  );
}
