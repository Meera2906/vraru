import { useState } from 'react';
import CodeEditor from './components/Editor';
import Controls from './components/Controls';
import Timeline from './components/Timeline';
import Explanation from './components/Explanation';
import Inspector from './components/Inspector';
import Scene from './three/Scene';
import { examples } from './data/examples';
import { useExecutionEngine } from './hooks/useExecutionEngine';

type Mode = 'studio' | 'presentation';
type VisualMode = 'live' | 'flow' | 'memory' | 'data' | 'ast';

export default function App() {
  const [code, setCode] = useState(examples['Maximum Value']);
  const [mode, setMode] = useState<Mode>('studio');
  const [spatialMode, setSpatialMode] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualMode>('live');
  const [selectedExample, setSelectedExample] = useState('Maximum Value');

  const eng = useExecutionEngine(code);

  const loadExample = (key: string) => {
    eng.reset();
    setSelectedExample(key);
    setCode(examples[key as keyof typeof examples]);
  };

  const isPresentation = mode === 'presentation';

  return (
    <div className={`app ${isPresentation ? 'app--presentation' : ''}`}>
      {/* ── Header ── */}
      <header className="header">
        <div className="brand">
          <div className="logo">
            <span className="logo-a">A</span>
            <span className="logo-r">R</span>
          </div>
          <div className="brand-text">
            <b className="brand-name">ARCode</b>
            <span className="brand-sub">CODE COMES ALIVE</span>
          </div>
        </div>

        <div className="header-center">
          {eng.state && (
            <div className="live-event">
              <span className="live-dot" />
              <span>{eng.state.event.type.replace(/_/g, ' ')}</span>
              <span className="live-line">LINE {eng.state.line}</span>
            </div>
          )}
        </div>

        <div className="header-actions">
          <select
            value={selectedExample}
            onChange={(e) => loadExample(e.target.value)}
            className="example-select"
            id="example-select"
          >
            {Object.keys(examples).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>

          <button
            className={`btn-mode ${spatialMode ? 'btn-mode--active' : ''}`}
            onClick={() => setSpatialMode((s) => !s)}
            id="btn-spatial"
            title="Toggle Spatial Mode"
          >
            ◈ {spatialMode ? 'Spatial ON' : 'Spatial Mode'}
          </button>

          <select
            value={visualMode}
            onChange={(e) => setVisualMode(e.target.value as VisualMode)}
            className="example-select"
            id="visual-mode-select"
            title="Visualization mode"
          >
            <option value="live">LIVE</option>
            <option value="flow">FLOW</option>
            <option value="memory">MEMORY</option>
            <option value="data">DATA</option>
            <option value="ast">AST</option>
          </select>

          <button
            className={`btn-mode ${isPresentation ? 'btn-mode--active' : ''}`}
            onClick={() => setMode(mode === 'studio' ? 'presentation' : 'studio')}
            id="btn-presentation"
          >
            {isPresentation ? '✕ Exit' : '⊞ Present'}
          </button>
        </div>
      </header>

      {/* ── Main workspace ── */}
      <main className="workspace">
        {/* Code pane (hidden in presentation) */}
        {!isPresentation && (
          <section className="pane pane--code" id="code-pane">
            <div className="pane-head">
              <span>PYTHON</span>
              <span className="pane-line">
                {eng.state ? `LINE ${eng.state.line}` : 'READY'}
              </span>
            </div>
            <CodeEditor
              code={code}
              onChange={setCode}
              activeLine={eng.state?.line}
            />
          </section>
        )}

        {/* 3D World pane */}
        <section className={`pane pane--world ${isPresentation ? 'pane--world-full' : ''}`} id="world-pane">
          <div className="pane-head">
            <span>RUNTIME WORLD</span>
            <span className="live-indicator">
              <span className="live-dot" />
              LIVE
            </span>
          </div>
          <Scene state={eng.state} spatialMode={spatialMode} visualMode={visualMode} />

          {/* Presentation mode: show code strip at bottom */}
          {isPresentation && eng.state && (
            <div className="presentation-info">
              <span className="pres-line">LINE {eng.state.line}</span>
              <span className="pres-event">{eng.state.event.type.replace(/_/g, ' ')}</span>
              <span className="pres-msg">{eng.state.event.message}</span>
            </div>
          )}
        </section>
      </main>

      {/* ── Controls ── */}
      <section className={`controls-section ${isPresentation ? 'controls-section--large' : ''}`}>
        <Controls
          running={eng.running}
          onRun={eng.run}
          onPause={eng.pause}
          onStop={eng.stop}
          onReset={eng.reset}
          onRestart={eng.restart}
          onNext={eng.stepForward}
          onPrev={eng.stepBack}
          speed={eng.speed}
          setSpeed={eng.setSpeed}
          stepIndex={eng.current}
          totalSteps={eng.states.length}
        />
      </section>

      {/* ── Timeline ── */}
      <section className="timeline-section">
        <Timeline
          states={eng.states}
          current={eng.current}
          onSelect={eng.jumpTo}
        />
      </section>

      {/* ── Lower panels ── */}
      {!isPresentation && (
        <section className="lower">
          <Explanation state={eng.state} />
          <Inspector state={eng.state} />
        </section>
      )}

      {/* Presentation mode lower */}
      {isPresentation && (
        <section className="lower pres-lower">
          <Explanation state={eng.state} />
          {eng.state?.output && eng.state.output.length > 0 && (
            <div className="pres-output">
              <div className="section-title">OUTPUT</div>
              {eng.state.output.map((line, i) => (
                <div key={i} className="pres-output-line">{line}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Error toast */}
      {eng.error && (
        <div className="toast" id="error-toast">
          <div className="toast-title">⚠ Error on Line {eng.error.line}</div>
          <div className="toast-msg">{eng.error.message}</div>
          <div className="toast-hint">
            Supported: variables, lists, arithmetic, if/else, for loops, print, functions
          </div>
        </div>
      )}
    </div>
  );
}
