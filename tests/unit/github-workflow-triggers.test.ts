/**
 * Trigger and base-guard invariants for the PR workflows.
 *
 * A PR can reach `main` with no automated verification in several ways, none
 * of which produce a red X, an annotation, or anything else a reviewer would
 * notice:
 *
 *  - A `pull_request` trigger narrowed by `branches`, `branches-ignore`, or
 *    `paths`. The workflow never starts, so its required checks are absent
 *    rather than failing — and absent reads as "still running".
 *  - An expensive job that *skips* on a non-`main` base. Skipped satisfies a
 *    required status check. When the parent of a stacked PR merges, GitHub
 *    retargets the child onto `main` automatically, and branch protection
 *    re-reads the conclusions already sitting there. A skip becomes a merge
 *    authorization in that window, before any new run can exist. Refusing
 *    (exiting non-zero) keeps the PR blocked instead.
 *  - A base guard moved *up* the `needs` graph. Gating one shared upstream job
 *    starves every downstream job transitively while each of their own `if:`
 *    expressions still looks innocent.
 *
 * The third is why these assertions resolve the dependency graph rather than
 * reading each job's `if:` in isolation: an earlier version of this file
 * passed clean against a workflow whose `changes` job carried the guard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Job = { if?: string; needs?: string | string[] };
type Workflow = {
  on?: { pull_request?: { branches?: string[]; types?: string[] } | null } | null;
  jobs?: Record<string, Job>;
};

const WORKFLOW_DIR = join(__dirname, "..", "..", ".github", "workflows");

function workflow(name: string): Workflow {
  return parse(readFileSync(join(WORKFLOW_DIR, `${name}.yml`), "utf-8")) as Workflow;
}

/**
 * Every workflow with a `pull_request` trigger, discovered rather than listed.
 * A hardcoded list silently exempts the next workflow someone adds, which is
 * the population these invariants most need to cover.
 */
const PR_WORKFLOWS = readdirSync(WORKFLOW_DIR)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .map((f) => f.replace(/\.ya?ml$/, ""))
  .filter((name) => {
    const on = workflow(name).on;
    return !!on && "pull_request" in on;
  });

/** Transitive `needs` closure, so a guard one level up is still visible. */
function dependencyClosure(jobs: Record<string, Job>, start: string): string[] {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const name = queue.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const needs = jobs[name]?.needs;
    for (const dep of typeof needs === "string" ? [needs] : (needs ?? [])) queue.push(dep);
  }
  return [...seen];
}

describe("GitHub workflow PR triggers", () => {
  it("finds the PR-triggered workflows by scanning, and there are some", () => {
    expect(PR_WORKFLOWS.length).toBeGreaterThan(0);
    // The three the base-guard design reasons about must be among them; a
    // rename or a deleted trigger should fail here rather than shrink the
    // suite's coverage in silence.
    expect(PR_WORKFLOWS).toEqual(expect.arrayContaining(["ci", "e2e-tests", "codeql"]));
  });

  it.each(PR_WORKFLOWS)("%s.yml does not narrow its pull_request trigger", (name) => {
    const on = workflow(name).on;
    // Asserting `pr?.branches` alone passes vacuously when the trigger is gone
    // entirely, or when a YAML 1.1 parser turns the `on` key into boolean true.
    expect(on, `${name}.yml lost its \`on:\` block`).toBeTruthy();
    const pr = on!.pull_request as Record<string, unknown> | null | undefined;
    expect("pull_request" in on!, `${name}.yml lost its pull_request trigger`).toBe(true);
    for (const narrowing of ["branches", "branches-ignore", "paths", "paths-ignore"]) {
      expect(
        pr?.[narrowing],
        `${name}.yml narrows pull_request by ${narrowing}, which starves whole PRs of this workflow`
      ).toBeUndefined();
    }
  });
});

describe("Expensive jobs refuse a non-main base rather than skipping", () => {
  // Skipping is the trap: it satisfies branch protection, so it converts into
  // a merge authorization the instant a stacked PR is retargeted onto `main`.
  // Both of these must therefore leave a *failing* conclusion behind, which
  // means neither may carry a `github.base_ref` job-level guard — a guard
  // produces exactly the skip being avoided.

  it("the preview deploy has no base guard, and refuses inside the job", () => {
    const ci = workflow("ci");
    expect(ci.jobs?.preview?.if ?? "").not.toContain("github.base_ref");
    const source = readFileSync(join(WORKFLOW_DIR, "ci.yml"), "utf-8");
    expect(source).toMatch(/BASE_REF.*!=.*"main"/s);
  });

  it("the E2E aggregator has no base guard, and refuses inside the job", () => {
    const e2e = workflow("e2e-tests");
    expect(e2e.jobs?.["e2e-all"]?.if ?? "").not.toContain("github.base_ref");
    const source = readFileSync(join(WORKFLOW_DIR, "e2e-tests.yml"), "utf-8");
    expect(source).toMatch(/BASE_REF.*!=.*"main"/s);
  });

  // The matrix itself may skip — it is pure cost, and `e2e-all` carries the
  // signal for it. This pins that the cost control is still in place, so a
  // future edit doesn't quietly start booting four backends per stacked PR.
  it("the E2E shard matrix still skips on a non-main base, for cost", () => {
    expect(workflow("e2e-tests").jobs?.e2e?.if).toContain("github.base_ref == 'main'");
  });
});

describe("Cheap correctness jobs", () => {
  // The whole point of the unfiltered trigger. Checked across the transitive
  // `needs` closure: gating a shared upstream job like `changes` starves all
  // of these at once while every `if:` here still reads clean.
  it.each(["typecheck", "test", "build", "script-tests"])(
    "%s runs regardless of the PR's base branch, transitively",
    (jobName) => {
      const jobs = workflow("ci").jobs ?? {};
      expect(jobs[jobName], `ci.yml has no job named ${jobName}`).toBeDefined();
      for (const dep of dependencyClosure(jobs, jobName)) {
        expect(
          jobs[dep]?.if ?? "",
          `${jobName} depends on ${dep}, which gates on github.base_ref — that starves ` +
            `${jobName} on every stacked PR even though its own \`if:\` looks unconditional`
        ).not.toContain("github.base_ref");
      }
    }
  );
});
