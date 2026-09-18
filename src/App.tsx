import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Scene, { SceneRef } from './three/Scene';
import { handTracking, HandTrackingResults } from './services/handTracking';
import { PersonalityMode } from './three/BillboardOverlay';
import { useGestureEngine } from './hooks/useGestureEngine';
import { useExecutionEngine } from './hooks/useExecutionEngine';
import { examples } from './data/examples';
import CodeEditor from './components/Editor';
import Controls from './components/Controls';
import Timeline from './components/Timeline';
import Explanation from './components/Explanation';
import Inspector from './components/Inspector';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  // ── Personality & View Mode State ──
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>('quirky');
  const [activeTab, setActiveTab] = useState<'arena' | 'classic'>('arena');
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFps, setCameraFps] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPip, setShowPip] = useState(true);

  // Calibration test states
  const [pinchProgress, setPinchProgress] = useState(0); // 0 to 3 seconds
  const [isCurrentlyPinching, setIsCurrentlyPinching] = useState(false);
  const [currentPinchDist, setCurrentPinchDist] = useState(1.0);
  const pinchHoldStartRef = useRef<number | null>(null);

  // References
  const sceneRef = useRef<SceneRef | null>(null);
  const calibrationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<HTMLDivElement | null>(null);
  const calibrationRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<HTMLDivElement | null>(null);

  // ── Gesture & Physics Engine ──
  const gestureEng = useGestureEngine({
    onSpawnTile: (text) => {
      sceneRef.current?.spawnOutputTile(text);
    },
    onShatter: () => {
      // Buffer overflow shatter callback
    },
    onTriggerRoast: (msg, title) => {
      sceneRef.current?.triggerRoast(msg, title);
    },
    onResetPhysics: () => {
      sceneRef.current?.resetPhysics();
    },
  });

  // ── Classic Python Execution Engine ──
  const [code, setCode] = useState(examples['Maximum Value']);
  const classicEng = useExecutionEngine(code);

  // ── Start Hand Tracking Service ──
  const startTracking = useCallback(async () => {
    setCameraError(null);
    const success = await handTracking.start();
    if (!success) {
      setCameraError('Camera access unavailable. Mouse drag & click gestures are active!');
    }
  }, []);

  // Set up tracking listeners
  useEffect(() => {
    const unsubStatus = handTracking.onStatus((status) => {
      setCameraActive(status.active);
      setCameraFps(status.fps);
      if (status.error) setCameraError(status.error);
    });

    const unsubResults = handTracking.onResults((res: HandTrackingResults) => {
      setIsCurrentlyPinching(res.isPinching);
      setCurrentPinchDist(res.pinchDistance);

      // 3-Second Pinch Hold Calibration logic
      if (res.isPinching) {
        if (!pinchHoldStartRef.current) {
          pinchHoldStartRef.current = performance.now();
        } else {
          const elapsed = (performance.now() - pinchHoldStartRef.current) / 1000;
          const progress = Math.min(3.0, elapsed);
          setPinchProgress(progress);

          if (progress >= 3.0 && !isCalibrated) {
            setIsCalibrated(true);
            // Smoothly scroll to AR Arena
            setTimeout(() => {
              arenaRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 600);
          }
        }
      } else {
        pinchHoldStartRef.current = null;
        setPinchProgress((p) => Math.max(0, p - 0.15));
      }

      // Render PIP canvas if visible
      if (pipCanvasRef.current) {
        handTracking.renderDebugCanvas(
          pipCanvasRef.current,
          res.rawResults,
          res.isPinching,
          res.pinchDistance,
          res.midpoint
        );
      }

      // Render Calibration canvas if visible
      if (calibrationCanvasRef.current) {
        handTracking.renderDebugCanvas(
          calibrationCanvasRef.current,
          res.rawResults,
          res.isPinching,
          res.pinchDistance,
          res.midpoint
        );
      }
    });

    // Proactively start hand tracking
    startTracking();

    return () => {
      unsubStatus();
      unsubResults();
    };
  }, [isCalibrated, startTracking]);

  // ── GSAP ScrollTrigger Sequence ──
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Floating hero elements
      gsap.to('.hero-float-block', {
        y: -15,
        rotation: 3,
        duration: 2.5,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 0.3,
      });

      // Mode Select section reveal
      if (modeRef.current) {
        gsap.from('.mode-card', {
          scrollTrigger: {
            trigger: modeRef.current,
            start: 'top 75%',
          },
          y: 40,
          opacity: 0,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power3.out',
        });
      }

      // Calibration section reveal
      if (calibrationRef.current) {
        gsap.from('.calibration-card', {
          scrollTrigger: {
            trigger: calibrationRef.current,
            start: 'top 75%',
          },
          scale: 0.95,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
        });
      }
    });

    return () => ctx.revert();
  }, []);

  // Handle personality mode toggle
  const handleModeSelect = (mode: PersonalityMode) => {
    setPersonalityMode(mode);
    gestureEng.setPersonalityMode(mode);
    sceneRef.current?.setPersonalityMode(mode);
  };

  const jumpToArena = () => {
    arenaRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="gesture-blocks-app">
      {/* ── PHASE 1: HERO SECTION ── */}
      <section className="section section-hero" ref={heroRef} id="section-hero">
        <div className="hero-background-glow" />

        <div className="hero-floating-elements">
          <div className="hero-float-block float-1">
            <code>for i in range(∞):</code>
          </div>
          <div className="hero-float-block float-2">
            <code>print("🔥 HEAP MELT")</code>
          </div>
          <div className="hero-float-block float-3">
            <code>CANNON::RIGID_BODY(g=-9.82)</code>
          </div>
          <div className="hero-float-block float-4">
            <code>ERROR 0xDEADBEEF: SKILL ISSUE</code>
          </div>
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-pulse" />
            VIRTUAL REALITY & SPATIAL COMPUTING
          </div>

          <h1 className="hero-title">
            GestureBlocks <span className="text-gradient">AR</span>
          </h1>

          <h2 className="hero-subtitle">THE CHAOTIC CODE VISUALIZER</h2>

          <p className="hero-desc">
            Pick up bevelled 3D code blocks with real-time hand gestures. Snap a print statement into an
            infinite loop to cascade rigid-body memory tiles into an acrylic bin. Overfill past 35 items
            to trigger an explosive buffer overflow shatter event and dynamic AI roasts!
          </p>

          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={() => calibrationRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <span>⚡ Calibrate Hand Gestures</span>
            </button>
            <button className="btn-hero-secondary" onClick={jumpToArena}>
              <span>Enter AR Arena Directly →</span>
            </button>
          </div>

          <div className="hero-features-strip">
            <div className="feature-item">
              <span className="feature-icon">🖐️</span>
              <div>
                <b>@mediapipe/hands</b>
                <small>3D Euclidean Pinch Detection</small>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💥</span>
              <div>
                <b>cannon-es Physics</b>
                <small>Acrylic Bin & Shatter Impulses</small>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎭</span>
              <div>
                <b>Dual AI Personalities</b>
                <small>Quirky Roaster vs Serious Rage-Bait</small>
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-indicator" onClick={() => modeRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          <span>Scroll to Choose AI Personality</span>
          <span className="arrow-down">↓</span>
        </div>
      </section>

      {/* ── PHASE 2: MODE SELECT (DUAL PERSONALITY) ── */}
      <section className="section section-modes" ref={modeRef} id="section-modes">
        <div className="section-header">
          <span className="section-tag">PHASE 2 / 4</span>
          <h2 className="section-title">CHOOSE YOUR AI PERSONALITY</h2>
          <p className="section-desc">
            How should the system respond when your code inevitably brings down the entire heap?
          </p>
        </div>

        <div className="modes-container">
          {/* Quirky Mode Card */}
          <div
            className={`mode-card mode-card--quirky ${personalityMode === 'quirky' ? 'mode-card--active' : ''}`}
            onClick={() => handleModeSelect('quirky')}
          >
            <div className="mode-card-badge">POP-ART & COMIC</div>
            <div className="mode-card-header">
              <span className="mode-avatar">🎉</span>
              <div>
                <h3 className="mode-name">Quirky Mode</h3>
                <span className="mode-sub">Bouncy GSAP • Gen-Z Developer Roasts</span>
              </div>
            </div>

            <p className="mode-body">
              Vibrant comic styling, pastel gradients, and sarcastic developer roasts delivered via springy
              GSAP elastic animations when your buffer explodes.
            </p>

            <div className="mode-preview-bubble quirky-bubble">
              <i>"Congrats! You just melted the heap with that loop, absolute prodigy. Bro cooked so hard the garbage collector resigned."</i>
            </div>

            <button className="btn-select-mode">
              {personalityMode === 'quirky' ? '✓ Currently Selected' : 'Select Quirky Mode'}
            </button>
          </div>

          {/* Serious Study Mode Card */}
          <div
            className={`mode-card mode-card--serious ${personalityMode === 'serious' ? 'mode-card--active' : ''}`}
            onClick={() => handleModeSelect('serious')}
          >
            <div className="mode-card-badge">ENTERPRISE AUDIT</div>
            <div className="mode-card-header">
              <span className="mode-avatar">🛡️</span>
              <div>
                <h3 className="mode-name">Serious Study Mode</h3>
                <span className="mode-sub">Monospace Terminal • Unhelpful Rage-Bait</span>
              </div>
            </div>

            <p className="mode-body">
              Cold enterprise terminal aesthetics (`#111827`). Features a deliberately frustrating 3-second
              fake loading spinner followed by bureaucratic rage-bait responses.
            </p>

            <div className="mode-preview-bubble serious-bubble">
              <code>$ ar-audit --level pedantic<br/>FATAL: Error 0xDEADBEEF: Unqualified user detected. Skill issue. Ticket closed as WONTFIX.</code>
            </div>

            <button className="btn-select-mode">
              {personalityMode === 'serious' ? '✓ Currently Selected' : 'Select Serious Study'}
            </button>
          </div>
        </div>

        <div className="section-next-action">
          <button
            className="btn-hero-primary"
            onClick={() => calibrationRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            Proceed to Hand Calibration →
          </button>
        </div>
      </section>

      {/* ── PHASE 3: LIVE WEBCAM & PINCH CALIBRATION ── */}
      <section className="section section-calibration" ref={calibrationRef} id="section-calibration">
        <div className="section-header">
          <span className="section-tag">PHASE 3 / 4</span>
          <h2 className="section-title">HAND TRACKING & PINCH CALIBRATION</h2>
          <p className="section-desc">
            Test your pinch gesture using landmark 4 (Thumb tip) and landmark 8 (Index fingertip).
            Hold the pinch for 3 seconds to complete calibration!
          </p>
        </div>

        <div className="calibration-card">
          <div className="calibration-video-col">
            <div className="video-viewport">
              <canvas
                ref={calibrationCanvasRef}
                width={640}
                height={480}
                className="calibration-canvas"
              />
              <div className="canvas-crosshair" />

              {/* Status overlay */}
              <div className="viewport-overlay">
                <span className={`status-pill ${cameraActive ? 'status-pill--active' : 'status-pill--standby'}`}>
                  ● {cameraActive ? `TRACKING (${cameraFps} FPS)` : 'CAMERA STANDBY'}
                </span>
                <span className="status-pill">
                  Pinch Dist: {currentPinchDist.toFixed(3)} {isCurrentlyPinching ? '🔥 PINCHED' : ''}
                </span>
              </div>
            </div>

            {cameraError && (
              <div className="camera-warning">
                ℹ️ {cameraError}
              </div>
            )}
          </div>

          <div className="calibration-controls-col">
            <h3 className="calib-step-title">3-Second Pinch-and-Hold Test</h3>
            <p className="calib-step-desc">
              Bring your index finger and thumb together in front of the camera. The circular meter will
              fill up as you maintain the pinch.
            </p>

            {/* Circular Progress Gauge */}
            <div className="progress-gauge-wrapper">
              <svg className="progress-gauge-svg" viewBox="0 0 120 120">
                <circle
                  className="gauge-bg"
                  cx="60"
                  cy="60"
                  r="52"
                  strokeWidth="8"
                />
                <circle
                  className="gauge-fill"
                  cx="60"
                  cy="60"
                  r="52"
                  strokeWidth="8"
                  style={{
                    strokeDasharray: 326.7,
                    strokeDashoffset: 326.7 - (326.7 * (pinchProgress / 3.0)),
                  }}
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-seconds">{pinchProgress.toFixed(1)}s</span>
                <span className="gauge-label">{isCalibrated ? 'READY' : 'HOLD PINCH'}</span>
              </div>
            </div>

            <div className="calib-guidance">
              {isCalibrated ? (
                <div className="calib-success-badge">
                  ✓ CALIBRATION SUCCESSFUL! Entering AR Arena...
                </div>
              ) : isCurrentlyPinching ? (
                <div className="calib-active-badge">
                  🖐️ Pinch detected! Keep holding ({pinchProgress.toFixed(1)} / 3.0s)...
                </div>
              ) : (
                <div className="calib-idle-badge">
                  👉 Bring thumb & index fingertips together to pinch.
                </div>
              )}
            </div>

            <div className="calib-buttons">
              {!cameraActive && (
                <button className="btn-sub-action" onClick={startTracking}>
                  🎥 Start / Request Camera
                </button>
              )}
              <button className="btn-hero-primary" onClick={jumpToArena}>
                {isCalibrated ? 'Enter AR Arena Now →' : 'Skip & Enter Arena with Mouse/Hand →'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── PHASE 4: FULL-SCREEN AR ARENA & 3D WORKSPACE ── */}
      <section className="section section-arena" ref={arenaRef} id="section-arena">
        {/* Arena Top Navigation & Status Bar */}
        <header className="arena-header">
          <div className="arena-brand">
            <span className="brand-logo-icon">▲</span>
            <div className="brand-titles">
              <b>GestureBlocks AR</b>
              <span className="brand-sub">THE CHAOTIC CODE VISUALIZER</span>
            </div>
          </div>

          <div className="arena-center-stats">
            {/* Output Bin Capacity Counter */}
            <div
              className={`capacity-meter ${
                gestureEng.tileCount > 28
                  ? 'capacity-meter--critical'
                  : gestureEng.tileCount > 15
                  ? 'capacity-meter--warning'
                  : ''
              } ${gestureEng.isShattered ? 'capacity-meter--shattered' : ''}`}
            >
              <span className="cap-label">
                {gestureEng.isShattered
                  ? '💥 BUFFER OVERFLOWED'
                  : `BIN: ${gestureEng.tileCount} / ${gestureEng.maxCapacity} ITEMS`}
              </span>
              <div className="cap-bar-track">
                <div
                  className="cap-bar-fill"
                  style={{
                    width: `${Math.min(100, (gestureEng.tileCount / gestureEng.maxCapacity) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Tracking Status */}
            <div className="tracking-status-pill">
              <span className={`tracking-dot ${cameraActive ? 'tracking-dot--live' : ''}`} />
              <span>{cameraActive ? `CAM: ${cameraFps} FPS` : 'MOUSE / GESTURE ACTIVE'}</span>
            </div>
          </div>

          <div className="arena-header-actions">
            {/* Personality Mode Toggle */}
            <button
              className={`btn-mode-toggle ${
                personalityMode === 'quirky' ? 'btn-mode-toggle--quirky' : 'btn-mode-toggle--serious'
              }`}
              onClick={() =>
                handleModeSelect(personalityMode === 'quirky' ? 'serious' : 'quirky')
              }
              title="Click to toggle AI personality"
            >
              {personalityMode === 'quirky' ? '⚡ Quirky Mode' : '🛡️ Serious Audit'}
            </button>

            {/* View Switcher: AR Arena vs Classic Python Editor */}
            <button
              className={`btn-tab ${activeTab === 'arena' ? 'btn-tab--active' : ''}`}
              onClick={() => setActiveTab('arena')}
            >
              ◈ 3D AR Arena
            </button>
            <button
              className={`btn-tab ${activeTab === 'classic' ? 'btn-tab--active' : ''}`}
              onClick={() => setActiveTab('classic')}
            >
              ⊞ Code Inspector
            </button>
          </div>
        </header>

        {/* Main 3D Canvas Workspace */}
        <div className="arena-workspace">
          <Scene
            ref={sceneRef}
            state={classicEng.state}
            personalityMode={personalityMode}
            onTileCountChange={(count) => gestureEng.setTileCount(count)}
            onBufferOverflow={() => gestureEng.handleBufferOverflow()}
            onSnapChange={(nested) => gestureEng.handleSnapChange(nested)}
            showClassicWorld={activeTab === 'classic'}
          />

          {/* Floating Action Controls Dock */}
          <div className="arena-dock">
            <button
              className={`dock-btn ${gestureEng.isNested ? 'dock-btn--active' : ''}`}
              onClick={() => {
                sceneRef.current?.snapPrintToFor();
              }}
              title="Programmatically snap PRINT block into FOR loop"
            >
              <span className="dock-icon">⎘</span>
              <span>{gestureEng.isNested ? 'Blocks Snapped!' : 'Snap PRINT to FOR'}</span>
            </button>

            <button
              className="dock-btn dock-btn--primary"
              onClick={() => {
                if (gestureEng.isRunningLoop) {
                  gestureEng.stopLoop();
                } else {
                  gestureEng.startLoop(false);
                }
              }}
            >
              <span className="dock-icon">{gestureEng.isRunningLoop ? '⏸' : '▶'}</span>
              <span>{gestureEng.isRunningLoop ? 'Pause Loop' : 'Run Loop'}</span>
            </button>

            <button
              className="dock-btn dock-btn--danger"
              onClick={() => {
                // Infinite Loop that pours tiles rapidly until shatter!
                gestureEng.setLoopSpeed(12);
                gestureEng.startLoop(true);
              }}
              title="Start rapid infinite spawner to overfill heap and shatter bin"
            >
              <span className="dock-icon">⚡</span>
              <span>Infinite Heap Melt</span>
            </button>

            <button
              className="dock-btn"
              onClick={() => {
                sceneRef.current?.triggerShatter();
                gestureEng.handleBufferOverflow();
              }}
              title="Apply outward explosive impulse to all tiles and shatter bin"
            >
              <span className="dock-icon">💥</span>
              <span>Trigger Shatter</span>
            </button>

            <button
              className="dock-btn"
              onClick={() => {
                sceneRef.current?.triggerRoast();
              }}
              title="Trigger 3D billboard roast overlay"
            >
              <span className="dock-icon">🎭</span>
              <span>AI Roast</span>
            </button>

            <button
              className="dock-btn dock-btn--reset"
              onClick={() => {
                gestureEng.resetAll();
              }}
              title="Reset physics world and restore acrylic bin"
            >
              <span className="dock-icon">↺</span>
              <span>Reset Physics</span>
            </button>
          </div>

          {/* Picture-In-Picture (PIP) Camera Feedback Window */}
          {showPip && (
            <div className="pip-window">
              <div className="pip-header">
                <span>WEBCAM LANDMARKS</span>
                <button className="pip-close" onClick={() => setShowPip(false)}>
                  ✕
                </button>
              </div>
              <canvas
                ref={pipCanvasRef}
                width={240}
                height={160}
                className="pip-canvas"
              />
              <div className="pip-footer">
                <span>{isCurrentlyPinching ? '🟢 PINCHING' : '⚪ OPEN'}</span>
                <span>d: {currentPinchDist.toFixed(2)}</span>
              </div>
            </div>
          )}

          {!showPip && (
            <button className="btn-restore-pip" onClick={() => setShowPip(true)}>
              🎥 Show Camera PIP
            </button>
          )}

          {/* Interaction Instruction Banner */}
          <div className="arena-hint">
            <span className="hint-pill">💡 GESTURE INSTRUCTIONS</span>
            <span>
              Pinch index & thumb over 3D blocks to drag. Release near the blue FOR socket to snap!
              Overfill past 35 items to trigger buffer overflow shatter chaos.
            </span>
          </div>
        </div>

        {/* Optional Classic Code Inspector Panel (when selected) */}
        {activeTab === 'classic' && (
          <div className="classic-workspace-panel">
            <div className="classic-editor-row">
              <div className="classic-editor-col">
                <div className="pane-head">
                  <span>PYTHON SOURCE</span>
                  <span className="pane-line">
                    {classicEng.state ? `LINE ${classicEng.state.line}` : 'READY'}
                  </span>
                </div>
                <CodeEditor
                  code={code}
                  onChange={setCode}
                  activeLine={classicEng.state?.line}
                />
              </div>

              <div className="classic-controls-col">
                <Controls
                  running={classicEng.running}
                  onRun={classicEng.run}
                  onPause={classicEng.pause}
                  onStop={classicEng.stop}
                  onReset={classicEng.reset}
                  onRestart={classicEng.restart}
                  onNext={classicEng.stepForward}
                  onPrev={classicEng.stepBack}
                  speed={classicEng.speed}
                  setSpeed={classicEng.setSpeed}
                  stepIndex={classicEng.current}
                  totalSteps={classicEng.states.length}
                />
                <Timeline
                  states={classicEng.states}
                  current={classicEng.current}
                  onSelect={classicEng.jumpTo}
                />
              </div>
            </div>

            <div className="classic-lower-row">
              <Explanation state={classicEng.state} />
              <Inspector state={classicEng.state} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
