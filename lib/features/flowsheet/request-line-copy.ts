import type { OnAirInfo, RequestLineMode, SpotlightRole } from "@wxyc/shared";

type RequestLine = NonNullable<OnAirInfo["request_line"]>;

export const USUAL_CHOICE = "usual";

/** Every string the request-line control shows. The wire value for Messages only is `feedback`. */
export const requestLineCopy = {
  label: "Request line",
  modes: {
    requests: "Requests",
    feedback: "Messages only",
    closed: "Closed",
  } satisfies Record<RequestLineMode, string>,
  // What listeners can do under each choice, shown beside it and as the selected choice's helper text.
  descriptions: {
    requests: "Listeners can ask for songs and send notes.",
    feedback: "Listeners can send notes, with no song lookup.",
    closed: "Listeners can send nothing, and the Request button is hidden.",
  } satisfies Record<RequestLineMode, string>,
  backToUsual: "Back to the usual",
  messagesConfirmed: "Listeners' button now reads Message.",
  // The hint under a source the DJ did not choose; the default source stays quiet.
  sources: {
    dj: "You chose this for the set.",
    program: "This is the program's usual setting.",
  },
  spotlightClosed: (role: SpotlightRole | null | undefined) => {
    if (role === "performer") {
      return "Closed while a band is on.";
    }
    if (role === "reader") {
      return "Closed while a reader is on.";
    }
    return "Closed for this part of the set.";
  },
};

/** An unknown mode from a newer server is shown, and treated, as requests. */
export function knownMode(mode: string): RequestLineMode {
  return mode in requestLineCopy.modes ? (mode as RequestLineMode) : "requests";
}

/** Why the mode is in effect; null when the source needs no explanation. */
export function sourceExplanation(
  source: RequestLine["source"],
  role: SpotlightRole | null | undefined
): string | null {
  if (source === "spotlight") {
    return requestLineCopy.spotlightClosed(role);
  }
  return source === "dj" || source === "program" ? requestLineCopy.sources[source] : null;
}
