import { useEffect, useRef } from 'react';
import { RuntimeState } from '../types/runtime';

const EVENT_COLORS: Record<string, string> = {
  PROGRAM_START: '#4d9eff',
  PROGRAM_END: '#3ecf8e',
  VARIABLE_CREATED: '#4d9eff',
  VARIABLE_UPDATED: '#60a5fa',
  ARRAY_CREATED: '#818cf8',
  LOOP_STARTED: '#f59e0b',
  LOOP_ITERATION: '#fbbf24',
  CONDITION_EVALUATED: '#a78bfa',
  BRANCH_TAKEN: '#c084fc',
  FUNCTION_CALL: '#34d399',
  FUNCTION_RETURN: '#6ee7b7',
  OUTPUT: '#3ecf8e',
  ERROR: '#f87171',
};

const EVENT_ICON: Record<string, string> = {
  PROGRAM_START: '▶',
  PROGRAM_END: '✓',
  VARIABLE_CREATED: 'V',
  VARIABLE_UPDATED: '↑',
  ARRAY_CREATED: '[]',
  LOOP_STARTED: '↻',
  LOOP_ITERATION: '→',
  CONDITION_EVALUATED: '?',
  BRANCH_TAKEN: '⎇',
  FUNCTION_CALL: 'fn',
  FUNCTION_RETURN: '⏎',
  OUTPUT: '»',
  ERROR: '!',
};

interface Props {
  states: RuntimeState[];
  current: number;
  onSelect: (i: number) => void;
}

export default function Timeline({ states, current, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [current]);

  if (states.length === 0) {
    return (
      <div className="timeline empty">
        <span className="timeline-hint">Run the program to see execution timeline</span>
      </div>
    );
  }

  return (
    <div className="timeline" ref={containerRef}>
      <div className="timeline-track">
        {states.map((s, i) => {
          const color = EVENT_COLORS[s.event.type] ?? '#4d6070';
          const icon = EVENT_ICON[s.event.type] ?? '·';
          const isActive = i === current;
          const isPast = i < current;

          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              className={`tl-dot ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
              onClick={() => onSelect(i)}
              title={`Step ${i + 1} · Line ${s.line}\n${s.event.type}\n${s.event.message}`}
              id={`tl-step-${i}`}
              style={{
                '--dot-color': color,
              } as React.CSSProperties}
            >
              <span className="tl-icon">{icon}</span>
              <span className="tl-num">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <div className="timeline-scrubber">
        <input
          type="range"
          min={0}
          max={Math.max(0, states.length - 1)}
          value={current}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="tl-scrubber"
          id="timeline-scrubber"
        />
      </div>
    </div>
  );
}
