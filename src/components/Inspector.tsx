import { RuntimeState, Value } from '../types/runtime';

function fmt(v: Value): string {
  if (Array.isArray(v)) return `[${(v as Value[]).map(fmt).join(', ')}]`;
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

function getVarType(v: Value): string {
  if (Array.isArray(v)) return 'list';
  if (v === null) return 'None';
  return typeof v;
}

interface Props {
  state?: RuntimeState;
}

export default function Inspector({ state }: Props) {
  const changedVar = state?.event.name;

  return (
    <aside className="inspector">
      <div className="insp-header">
        <span className="section-title">RUNTIME</span>
        {state && (
          <span className="insp-meta">
            Step {state.step + 1} · Line {state.line}
          </span>
        )}
      </div>

      <div className="insp-section">
        <div className="section-title">VARIABLES</div>
        <div className="vars">
          {!state || Object.keys(state.variables).length === 0 ? (
            <div className="vars-empty">No variables yet</div>
          ) : (
            Object.entries(state.variables).map(([k, v]) => (
              <div
                className={`var ${k === changedVar ? 'var-changed' : ''}`}
                key={k}
              >
                <div className="var-left">
                  <span className="var-name">{k}</span>
                  <span className="var-type">{getVarType(v)}</span>
                </div>
                <strong className="var-value">{fmt(v)}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      {state && state.callStack.length > 0 && (
        <div className="insp-section">
          <div className="section-title">CALL STACK</div>
          <div className="call-stack">
            {[...state.callStack].reverse().map((fn, i) => (
              <div key={i} className="stack-frame">
                <span className="frame-icon">⊙</span>
                <span>{fn}()</span>
              </div>
            ))}
            <div className="stack-frame stack-main">
              <span className="frame-icon">◎</span>
              <span>__main__</span>
            </div>
          </div>
        </div>
      )}

      <div className="insp-section">
        <div className="section-title">OUTPUT</div>
        <div className="output">
          {!state || state.output.length === 0 ? (
            <span className="output-empty">No output yet</span>
          ) : (
            state.output.map((x, i) => (
              <div key={i} className="output-line">
                <span className="output-prompt">›</span>
                {x}
              </div>
            ))
          )}
        </div>
      </div>

      {state && (
        <div className="insp-section">
          <div className="section-title">CURRENT EVENT</div>
          <div className="event-tag">{state.event.type.replace(/_/g, ' ')}</div>
          <div className="event-msg">{state.event.message}</div>
        </div>
      )}
    </aside>
  );
}
