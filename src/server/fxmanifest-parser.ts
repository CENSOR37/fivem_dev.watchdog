// fxmanifest-parser.ts
export type FxManifestData = Record<string, string[]>;

/**
 * Parse a fxmanifest.lua-like file into a map<string, string[]>
 */
export function parseFxManifest(source: string): FxManifestData {
  const cleaned = stripComments(source);
  const tokens = tokenize(cleaned);

  const out: FxManifestData = {};

  let i = 0;
  while (i < tokens.length) {
    const k = tokens[i];
    if (!k || k.t !== "ident") { i++; continue; }

    const key = normalizeKey(k.v);
    const n1 = tokens[i + 1];

    // Pattern A: key "value"
    if (n1 && n1.t === "string") {
      add(out, key, [n1.v]);
      i += 2;
      continue;
    }

    // Pattern B: key { "a", "b" }
    if (n1 && n1.t === "punct" && n1.v === "{") {
      const { arr, nextIndex } = readArray(tokens, i + 2);
      add(out, key, arr);
      i = nextIndex;
      continue;
    }

    // Pattern C: key("value") or key({ ... })
    if (n1 && n1.t === "punct" && n1.v === "(") {
      let j = i + 2;
      const arr: string[] = [];
      let closed = false;

      while (j < tokens.length) {
        const tk = tokens[j];
        if (!tk) break;

        if (tk.t === "string") {
          arr.push(tk.v);
          j++;
          if (tokens[j]?.t === "punct" && tokens[j].v === ",") j++;
          continue;
        }

        if (tk.t === "punct" && tk.v === "{") {
          const read = readArray(tokens, j + 1);
          arr.push(...read.arr);
          j = read.nextIndex;
          if (tokens[j]?.t === "punct" && tokens[j].v === ",") j++;
          continue;
        }

        if (tk.t === "punct" && tk.v === ")") {
          closed = true;
          j++;
          break;
        }

        j++;
      }

      if (arr.length) add(out, key, arr);
      i = j;
      continue;
    }

    i++;
  }

  return out;
}

/* ---------------- helpers ---------------- */

function stripComments(s: string): string {
  return s
    .split("\n")
    .map(line => {
      const idx1 = line.indexOf("//");
      const idx2 = line.indexOf("--");
      const cutAt = Math.min(idx1 >= 0 ? idx1 : Infinity, idx2 >= 0 ? idx2 : Infinity);
      return cutAt !== Infinity ? line.slice(0, cutAt) : line;
    })
    .join("\n");
}

type Tok =
  | { t: "ident"; v: string }
  | { t: "string"; v: string }
  | { t: "punct"; v: "{" | "}" | "," | "(" | ")" };

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const isSpace = (c: string) => /\s/.test(c);
  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_.]/.test(c);

  while (i < s.length) {
    const ch = s[i];

    if (isSpace(ch)) { i++; continue; }

    if (["{", "}", "(", ",", ")"].includes(ch)) {
      toks.push({ t: "punct", v: ch as "{" | "}" | "," | "(" | ")" });
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let val = "";
      while (i < s.length) {
        const c = s[i++];
        if (c === "\\") { if (i < s.length) val += s[i++]; continue; }
        if (c === quote) break;
        val += c;
      }
      toks.push({ t: "string", v: val });
      continue;
    }

    if (isIdentStart(ch)) {
      let id = ch;
      i++;
      while (i < s.length && isIdent(s[i])) id += s[i++];
      toks.push({ t: "ident", v: id });
      continue;
    }

    i++;
  }

  return toks;
}

function normalizeKey(k: string): string {
  if (k.endsWith("_script")) return k + "s";
  if (k === "file") return "files";
  return k;
}

function add(out: FxManifestData, key: string, vals: string[]) {
  if (!out[key]) out[key] = [];
  out[key].push(...vals);
}

function readArray(tokens: Tok[], startIndex: number): { arr: string[]; nextIndex: number } {
  const arr: string[] = [];
  let i = startIndex;

  while (i < tokens.length) {
    const tk = tokens[i];
    if (!tk) break;

    if (tk.t === "string") {
      arr.push(tk.v);
      i++;
      if (tokens[i]?.t === "punct" && tokens[i].v === ",") i++;
      continue;
    }

    if (tk.t === "punct" && tk.v === "}") {
      i++;
      break;
    }

    i++;
  }

  return { arr, nextIndex: i };
}
