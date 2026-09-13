import { Expr, Stmt } from './types';

const strip = (s: string) => s.trim();

function expr(s: string): Expr {
  s = strip(s);
  if (/^\d+(\.\d+)?$/.test(s)) return { kind: 'literal', value: Number(s) };
  if (/^".*"$|^'.*'$/.test(s)) return { kind: 'literal', value: s.slice(1, -1) };
  if (s === 'True' || s === 'False') return { kind: 'literal', value: s === 'True' };
  if (s === 'None') return { kind: 'literal', value: null };

  if (/^\[.*\]$/.test(s)) {
    const x = s.slice(1, -1).trim();
    return { kind: 'array', items: x ? splitTop(x, ',').map(expr) : [] };
  }

  const ix = s.match(/^(.+)\[(.+)\]$/);
  if (ix) return { kind: 'index', object: expr(ix[1]), index: expr(ix[2]) };

  const call = s.match(/^([A-Za-z_]\w*)\((.*)\)$/);
  if (call)
    return {
      kind: 'call',
      name: call[1],
      args: call[2].trim() ? splitTop(call[2], ',').map(expr) : [],
    };

  for (const op of ['==', '!=', '>=', '<=', '>', '<', '+', '-', '*', '/', '%']) {
    const p = findOp(s, op);
    if (p > 0)
      return {
        kind: 'binary',
        op,
        left: expr(s.slice(0, p)),
        right: expr(s.slice(p + op.length)),
      };
  }

  if (/^[A-Za-z_]\w*$/.test(s)) return { kind: 'name', name: s };

  throw new Error(`Unsupported expression: ${s}`);
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let d = 0,
    q = '';
  let st = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q && s[i - 1] !== '\\') q = '';
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      continue;
    }
    if ('(['.includes(c)) d++;
    if (')]'.includes(c)) d--;
    if (c === sep && d === 0) {
      out.push(s.slice(st, i));
      st = i + 1;
    }
  }
  out.push(s.slice(st));
  return out.map((x) => x.trim()).filter(Boolean);
}

function findOp(s: string, op: string): number {
  let d = 0,
    q = '';
  for (let i = s.length - op.length; i >= 0; i--) {
    const c = s[i];
    if (c === ')' || c === ']') d++;
    if (c === '(' || c === '[') d--;
    if (d === 0 && s.slice(i, i + op.length) === op) return i;
  }
  return -1;
}

export function parse(source: string): Stmt[] {
  const lines = source
    .replace(/\r/g, '')
    .split('\n')
    .map((raw, i) => ({
      raw,
      i: i + 1,
      text: raw.trim(),
      indent: raw.match(/^ */)?.[0].length ?? 0,
    }));

  function block(pos: number, indent: number): [Stmt[], number] {
    const out: Stmt[] = [];
    while (pos < lines.length) {
      const l = lines[pos];
      if (!l.text || l.text.startsWith('#')) {
        pos++;
        continue;
      }
      if (l.indent < indent) break;
      if (l.indent > indent) throw new Error(`Unexpected indentation on line ${l.i}`);

      let m: RegExpMatchArray | null;

      if ((m = l.text.match(/^if (.+):$/))) {
        const [b, p] = block(pos + 1, lines[pos + 1]?.indent ?? indent + 4);
        let oe: Stmt[] = [];
        pos = p;
        if (lines[pos]?.indent === indent && lines[pos].text === 'else:') {
          [oe, pos] = block(pos + 1, lines[pos + 1]?.indent ?? indent + 4);
        }
        out.push({ kind: 'if', test: expr(m[1]), body: b, orelse: oe, line: l.i });
        continue;
      }

      if ((m = l.text.match(/^for (\w+) in (.+):$/))) {
        const [b, p] = block(pos + 1, lines[pos + 1]?.indent ?? indent + 4);
        out.push({ kind: 'for', name: m[1], iter: expr(m[2]), body: b, line: l.i });
        pos = p;
        continue;
      }

      if ((m = l.text.match(/^def (\w+)\((.*?)\):$/))) {
        const [b, p] = block(pos + 1, lines[pos + 1]?.indent ?? indent + 4);
        out.push({
          kind: 'function',
          name: m[1],
          params: m[2] ? splitTop(m[2], ',') : [],
          body: b,
          line: l.i,
        });
        pos = p;
        continue;
      }

      if ((m = l.text.match(/^return(?:\s+(.+))?$/))) {
        out.push({ kind: 'return', expr: m[1] ? expr(m[1]) : undefined, line: l.i });
        pos++;
        continue;
      }

      if ((m = l.text.match(/^print\((.*)\)$/))) {
        out.push({
          kind: 'print',
          args: m[1] ? splitTop(m[1], ',').map(expr) : [],
          line: l.i,
        });
        pos++;
        continue;
      }

      if ((m = l.text.match(/^(\w+)\[([^\]]+)\]\s*=\s*(.+)$/))) {
        out.push({
          kind: 'indexAssign',
          object: m[1],
          index: expr(m[2]),
          expr: expr(m[3]),
          line: l.i,
        });
        pos++;
        continue;
      }

      if ((m = l.text.match(/^(\w+)\s*=\s*(.+)$/))) {
        out.push({ kind: 'assign', name: m[1], expr: expr(m[2]), line: l.i });
        pos++;
        continue;
      }

      throw new Error(`Unsupported syntax on line ${l.i}: ${l.text}`);
    }
    return [out, pos];
  }

  return block(0, lines.find((x) => x.text)?.indent ?? 0)[0];
}
