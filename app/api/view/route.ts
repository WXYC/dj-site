import { defaultApplicationState } from "@/lib/features/application/types";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();

  const data = cookieStore.get("app_state");
  let appState = defaultApplicationState;

  if (data?.value) {
    try {
      appState = { ...defaultApplicationState, ...JSON.parse(data.value) };
    } catch (e) {
      console.error("Failed to parse app_state", e);
    }
  }

  return NextResponse.json(appState ?? defaultApplicationState, {
    status: 200,
  });
}
