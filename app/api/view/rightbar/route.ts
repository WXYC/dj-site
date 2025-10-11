import { defaultApplicationState } from "@/lib/features/application/types";
import { sessionOptions } from "@/lib/features/session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const data = cookieStore.get("app_state")?.value;
  const appState = data ? JSON.parse(data) : defaultApplicationState;
  cookieStore.set({
    ...sessionOptions.cookieOptions,
    name: "app_state",
    value: JSON.stringify({ rightBarMini: !appState.rightBarMini }),
  });

  return NextResponse.json(appState ?? defaultApplicationState, {
    status: 200,
  });
}
