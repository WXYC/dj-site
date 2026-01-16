import { defaultApplicationState } from "@/lib/features/application/types";
import { parseAppSkinPreference, toAppSkinPreference, isColorMode } from "@/lib/features/experiences/preferences";
import { isExperienceId } from "@/lib/features/experiences/types";
import { sessionOptions } from "@/lib/features/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/7be3dc8b-1b33-42b3-9bd8-f0412303cb87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/experiences/preferences/route.ts:9',message:'preferences route entry',data:{hasBody:request.body !== null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/7be3dc8b-1b33-42b3-9bd8-f0412303cb87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/experiences/preferences/route.ts:34',message:'invalid experience',data:{resolvedExperience},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: "Invalid experience", experience: currentState.experience },
      { status: 400 }
    );
  }

  if (!isColorMode(resolvedColorMode)) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/7be3dc8b-1b33-42b3-9bd8-f0412303cb87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/experiences/preferences/route.ts:43',message:'invalid color mode',data:{resolvedColorMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/7be3dc8b-1b33-42b3-9bd8-f0412303cb87',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/experiences/preferences/route.ts:72',message:'app_state set',data:{experience:resolvedExperience,colorMode:resolvedColorMode,cookiePath:sessionOptions.cookieOptions.path,sameSite:sessionOptions.cookieOptions.sameSite},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion

  return NextResponse.json(
    {
      experience: resolvedExperience,
      colorMode: resolvedColorMode,
      preference: toAppSkinPreference(resolvedExperience, resolvedColorMode),
    },
    { status: 200 }
  );
}
