import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Breadcrumb, ErrorEvent } from "@sentry/browser";

// The SDK is loaded via a deferred dynamic import of the ./sentry-sdk
// re-export (which exists so the chunk tree-shakes). Hoisted so the mock SDK
// is available for assertions; the rejection test overrides this with
// vi.doMock to make the dynamic import fail.
const control = vi.hoisted(() => ({
  sentry: {
    init: vi.fn(),
    captureException: vi.fn(),
    getClient: vi.fn((): unknown => undefined),
  },
}));

vi.mock("@/lib/sentry-sdk", () => control.sentry);

const sentry = control.sentry;

// initSentry resolves the client on a microtask, so flush the queue before
// asserting. Re-import per test (vi.resetModules) so the module-level
// client/loading/buffer singletons reset.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function loadAdapter() {
  return import("@/lib/sentry");
}

async function initAndWait() {
  const mod = await loadAdapter();
  mod.initSentry();
  await flush();
  return mod;
}

type InitOptions = {
  dsn: string;
  environment: string;
  release?: string;
  sendDefaultPii: boolean;
  maxBreadcrumbs: number;
  beforeSend: (event: ErrorEvent) => ErrorEvent | null;
  beforeBreadcrumb: (breadcrumb: Breadcrumb) => Breadcrumb | null;
};

function initOptions(): InitOptions {
  expect(sentry.init).toHaveBeenCalledTimes(1);
  return sentry.init.mock.calls[0][0] as InitOptions;
}

function resetEverything() {
  vi.resetModules();
  sentry.init.mockClear();
  sentry.captureException.mockClear();
  sentry.getClient.mockClear();
  sentry.getClient.mockImplementation(() => undefined);
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@o0.ingest.us.sentry.io/1";
  delete process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  delete process.env.NEXT_PUBLIC_SENTRY_RELEASE;
}

describe("initSentry", () => {
  const originalEnv = { ...process.env };

  beforeEach(resetEverything);

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("initializes with the DSN and anonymization defaults", async () => {
    await initAndWait();

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@o0.ingest.us.sentry.io/1",
        sendDefaultPii: false,
        maxBreadcrumbs: 30,
      })
    );
  });

  it("defaults environment to development outside production builds", async () => {
    await initAndWait();

    expect(initOptions().environment).toBe("development");
  });

  // NODE_ENV is "production" for every `next build`, previews included, so it
  // cannot identify the deployed environment on its own. Reporting "unknown"
  // keeps a preview error from polluting the production filter that alerting
  // reads.
  it("reports an unset environment as unknown in a production build, not production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await initAndWait();

    expect(initOptions().environment).toBe("unknown");
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_SENTRY_ENVIRONMENT and NEXT_PUBLIC_SENTRY_RELEASE", async () => {
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "preview";
    process.env.NEXT_PUBLIC_SENTRY_RELEASE = "abc123";

    await initAndWait();

    expect(initOptions().environment).toBe("preview");
    expect(initOptions().release).toBe("abc123");
  });

  it("no-ops when NEXT_PUBLIC_SENTRY_DSN is unset", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    await initAndWait();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("no-ops on server (when window is undefined)", async () => {
    const windowSpy = vi.spyOn(globalThis, "window", "get");
    windowSpy.mockReturnValue(undefined as never);

    await initAndWait();

    expect(sentry.init).not.toHaveBeenCalled();
    windowSpy.mockRestore();
  });

  it("skips re-init when the SDK already has a client", async () => {
    sentry.getClient.mockImplementation(() => ({}));

    const mod = await initAndWait();
    mod.captureExceptionInSentry(new Error("boom"));

    expect(sentry.init).not.toHaveBeenCalled();
    // The already-initialized SDK is still adopted as the capture sink.
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("imports the SDK exactly once when called twice (remount)", async () => {
    const mod = await loadAdapter();
    mod.initSentry();
    mod.initSentry();
    await flush();

    expect(sentry.init).toHaveBeenCalledTimes(1);
  });
});

describe("captureExceptionInSentry", () => {
  const originalEnv = { ...process.env };

  beforeEach(resetEverything);

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // `extra` is stored but not indexed, so context sent only that way can't be
  // searched or filtered — which is the whole point of tagging a capture with
  // its endpoint or route. Primitives are mirrored into tags for that reason.
  it("mirrors primitive context into searchable tags and keeps the whole object in extra", async () => {
    const err = new Error("boom");
    const { captureExceptionInSentry } = await initAndWait();
    captureExceptionInSentry(err, {
      endpoint: "updateAlbum",
      status: 500,
      retried: false,
    });

    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { endpoint: "updateAlbum", status: "500", retried: "false" },
      extra: { endpoint: "updateAlbum", status: 500, retried: false },
    });
  });

  it("omits non-primitive and nullish context values from tags", async () => {
    const { captureExceptionInSentry } = await initAndWait();
    captureExceptionInSentry(new Error("boom"), {
      payload: { id: 7 },
      missing: null,
      absent: undefined,
      surface: "dashboard",
    });

    expect(sentry.captureException.mock.calls[0][1].tags).toEqual({
      surface: "dashboard",
    });
  });

  it("redacts emails from tag values", async () => {
    const { captureExceptionInSentry } = await initAndWait();
    captureExceptionInSentry(new Error("boom"), { subject: "dj@wxyc.org" });

    expect(sentry.captureException.mock.calls[0][1].tags.subject).toBe("[email]");
  });

  it("sends no tags when there is no context", async () => {
    const { captureExceptionInSentry } = await initAndWait();
    captureExceptionInSentry(new Error("boom"));

    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: {},
      extra: undefined,
    });
  });

  it("never throws when the SDK throws", async () => {
    const { captureExceptionInSentry } = await initAndWait();
    sentry.captureException.mockImplementationOnce(() => {
      throw new Error("sentry not initialized");
    });

    expect(() => captureExceptionInSentry(new Error("boom"))).not.toThrow();
  });

  it("starts the load itself when captured before any init (root-layout crash)", async () => {
    const mod = await loadAdapter();
    // No initSentry() call: global-error.tsx replaces the root layout, so
    // TelemetryProvider may never have mounted when this fires.
    mod.captureExceptionInSentry(new Error("root layout crashed"));

    expect(sentry.captureException).not.toHaveBeenCalled();

    await flush();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException.mock.calls[0][0].message).toBe(
      "root layout crashed"
    );
  });

  it("stays fully inert without a DSN even on the lazy-init path", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const mod = await loadAdapter();
    expect(() =>
      mod.captureExceptionInSentry(new Error("nowhere to go"))
    ).not.toThrow();
    await flush();

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("flushes captures fired before load in order once the client resolves", async () => {
    const mod = await loadAdapter();
    mod.initSentry(); // load is in-flight, client still null

    mod.captureExceptionInSentry(new Error("first"), { order: 1 });
    mod.captureExceptionInSentry(new Error("second"), { order: 2 });

    expect(sentry.captureException).not.toHaveBeenCalled();

    await flush();

    expect(sentry.captureException).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: "first" }),
      { tags: { order: "1" }, extra: { order: 1 } }
    );
    expect(sentry.captureException).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: "second" }),
      { tags: { order: "2" }, extra: { order: 2 } }
    );
  });
});

describe("anonymization scrubbing", () => {
  const originalEnv = { ...process.env };

  beforeEach(resetEverything);

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("beforeSend strips user identity entirely", async () => {
    await initAndWait();
    const { beforeSend } = initOptions();

    const event = {
      user: { id: "dj-42", email: "dj@wxyc.org", ip_address: "10.0.0.1" },
    } as unknown as ErrorEvent;
    const scrubbed = beforeSend(event);

    expect(scrubbed).not.toBeNull();
    expect(scrubbed?.user).toBeUndefined();
  });

  it("beforeSend redacts email addresses from message and exception values", async () => {
    await initAndWait();
    const { beforeSend } = initOptions();

    const event = {
      message: "lookup failed for dj@wxyc.org",
      exception: {
        values: [
          { type: "Error", value: "no member with email station.manager@wxyc.org found" },
        ],
      },
    } as unknown as ErrorEvent;
    const scrubbed = beforeSend(event);

    expect(scrubbed?.message).toBe("lookup failed for [email]");
    expect(scrubbed?.exception?.values?.[0]?.value).toBe(
      "no member with email [email] found"
    );
  });

  it("beforeSend drops request cookies and non-UA headers", async () => {
    await initAndWait();
    const { beforeSend } = initOptions();

    const event = {
      request: {
        url: "https://dj.wxyc.org/dashboard/catalog",
        cookies: { session_token: "secret" },
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://dj.wxyc.org/login",
          Cookie: "session_token=secret",
        },
      },
    } as unknown as ErrorEvent;
    const scrubbed = beforeSend(event);

    expect(scrubbed?.request?.url).toBe("https://dj.wxyc.org/dashboard/catalog");
    expect(scrubbed?.request?.cookies).toBeUndefined();
    expect(scrubbed?.request?.headers).toEqual({ "User-Agent": "Mozilla/5.0" });
  });

  it("beforeBreadcrumb redacts emails from message and string data values", async () => {
    await initAndWait();
    const { beforeBreadcrumb } = initOptions();

    const breadcrumb: Breadcrumb = {
      category: "console",
      message: "provisioning dj@wxyc.org failed",
      data: {
        arguments: "retry for dj@wxyc.org",
        status: 403,
      },
    };
    const scrubbed = beforeBreadcrumb(breadcrumb);

    expect(scrubbed?.message).toBe("provisioning [email] failed");
    expect(scrubbed?.data?.arguments).toBe("retry for [email]");
    expect(scrubbed?.data?.status).toBe(403);
  });
});

// Kept last in the file: vi.doUnmock deregisters the module mock outright, so
// any test running after this one would import the real SDK.
describe("failed chunk load", () => {
  const originalEnv = { ...process.env };

  beforeEach(resetEverything);

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("all captures no-op and the buffer clears when the dynamic import rejects", async () => {
    // Force the SDK chunk import to fail for this test only.
    vi.doMock("@/lib/sentry-sdk", () => {
      throw new Error("chunk load failed");
    });
    try {
      const mod = await import("@/lib/sentry");
      mod.initSentry();
      mod.captureExceptionInSentry(new Error("early"));

      // Let the rejected import settle; must not raise an unhandled rejection.
      await flush();

      expect(sentry.captureException).not.toHaveBeenCalled();

      // Post-failure captures also no-op (session stays dark, no re-import).
      mod.captureExceptionInSentry(new Error("later"));
      await flush();
      expect(sentry.init).not.toHaveBeenCalled();
      expect(sentry.captureException).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("@/lib/sentry-sdk");
      vi.resetModules();
    }
  });
});
