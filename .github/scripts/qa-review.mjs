#!/usr/bin/env node
/**
 * Assembles the PR diff + lint/typecheck/build/test results into a bounded
 * prompt and asks an external QA model to review it, then writes the result
 * to qa-review-output.md for a later workflow step to post as a PR comment.
 *
 * Deliberately does NOT send the whole repository — only the diff, the
 * changed-file list, and captured check output, each capped in size. Keeps
 * the review fast and cheap regardless of repo size.
 *
 * Provider-agnostic by design: everything above `callQaProvider()` is plain
 * text assembly. Swapping the QA model/provider later means editing only
 * that one function (and its README-documented env vars) — nothing else in
 * this script or the workflow needs to change.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIFF_CHAR_CAP = 60_000;
const LOG_CHAR_CAP = 8_000;

function readCapped(path, cap, fallback = "(not available)") {
  if (!existsSync(path)) return fallback;
  const text = readFileSync(path, "utf8").trim();
  if (!text) return "(empty)";
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}\n\n[... truncated, ${text.length - cap} more characters ...]`;
}

function outcomeLine(name, outcome) {
  const label = outcome === "success" ? "PASS" : outcome === "skipped" ? "SKIPPED" : "FAIL";
  return `- ${name}: ${label}`;
}

function buildPrompt() {
  const promptTemplate = readFileSync(
    new URL("../qa-reviewer-prompt.md", import.meta.url),
    "utf8",
  );

  const meta = [
    `PR #${process.env.PR_NUMBER}: ${process.env.PR_TITLE ?? "(no title)"}`,
    `Base branch: ${process.env.PR_BASE}`,
    `Head commit: ${process.env.PR_HEAD_SHA}`,
    "",
    "Check outcomes (from CI, already run — trust these over re-deriving them):",
    outcomeLine("lint", process.env.LINT_EXIT),
    outcomeLine("typecheck", process.env.TYPECHECK_EXIT),
    outcomeLine("build", process.env.BUILD_EXIT),
    outcomeLine("test", process.env.TEST_EXIT),
  ].join("\n");

  const changedFiles = readCapped("changed-files.txt", 4_000);
  const diff = readCapped("pr.diff", DIFF_CHAR_CAP);
  const lintOut = readCapped("lint-output.txt", LOG_CHAR_CAP);
  const typecheckOut = readCapped("typecheck-output.txt", LOG_CHAR_CAP);
  const buildOut = readCapped("build-output.txt", LOG_CHAR_CAP);
  const testOut = readCapped("test-output.txt", LOG_CHAR_CAP);

  return `${promptTemplate}

---

## PR metadata

${meta}

## Changed files

\`\`\`
${changedFiles}
\`\`\`

## Diff

\`\`\`diff
${diff}
\`\`\`

## Lint output

\`\`\`
${lintOut}
\`\`\`

## Typecheck output

\`\`\`
${typecheckOut}
\`\`\`

## Build output

\`\`\`
${buildOut}
\`\`\`

## Test output

\`\`\`
${testOut}
\`\`\`
`;
}

/** The only function that knows about a specific QA provider's API. */
async function callQaProvider(prompt) {
  const provider = process.env.QA_PROVIDER || "gemini";
  if (provider !== "gemini") {
    throw new Error(`Unsupported QA_PROVIDER "${provider}" — only "gemini" is implemented.`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API returned ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response had no text content.");
  return text.trim();
}

function fallbackReport(reason) {
  const lines = [
    "**QA VERDICT: NEEDS HUMAN REVIEW**",
    "",
    `_Automated QA review could not run: ${reason}_`,
    "",
    "### Build/lint/test results (from CI — still valid)",
    outcomeLine("lint", process.env.LINT_EXIT),
    outcomeLine("typecheck", process.env.TYPECHECK_EXIT),
    outcomeLine("build", process.env.BUILD_EXIT),
    outcomeLine("test", process.env.TEST_EXIT),
  ];
  return lines.join("\n");
}

async function main() {
  const prompt = buildPrompt();
  let report;
  try {
    report = await callQaProvider(prompt);
  } catch (err) {
    report = fallbackReport(err instanceof Error ? err.message : String(err));
  }

  const footer = `\n\n---\n_Automated, read-only QA review of commit \`${(process.env.PR_HEAD_SHA || "").slice(0, 7)}\`. This bot cannot edit code, push, merge, or deploy. A new commit on this PR will trigger a fresh review._`;

  writeFileSync("qa-review-output.md", report + footer);
}

main().catch((err) => {
  // Never let this script exit non-zero — the workflow always posts
  // *something* to the PR, even if it's just "QA failed to run."
  writeFileSync("qa-review-output.md", fallbackReport(String(err)));
});
