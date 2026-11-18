import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Chris never uses em or en dashes. Code that needs them writes unicode escapes.
it("keeps em and en dashes out of every tracked file", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && !f.startsWith("results/") && !f.endsWith(".png"));
  const offenders = files.filter((f) => /[\u2014\u2013]/.test(readFileSync(f, "utf8")));
  expect(offenders).toEqual([]);
});
