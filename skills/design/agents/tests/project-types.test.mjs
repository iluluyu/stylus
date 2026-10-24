import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, "../..");
const manifest = JSON.parse(
  await readFile(path.join(skillRoot, "project-types.json"), "utf8"),
);

// Academic retarget of the upstream 13-type manifest (see PROVENANCE.md).
const expectedTypes = [
  "Method overview / Figure 1",
  "Concept / mechanism schematic",
  "Graphical abstract / TOC graphic",
  "Flowchart / algorithm diagram",
  "Interactive data sketch",
  "Talk slides",
  "Poster / one-pager",
  "Figure sketch exploration",
  "Figure style system",
];

const markers = {
  "method-overview": {
    skill: ["print-true", "brief", "high-fidelity"],
    starter: ["dcartboard", "image-slot"],
  },
  schematic: {
    skill: ["print-true", "high-fidelity"],
    starter: ["dcartboard"],
  },
  "graphical-abstract": {
    skill: ["print-true"],
    starter: ["dcartboard"],
  },
  flowchart: {
    skill: ["print-true", "chart", "visual"],
    starter: ["dcartboard"],
  },
  "data-figure": {
    skill: ["chart", "visual", "print-true"],
    starter: ["chart-stage", "tooltip"],
  },
  deck: {
    skill: ["data-anim"],
    starter: ["data-anim", "noscale"],
  },
  doc: {
    skill: ["doc-page", "flowing pages", "print-true"],
    starter: ["customelements.define", "doc-page"],
  },
  wireframe: {
    skill: ["low-fi", "print-true"],
    starter: ["dcartboard"],
  },
  "figure-style-system": {
    skill: ["compile-design-system", "styles.css"],
    starter: ["dcartboard"],
  },
};

test("project type manifest contains the academic types in order", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    manifest.projectTypes.map((entry) => entry.name),
    expectedTypes,
  );
  assert.equal(
    new Set(manifest.projectTypes.map((entry) => entry.id)).size,
    expectedTypes.length,
  );
});

for (const projectType of manifest.projectTypes) {
  test(`project type: ${projectType.name}`, async () => {
    assert.ok(projectType.skills.length > 0, "must route to at least one skill");

    const skillTexts = [];
    for (const skill of projectType.skills) {
      const text = await readFile(
        path.join(skillRoot, "built-in-skills", `${skill}.md`),
        "utf8",
      );
      assert.match(text, new RegExp(`name:\\s*["']?${escapeRegExp(skill)}`));
      assert.ok(text.length > 120, `${skill}.md is unexpectedly small`);
      skillTexts.push(text);
    }

    const starterTexts = [];
    for (const starter of projectType.starters) {
      const text = await readFile(
        path.join(skillRoot, "starter-components", starter),
        "utf8",
      );
      assert.ok(text.length > 120, `${starter} is unexpectedly small`);
      starterTexts.push(text);
    }

    const expected = markers[projectType.id];
    assert.ok(expected, `missing verification markers for ${projectType.id}`);
    const skillCorpus = skillTexts.join("\n");
    const starterCorpus = starterTexts.join("\n");
    for (const marker of expected.skill) {
      assert.ok(
        skillCorpus.toLowerCase().includes(marker.toLowerCase()),
        `${projectType.name}: skill marker not found: ${marker}`,
      );
    }
    for (const marker of expected.starter) {
      assert.ok(
        starterCorpus.toLowerCase().includes(marker.toLowerCase()),
        `${projectType.name}: starter marker not found: ${marker}`,
      );
    }
  });
}

test("operative system prompt exposes every project type and keeps the upstream snapshot", async () => {
  const operative = await readFile(path.join(skillRoot, "system-prompt.md"), "utf8");
  const upstream = await readFile(
    path.join(skillRoot, "references", "upstream-system-prompt.md"),
    "utf8",
  );
  for (const name of expectedTypes) {
    assert.ok(operative.includes(name), `system prompt does not mention ${name}`);
  }
  assert.match(operative, /academic-figures\.md/);
  assert.ok(upstream.length > 20_000, "upstream system prompt snapshot is too small");
  assert.match(upstream, /ready_for_verification/);
});

test("SKILL.md routes to the academic domain layer and the scifig sibling", async () => {
  const entry = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.match(entry, /^name:\s*design\s*$/m);
  assert.match(entry, /academic-figures\.md/);
  assert.match(entry, /scifig/);
  assert.match(entry, /PROVENANCE\.md/);
});

test("merged deck-stage retains upstream rail editing and local PPTX animation", async () => {
  const deck = await readFile(
    path.join(skillRoot, "starter-components", "deck-stage.js"),
    "utf8",
  );
  for (const marker of [
    "multi-selection",
    "drag to reorder",
    "Delete/Backspace",
    "_animOnNav",
    "data-anim-auto-reverse",
    "noscale",
  ]) {
    assert.ok(deck.includes(marker), `deck-stage missing merged marker: ${marker}`);
  }
});

test("local feature overlays survive the upstream sync", async () => {
  const tweaks = await readFile(
    path.join(skillRoot, "starter-components", "tweaks-panel.jsx"),
    "utf8",
  );
  assert.match(tweaks, /TweakSuggestionBar/);
  assert.match(tweaks, /__edit_mode_chat/);

  // design-canvas-patch.md: gentler wheel zoom, latched per wheel burst.
  const canvas = await readFile(
    path.join(skillRoot, "starter-components", "design-canvas.jsx"),
    "utf8",
  );
  assert.match(canvas, /const WHEEL_ZOOM_STEP = Math\.log\(1\.1\);/);
  assert.match(canvas, /const WHEEL_BURST_MS = 200;/);
  assert.doesNotMatch(canvas, /Math\.sign\(e\.deltaY\) \* 0\.18/);

  for (const [file, marker] of [
    ["design-system-authoring-guide.md", "compile-design-system"],
  ]) {
    const text = await readFile(
      path.join(skillRoot, "built-in-skills", file),
      "utf8",
    );
    assert.ok(text.includes(marker), `${file} lost local marker ${marker}`);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
