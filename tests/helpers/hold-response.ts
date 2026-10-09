import { http } from "msw";
import { onTestFinished } from "vitest";
import { server } from "../fakes/server";

type Method = "get" | "post" | "put" | "patch" | "delete";

/**
 * Holds every request to `method` `url` until `release()`, then answers it with
 * `respond()`. `calls.count` counts the requests that arrived. `answered`
 * settles only once the held answer has been handed to the client (msw's
 * `response:mocked` event for that request) and the client has had the
 * turns it needs to read and act on it, so a spec asserts after the answer
 * rather than after a fixed sleep. The `response:mocked` listener is removed when the
 * test finishes, so a hold that is never released does not outlive it.
 */
export function holdResponse(method: Method, url: string, respond: () => Response) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls = { count: 0 };
  const heldIds = new Set<string>();
  let markAnswered!: () => void;
  const mocked = new Promise<void>((resolve) => {
    markAnswered = resolve;
  });

  const onMocked = ({ requestId }: { requestId: string }) => {
    if (heldIds.has(requestId)) markAnswered();
  };
  server.events.on("response:mocked", onMocked);
  onTestFinished(() => {
    server.events.removeListener("response:mocked", onMocked);
  });

  server.use(
    http[method](url, async ({ requestId }) => {
      calls.count += 1;
      heldIds.add(requestId);
      await held;
      return respond();
    }),
  );

  const answered = mocked.then(async () => {
    server.events.removeListener("response:mocked", onMocked);
    // The client reads the body and settles its promise chain over a few macrotask turns.
    for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  });

  return { calls, release, answered };
}
