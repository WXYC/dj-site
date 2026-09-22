import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every file under the given roots matching `extensions`, as repo-relative
 * paths. Shared by the contract tests that police source shape (asset
 * references, artist-card links): each previously owned a verbatim copy of
 * this walk, so a fix to what "the source tree" means landed in whichever
 * copy's test failed and the others silently scanned a different tree.
 *
 * Not exported from the helpers barrel: the node-tier specs that use this
 * import it directly, per the no-barrel rule for that tier.
 */
export function sourceFiles(roots: string[], extensions: RegExp): string[] {
  return roots.flatMap((root) =>
    readdirSync(join(process.cwd(), root), { recursive: true, withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          extensions.test(entry.name) &&
          !entry.parentPath.includes("node_modules") &&
          !entry.parentPath.split("/").some((segment) => segment.startsWith(".")),
      )
      .map((entry) => relative(process.cwd(), join(entry.parentPath, entry.name))),
  );
}
