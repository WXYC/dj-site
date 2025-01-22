import { defaultApplicationState } from "@/lib/features/application/types";
import { sessionOptions } from "@/lib/features/session";
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

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const data = cookieStore.get("app_state")?.value;
  const appState = data ? JSON.parse(data) : defaultApplicationState;
  cookieStore.set({
    ...sessionOptions.cookieOptions,
    name: "app_state",
    value: JSON.stringify({ classic: !appState.classic }),
  });

  return NextResponse.json(appState ?? defaultApplicationState, {
    status: 200,
  });
}
