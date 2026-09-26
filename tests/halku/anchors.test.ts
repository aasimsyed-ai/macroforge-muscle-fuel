import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  anchorProps,
  anchorRoute,
  findAnchorElement,
  HALKU_ANCHORS,
  type HalkuAnchorId,
} from "../../src/lib/halku/anchors";
import { buildHalkuAnswer, classifyHalkuQuestion } from "../../src/lib/halku/respond";
import { HALKU_TOPICS } from "../../src/lib/halku/topics";

const SRC = join(__dirname, "..", "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const IDS = new Set<string>(HALKU_ANCHORS.map((a) => a.id));
const ID_LITERAL = /"((?:nav|food|workout|progress)\.[a-z-]+)"/g;

describe("Halku anchor registry", () => {
  it("has unique, dot-namespaced ids", () => {
    expect(IDS.size).toBe(HALKU_ANCHORS.length);
    for (const anchor of HALKU_ANCHORS) {
      expect(anchor.id).toMatch(/^[a-z]+\.[a-z-]+$/);
      expect(anchor.label.length).toBeGreaterThan(3);
    }
  });

  it("routes are null (app shell) or real app routes", () => {
    for (const anchor of HALKU_ANCHORS) {
      expect(anchor.route === null || /^\/[a-z-]+$/.test(anchor.route)).toBe(true);
    }
    expect(anchorRoute("workout.add-set")).toBe("/log-workout");
    expect(anchorRoute("nav.dashboard")).toBeNull();
  });

  it("every anchor is on a real control, and every control anchor is registered", () => {
    const usedOnControls = new Set<string>();
    for (const file of sourceFiles(join(SRC, "components")).concat(
      sourceFiles(join(SRC, "routes")),
    )) {
      const code = readFileSync(file, "utf8");
      for (const match of code.matchAll(ID_LITERAL)) usedOnControls.add(match[1] as string);
    }
    for (const id of usedOnControls) expect(IDS.has(id), `unregistered anchor ${id}`).toBe(true);
    for (const id of IDS)
      expect(usedOnControls.has(id), `anchor ${id} is on no control`).toBe(true);
  });

  it("anchorProps produces the attribute the finder looks for", () => {
    expect(anchorProps("workout.add-set")).toEqual({ "data-halku-anchor": "workout.add-set" });
  });
});

describe("findAnchorElement", () => {
  function fakeRoot(elements: Array<{ visible: boolean; name: string }>) {
    return {
      querySelectorAll: (selector: string) => {
        expect(selector).toBe('[data-halku-anchor="nav.add-meal"]');
        return elements.map((e) => ({
          name: e.name,
          getClientRects: () => (e.visible ? [{}] : []),
        }));
      },
    } as unknown as ParentNode;
  }

  it("returns the visible copy (the nav exists once for desktop, once for mobile)", () => {
    const found = findAnchorElement(
      "nav.add-meal",
      fakeRoot([
        { name: "desktop-hidden", visible: false },
        { name: "mobile-shown", visible: true },
      ]),
    ) as unknown as { name: string };
    expect(found.name).toBe("mobile-shown");
  });

  it("returns null when the anchor is not on this page, instead of throwing", () => {
    expect(findAnchorElement("nav.add-meal", fakeRoot([]))).toBeNull();
    expect(findAnchorElement("nav.add-meal", fakeRoot([{ name: "x", visible: false }]))).toBeNull();
    expect(findAnchorElement("nav.add-meal", null)).toBeNull();
  });
});

describe("Halku answers carry an optional anchor (seam for Guided Mode; nothing renders it yet)", () => {
  it("topic anchors all exist in the registry", () => {
    for (const topic of HALKU_TOPICS) {
      if (topic.anchor) expect(IDS.has(topic.anchor), topic.id).toBe(true);
    }
  });

  it.each([
    ["How do I add a set?", "workout.add-set"],
    ["Show me how to add a set", "workout.add-set"],
    ["How do I scan a barcode?", "food.scan-barcode"],
    ["How do I add an exercise?", "workout.add-exercise"],
    ["How do I change my calorie target?", "nav.settings"],
  ] as Array<[string, HalkuAnchorId]>)("%s → %s", (question, anchor) => {
    const answer = buildHalkuAnswer(classifyHalkuQuestion(question), {});
    expect(answer.anchor).toBe(anchor);
  });

  it("answers that are not about one control carry no anchor", () => {
    const answer = buildHalkuAnswer(
      classifyHalkuQuestion("What does progressive overload mean?"),
      {},
    );
    expect(answer.anchor).toBeUndefined();
  });

  it("the add-set answer no longer claims only reps need changing (reps are copied too)", () => {
    const text = buildHalkuAnswer(classifyHalkuQuestion("How do I add a set?"), {}).text;
    expect(text).toContain("reps, weight and rest");
    expect(text).not.toContain("only need to adjust reps");
  });
});
