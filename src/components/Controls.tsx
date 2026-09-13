interface Props {
  running: boolean;
  onRun: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  onRestart: () => void;
  onNext: () => void;
  onPrev: () => void;
  speed: number;
  setSpeed: (n: number) => void;
  stepIndex: number;
  totalSteps: number;
}

export default function Controls({
  running,
  onRun,
  onPause,
  onStop,
  onReset,
  onRestart,
  onNext,
  onPrev,
  speed,
  setSpeed,
  stepIndex,
  totalSteps,
}: Props) {
  return (
    <div className="controls">
      <div className="controls-left">
        <button
          className="ctrl-btn ctrl-reset"
          onClick={onReset}
          title="Reset"
          id="btn-reset"
        >
          <span className="ctrl-icon">↺</span>
          <span className="ctrl-label">Reset</span>
        </button>

        <button
          className="ctrl-btn ctrl-prev"
          onClick={onPrev}
          disabled={stepIndex === 0 || totalSteps === 0}
          title="Step Backward"
          id="btn-step-back"
        >
          <span className="ctrl-icon">◀</span>
          <span className="ctrl-label">Back</span>
        </button>

        {running ? (
          <button
            className="ctrl-btn ctrl-primary ctrl-pause"
            onClick={onPause}
            title="Pause"
            id="btn-pause"
          >
            <span className="ctrl-icon">⏸</span>
            <span className="ctrl-label">Pause</span>
          </button>
        ) : (
          <button
            className="ctrl-btn ctrl-primary ctrl-run"
            onClick={totalSteps > 0 ? onRestart : onRun}
            title={totalSteps > 0 ? 'Restart' : 'Run'}
            id="btn-run"
          >
            <span className="ctrl-icon">▶</span>
            <span className="ctrl-label">{totalSteps > 0 && !running ? 'Run' : 'Run'}</span>
          </button>
        )}

        <button
          className="ctrl-btn ctrl-next"
          onClick={onNext}
          disabled={stepIndex >= totalSteps - 1 || totalSteps === 0}
          title="Step Forward"
          id="btn-step-forward"
        >
          <span className="ctrl-icon">▶</span>
          <span className="ctrl-label">Step</span>
        </button>

        <button
          className="ctrl-btn ctrl-stop"
          onClick={onStop}
          disabled={!running}
          title="Stop"
          id="btn-stop"
        >
          <span className="ctrl-icon">■</span>
          <span className="ctrl-label">Stop</span>
        </button>
      </div>

      <div className="controls-right">
        {totalSteps > 0 && (
          <div className="step-counter">
            <span className="step-num">{stepIndex + 1}</span>
            <span className="step-sep">/</span>
            <span className="step-total">{totalSteps}</span>
          </div>
        )}

        <label className="speed-label">
          <span>Speed</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            id="speed-select"
          >
            {[0.25, 0.5, 1, 2, 4].map((x) => (
              <option key={x} value={x}>
                {x}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
