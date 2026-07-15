import { defaultApplicationState } from "@/lib/features/application/types";
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

  const data = cookieStore.get("app_state")?.value;
  let appState = defaultApplicationState;
  if (data) {
    try {
      appState = { ...defaultApplicationState, ...JSON.parse(data) };
    } catch (error) {
      console.error("Failed to parse app_state", error);
    }
  }
  const newState = {
    ...appState,
    rightBarMini: !appState.rightBarMini,
  };
  cookieStore.set({
    ...sessionOptions.cookieOptions,
    name: "app_state",
    value: JSON.stringify(newState),
  });

  return NextResponse.json(newState, {
    status: 200,
  });
}
