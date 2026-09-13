import { parse } from './parser';
import { Expr, Stmt } from './types';
import { ProgramResult, RuntimeState, Value, RuntimeEvent } from '../types/runtime';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export class Interpreter {
  vars: Record<string, Value> = {};
  states: RuntimeState[] = [];
  output: string[] = [];
  stack: string[] = [];
  functions: Record<string, Extract<Stmt, { kind: 'function' }>> = {};
  returnValue: Value | null = null;
  returning = false;

  run(src: string): ProgramResult {
    this.vars = {};
    this.states = [];
    this.output = [];
    this.stack = [];
    this.functions = {};
    this.returning = false;
    this.returnValue = null;
    try {
      const program = parse(src);
      for (const s of program) {
        if (s.kind === 'function') this.functions[s.name] = s;
      }
      this.emit({ type: 'PROGRAM_START', line: 1, message: 'Program started' });
      this.exec(program);
      this.emit({
        type: 'PROGRAM_END',
        line: Math.max(1, src.split('\n').length),
        message: 'Program finished',
      });
      return { states: this.states };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const line = this.states.at(-1)?.line ?? 1;
      this.emit({ type: 'ERROR', line, message });
      return { states: this.states, error: { line, message } };
    }
  }

  emit(event: RuntimeEvent) {
    this.states.push({
      step: this.states.length,
      line: event.line,
      variables: clone(this.vars),
      output: [...this.output],
      callStack: [...this.stack],
      event,
    });
  }

  exec(body: Stmt[]) {
    for (const s of body) {
      this.execStmt(s);
      if (this.returning) return;
    }
  }

  execStmt(s: Stmt) {
    switch (s.kind) {
      case 'function':
        return;

      case 'assign': {
        const prev = this.vars[s.name];
        const v = this.eval(s.expr);
        const existed = s.name in this.vars;
        this.vars[s.name] = v;
        if (Array.isArray(v)) {
          this.emit({
            type: 'ARRAY_CREATED',
            line: s.line,
            name: s.name,
            value: clone(v),
            message: `Array ${s.name} created: [${(v as Value[]).join(', ')}]`,
          });
        } else {
          this.emit({
            type: existed ? 'VARIABLE_UPDATED' : 'VARIABLE_CREATED',
            line: s.line,
            name: s.name,
            value: v,
            prevValue: existed ? prev : undefined,
            message: `${s.name} = ${this.fmt(v)}`,
          });
        }
        break;
      }

      case 'indexAssign': {
        const arr = this.vars[s.object];
        const i = this.eval(s.index);
        const v = this.eval(s.expr);
        if (!Array.isArray(arr) || typeof i !== 'number')
          throw Error('Index assignment requires an array and numeric index');
        arr[Math.trunc(i)] = v;
        this.emit({
          type: 'VARIABLE_UPDATED',
          line: s.line,
          name: s.object,
          value: clone(arr),
          message: `${s.object}[${i}] = ${this.fmt(v)}`,
        });
        break;
      }

      case 'print': {
        const text = s.args.map((a) => this.fmt(this.eval(a))).join(' ');
        this.output.push(text);
        this.emit({ type: 'OUTPUT', line: s.line, message: text });
        break;
      }

      case 'if': {
        const r = this.eval(s.test);
        if (typeof r !== 'boolean') throw Error('Condition must evaluate to true or false');
        this.emit({
          type: 'CONDITION_EVALUATED',
          line: s.line,
          expression: this.sourceExpr(s.test),
          result: r,
          message: `${this.sourceExpr(s.test)} → ${r ? 'TRUE' : 'FALSE'}`,
        });
        this.emit({
          type: 'BRANCH_TAKEN',
          line: s.line,
          result: r,
          message: r ? 'TRUE branch taken' : 'FALSE branch — skipping',
        });
        this.exec(r ? s.body : s.orelse);
        break;
      }

      case 'for': {
        const it = this.eval(s.iter) as Value[];
        if (!Array.isArray(it)) throw Error('for currently requires a list or range()');
        // Determine if iter is a named variable (array)
        const iterName = s.iter.kind === 'name' ? s.iter.name : undefined;
        this.emit({
          type: 'LOOP_STARTED',
          line: s.line,
          arrayName: iterName,
          loopTotal: it.length,
          message: `Loop started (${it.length} iterations)`,
        });
        for (let k = 0; k < it.length; k++) {
          this.vars[s.name] = it[k];
          this.emit({
            type: 'LOOP_ITERATION',
            line: s.line,
            name: s.name,
            value: it[k],
            loopIndex: k,
            loopTotal: it.length,
            arrayName: iterName,
            message: `Iteration ${k + 1}/${it.length}: ${s.name} = ${this.fmt(it[k])}`,
          });
          this.exec(s.body);
          if (this.returning) return;
        }
        break;
      }

      case 'return': {
        this.returnValue = s.expr ? this.eval(s.expr) : null;
        this.returning = true;
        this.emit({
          type: 'FUNCTION_RETURN',
          line: s.line,
          value: this.returnValue,
          fnName: this.stack[this.stack.length - 1],
          message: `return ${this.fmt(this.returnValue)}`,
        });
        break;
      }
    }
  }

  eval(e: Expr): Value {
    switch (e.kind) {
      case 'literal':
        return e.value;
      case 'name':
        if (e.name in this.vars) return this.vars[e.name];
        throw Error(`Unknown variable: ${e.name}`);
      case 'array':
        return e.items.map((x) => this.eval(x));
      case 'index': {
        const a = this.eval(e.object);
        const i = this.eval(e.index);
        if (!Array.isArray(a) || typeof i !== 'number') throw Error('Invalid index');
        return (a as Value[])[Math.trunc(i)] ?? null;
      }
      case 'binary': {
        const a = this.eval(e.left);
        const b = this.eval(e.right);
        switch (e.op) {
          case '+':
            return typeof a === 'string' || typeof b === 'string'
              ? this.fmt(a) + this.fmt(b)
              : Number(a) + Number(b);
          case '-':
            return Number(a) - Number(b);
          case '*':
            return Number(a) * Number(b);
          case '/':
            return Number(a) / Number(b);
          case '%':
            return Number(a) % Number(b);
          case '>':
            return Number(a) > Number(b);
          case '<':
            return Number(a) < Number(b);
          case '>=':
            return Number(a) >= Number(b);
          case '<=':
            return Number(a) <= Number(b);
          case '==':
            return a === b;
          case '!=':
            return a !== b;
        }
        break;
      }
      case 'call': {
        if (e.name === 'range') {
          const args = e.args.map((x) => this.eval(x));
          const [a, b, c] =
            args.length === 1
              ? [0, args[0], 1]
              : args.length === 2
                ? [args[0], args[1], 1]
                : args;
          if (typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number')
            throw Error('range arguments must be numbers');
          const r: number[] = [];
          for (let x = a; c > 0 ? x < (b as number) : x > (b as number); x += c) r.push(x);
          return r;
        }
        const fn = this.functions[e.name];
        if (!fn) throw Error(`Unknown function: ${e.name}`);
        const vals = e.args.map((x) => this.eval(x));
        const oldVars = this.vars;
        const oldReturn = this.returning;
        this.vars = {};
        fn.params.forEach((p, i) => (this.vars[p] = vals[i] ?? null));
        this.returning = false;
        this.stack.push(e.name);
        this.emit({
          type: 'FUNCTION_CALL',
          line: fn.line,
          fnName: e.name,
          fnArgs: vals,
          message: `Calling ${e.name}(${vals.map((v) => this.fmt(v)).join(', ')})`,
        });
        this.exec(fn.body);
        const ret = this.returnValue;
        this.stack.pop();
        this.vars = oldVars;
        this.returning = oldReturn;
        this.returnValue = null;
        return ret;
      }
    }
    throw Error('Unsupported expression');
  }

  fmt(v: Value): string {
    if (Array.isArray(v)) return `[${(v as Value[]).map((x) => this.fmt(x)).join(', ')}]`;
    if (v === null) return 'None';
    if (typeof v === 'string') return v;
    return String(v);
  }

  sourceExpr(e: Expr): string {
    if (e.kind === 'name') return e.name;
    if (e.kind === 'literal') return this.fmt(e.value);
    if (e.kind === 'binary')
      return `${this.sourceExpr(e.left)} ${e.op} ${this.sourceExpr(e.right)}`;
    if (e.kind === 'index')
      return `${this.sourceExpr(e.object)}[${this.sourceExpr(e.index)}]`;
    if (e.kind === 'array')
      return `[${e.items.map((x) => this.sourceExpr(x)).join(', ')}]`;
    return `${e.name}(...)`;
  }
}
