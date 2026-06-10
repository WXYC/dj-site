// Apple App Site Association file. Serves the JSON Apple's CDN fetches to
// link this origin to native apps for Universal Links and Password AutoFill.
// `webcredentials` enables iOS Keychain to surface dj.wxyc.org credentials
// in the WXYC DJ Tool app's username/password fields.
//
// Apple requires Content-Type: application/json and no redirects.
// The path is required to be exactly `/.well-known/apple-app-site-association`.

import { NextResponse } from "next/server";

const AASA = {
  webcredentials: {
    apps: ["92V374HC38.org.wxyc.dj-tool"],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
