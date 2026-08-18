/**
 * Trigger and base-guard invariants for the PR workflows.
 *
 * Two ways a PR can reach `main` with no automated verification, neither of
 * which produces a red X, an annotation, or anything else a reviewer would
 * notice:
 *
 *  - A `pull_request: branches: [main]` filter. A PR based on any other
 *    branch then matches no trigger, so the workflow never starts and its
 *    required checks are simply absent.
 *  - A `github.base_ref` job guard without `edited` in `types:`. Retargeting
 *    a PR's base fires only the `edited` activity type, which the default set
 *    omits — so when a parent merges and GitHub retargets the child onto
 *    `main`, nothing re-runs, and the child's conclusions from its old base
 *    stand. Those conclusions are `skipped`, and a skipped check satisfies a
 *    required status check.
 *
 * The second is the subtle one: it is the first hole wearing the disguise of
 * a fix. That is why these are assertions and not comments in the YAML.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Job = { if?: string };
type Workflow = {
  on?: { pull_request?: { branches?: string[]; types?: string[] } | null };
  jobs?: Record<string, Job>;
};

const WORKFLOW_DIR = join(__dirname, "..", "..", ".github", "workflows");

function workflow(name: string): Workflow {
  return parse(readFileSync(join(WORKFLOW_DIR, `${name}.yml`), "utf-8")) as Workflow;
}

// Adding a new PR-triggered workflow to this list is the point: it inherits
// the invariants rather than rediscovering them.
const PR_WORKFLOWS = ["ci", "e2e-tests", "codeql"] as const;

// Declaring `types:` REPLACES the default set rather than extending it, so
// omitting `synchronize` would stop CI from running on pushes to an open PR —
// a far wider hole than the one `edited` closes. Pin the whole set.
const REQUIRED_TYPES = ["opened", "synchronize", "reopened", "edited"];

describe("GitHub workflow PR triggers", () => {
  it.each(PR_WORKFLOWS)(
    "%s.yml does not filter pull_request by base branch",
    (name) => {
      const pr = workflow(name).on?.pull_request;
      // `pull_request:` with no mapping parses as null — every branch, default
      // types. That shape is fine; a `branches:` key is not.
      expect(pr?.branches).toBeUndefined();
    }
  );

  it.each(PR_WORKFLOWS)(
    "%s.yml re-runs on base retarget whenever any job guards on github.base_ref",
    (name) => {
      const wf = workflow(name);
      const guarded = Object.entries(wf.jobs ?? {}).filter(([, job]) =>
        job.if?.includes("github.base_ref")
      );
      if (guarded.length === 0) return;

      const types = wf.on?.pull_request?.types ?? [];
      expect(
        types,
        `${name}.yml guards ${guarded.map(([n]) => n).join(", ")} on github.base_ref ` +
          `but its pull_request types are [${types.join(", ")}] — a base retarget ` +
          `fires only 'edited', so those guards would never be re-evaluated`
      ).toEqual(REQUIRED_TYPES);
    }
  );
});

describe("Expensive-job base guards", () => {
  // The jobs whose cost scales with the depth of a stacked chain: a per-PR
  // Cloudflare deployment, and an E2E matrix whose every shard boots a
  // Backend-Service plus a mock tubafrenzy mirror.
  it("gates the per-PR preview deploy on a main base", () => {
    expect(workflow("ci").jobs?.preview?.if).toContain("github.base_ref == 'main'");
  });

  it("gates the E2E matrix on a main base", () => {
    expect(workflow("e2e-tests").jobs?.e2e?.if).toContain("github.base_ref == 'main'");
  });

  // The aggregator maps a skipped matrix to success so a docs-only PR can
  // satisfy the required check. Ungated, that mapping would report the
  // required "E2E Tests" as *passing* on a stacked PR that ran zero shards —
  // a check claiming verification it never performed, strictly worse than the
  // honest skip branch protection already accepts.
  it("repeats the guard on the E2E aggregator so a skipped matrix cannot report success", () => {
    expect(workflow("e2e-tests").jobs?.["e2e-all"]?.if).toContain(
      "github.base_ref == 'main'"
    );
  });
});

describe("Cheap correctness jobs", () => {
  // The whole point of the unfiltered trigger. If a future cost-trimming pass
  // gates these on the base too, a stacked PR is back to running nothing.
  it.each(["typecheck", "test", "build", "script-tests"])(
    "%s runs regardless of the PR's base branch",
    (jobName) => {
      const job = workflow("ci").jobs?.[jobName];
      expect(job, `ci.yml has no job named ${jobName}`).toBeDefined();
      expect(job!.if ?? "").not.toContain("github.base_ref");
    }
  );
});
