import { defaultApplicationState } from "@/lib/features/application/types";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  const data = cookieStore.get("app_state");
  const appState = data ? JSON.parse(data.value) : defaultApplicationState;

  return NextResponse.json(appState ?? defaultApplicationState, {
    status: 200,
  });
}
