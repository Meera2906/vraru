import { RuntimeEvent, RuntimeState, Value } from '../types/runtime';

function fmt(v: Value): string {
  if (Array.isArray(v)) return `[${(v as Value[]).map(fmt).join(', ')}]`;
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

function generateExplanation(state: RuntimeState): { title: string; body: string; code?: string } {
  const ev = state.event;
  switch (ev.type) {
    case 'PROGRAM_START':
      return {
        title: 'Program Starting',
        body: 'The execution engine is initializing. Variables will appear as the program runs.',
      };
    case 'PROGRAM_END':
      return {
        title: 'Program Complete',
        body: `Execution finished after ${state.step + 1} steps. The program ran successfully.`,
      };
    case 'VARIABLE_CREATED':
      return {
        title: `Variable Created: ${ev.name}`,
        body: `A new variable called "${ev.name}" was created and assigned the value ${fmt(ev.value!)}.`,
        code: `${ev.name} = ${fmt(ev.value!)}`,
      };
    case 'VARIABLE_UPDATED': {
      const from = ev.prevValue !== undefined ? fmt(ev.prevValue) : '?';
      return {
        title: `Variable Updated: ${ev.name}`,
        body: `"${ev.name}" changed from ${from} to ${fmt(ev.value!)}.`,
        code: `${ev.name}: ${from} → ${fmt(ev.value!)}`,
      };
    }
    case 'ARRAY_CREATED':
      return {
        title: `Array Created: ${ev.name}`,
        body: `A list called "${ev.name}" was created with ${(ev.value as Value[]).length} elements.`,
        code: `${ev.name} = ${fmt(ev.value!)}`,
      };
    case 'LOOP_STARTED':
      return {
        title: 'Loop Started',
        body: `A for-loop begins. It will run ${ev.loopTotal} iteration${ev.loopTotal !== 1 ? 's' : ''}.`,
        code: `for ... in ... (${ev.loopTotal} items)`,
      };
    case 'LOOP_ITERATION': {
      const idx = (ev.loopIndex ?? 0) + 1;
      const total = ev.loopTotal ?? '?';
      return {
        title: `Loop Iteration ${idx} of ${total}`,
        body: `The loop variable "${ev.name}" now holds ${fmt(ev.value!)}. This is iteration ${idx} of ${total}.`,
        code: `${ev.name} = ${fmt(ev.value!)}`,
      };
    }
    case 'CONDITION_EVALUATED': {
      const verdict = ev.result ? 'TRUE' : 'FALSE';
      const action = ev.result ? 'the if-block will execute.' : 'the else-block will execute (or execution skips ahead).';
      return {
        title: `Condition: ${verdict}`,
        body: `The expression "${ev.expression}" evaluates to ${verdict}. Therefore ${action}`,
        code: `${ev.expression} → ${verdict}`,
      };
    }
    case 'BRANCH_TAKEN':
      return {
        title: ev.result ? 'Taking TRUE Branch' : 'Taking FALSE Branch',
        body: ev.result
          ? 'The condition was TRUE, so the if-block body executes now.'
          : 'The condition was FALSE, so the if-block is skipped.',
      };
    case 'FUNCTION_CALL':
      return {
        title: `Calling: ${ev.fnName ?? 'function'}()`,
        body: `The program jumps into "${ev.fnName ?? 'function'}". A new stack frame is created for its local variables.`,
        code: ev.message,
      };
    case 'FUNCTION_RETURN':
      return {
        title: `Returning: ${fmt(ev.value!)}`,
        body: `"${ev.fnName ?? 'function'}" finished and returned ${fmt(ev.value!)}. The stack frame is removed.`,
        code: `return ${fmt(ev.value!)}`,
      };
    case 'OUTPUT':
      return {
        title: 'Output Produced',
        body: `The print() statement output: "${ev.message}"`,
        code: `>>> ${ev.message}`,
      };
    case 'ERROR':
      return {
        title: '⚠ Error',
        body: ev.message,
      };
    default: {
      const t = (ev as RuntimeEvent).type as string;
      return { title: t.replace(/_/g, ' '), body: ev.message };
    }
  }
}

interface Props {
  state?: RuntimeState;
}

export default function Explanation({ state }: Props) {
  if (!state) {
    return (
      <div className="explanation idle">
        <div className="expl-eyebrow">EXPLANATION</div>
        <h3 className="expl-title">Ready</h3>
        <p className="expl-body">
          Run the program or step through it to see live explanations of every execution event.
        </p>
      </div>
    );
  }

  const { title, body, code } = generateExplanation(state);
  const isError = state.event.type === 'ERROR';
  const isCondition = state.event.type === 'CONDITION_EVALUATED';
  const verdict = state.event.result;

  return (
    <div className={`explanation ${isError ? 'has-error' : ''} ${isCondition ? (verdict ? 'true-cond' : 'false-cond') : ''}`}>
      <div className="expl-eyebrow">
        STEP {state.step + 1} · LINE {state.line}
      </div>
      <h3 className="expl-title">{title}</h3>
      <p className="expl-body">{body}</p>
      {code && <code className="expl-code">{code}</code>}

      {isCondition && (
        <div className={`condition-badge ${verdict ? 'badge-true' : 'badge-false'}`}>
          {verdict ? '✓ TRUE' : '✗ FALSE'}
        </div>
      )}
    </div>
  );
}
