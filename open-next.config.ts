export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
  edgeExternals: ["node:crypto"],
  // middleware.ts stays on the deprecated Edge-runtime convention rather than
  // migrating to proxy.ts: proxy.ts is Node.js-runtime-only (no `runtime`
  // override), and @opennextjs/cloudflare 1.20.1's build.js hard-fails
  // (process.exit(1)) the moment it detects Node.js middleware. Revisit once
  // the adapter supports Node.js middleware/proxy. See dj-site#967.
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
};

