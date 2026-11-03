// CSS generic family keywords → PowerPoint-safe faces. Used Node-side; the
// in-page walk has its own GENERIC_MAP for capture-time resolution. (←rt)
export const GENERIC_FONT_MAP: Record<string, string> = {
  serif: "Georgia",
  "sans-serif": "Arial",
  monospace: "Courier New",
  "system-ui": "Arial",
  "-apple-system": "Arial",
  blinkmacsystemfont: "Arial",
  "ui-serif": "Georgia",
  "ui-sans-serif": "Arial",
  "ui-monospace": "Courier New",
  "ui-rounded": "Arial",
  cursive: "Comic Sans MS",
  fantasy: "Impact",
  math: "Cambria Math",
  emoji: "Segoe UI Emoji",
};

// Resolve a font-family value to a single face name. The capture step has
// usually already collapsed the stack to the rendered face; this maps any
// remaining swap/generic and strips quotes. (←ot)
export function resolveFontFamily(
  family: string | null | undefined,
  swapMap?: Record<string, string>,
): string {
  if (!family) return "Arial";
  const first = family
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!first) return "Arial";
  const lc = first.toLowerCase();
  if (swapMap) {
    for (const key in swapMap) if (key.toLowerCase() === lc) return swapMap[key];
  }
  return GENERIC_FONT_MAP[lc] ?? first;
}

// Whether a run's text carries East-Asian script that a Latin-only face
// (Arial, Inter, …) has no glyphs for.
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL_RE = /\p{Script=Hangul}/u;

// A Windows/Office-safe fallback face for the PowerPoint East-Asian slot.
// PowerPoint has no font stack: a run's <a:ea> face used to be its Latin face,
// which the reader may lack — or which holds none of these characters (Arial
// holds none) — so CJK text could show as boxes (upstream #29). gen-pptx
// embeds no fonts, so coverage can never be proven: every run with CJK text
// gets a script-appropriate fallback named in the ea slot, while <a:latin>
// keeps the deck's real face. Returns undefined when no override is needed.
// Selection mirrors upstream's fix (JimLiu/baoyu-design v2.8.2, claude-slides
// compiler): kana or a JP-named face → Yu Gothic; Hangul or KR → Malgun
// Gothic; a TC/HK-named face → Microsoft JhengHei; otherwise Microsoft YaHei.
export function eaFontFaceFor(face: string, text: string): string | undefined {
  if (!CJK_RE.test(text)) return undefined;
  if (/\bJP\b/.test(face) || KANA_RE.test(text)) return "Yu Gothic";
  if (/\bKR\b/.test(face) || HANGUL_RE.test(text)) return "Malgun Gothic";
  if (/\b(TC|HK)\b/.test(face)) return "Microsoft JhengHei";
  return "Microsoft YaHei";
}
