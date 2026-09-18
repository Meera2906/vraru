import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { RuntimeState, Value, RuntimeEvent } from '../types/runtime';
import { handTracking, HandTrackingResults } from '../services/handTracking';
import { PhysicsManager } from './PhysicsManager';
import { SpatialBlockManager, SpatialBlock } from './SpatialBlockManager';
import { BillboardOverlay, PersonalityMode } from './BillboardOverlay';

export interface SceneRef {
  spawnOutputTile: (text: string) => void;
  triggerShatter: () => void;
  triggerRoast: (message?: string, title?: string) => void;
  resetPhysics: () => void;
  snapPrintToFor: () => void;
  setPersonalityMode: (mode: PersonalityMode) => void;
}

export interface SceneProps {
  state?: RuntimeState;
  spatialMode?: boolean;
  personalityMode?: PersonalityMode;
  onTileCountChange?: (count: number, max: number) => void;
  onBufferOverflow?: () => void;
  onSnapChange?: (isNested: boolean) => void;
  showClassicWorld?: boolean;
}

// ─── 3D Hand Reticle Controller ──────────────────────────────────────────────
function HandReticle({
  ndc,
  isPinching,
  pinchDistance,
}: {
  ndc: { x: number; y: number };
  isPinching: boolean;
  pinchDistance: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;

    // Unproject NDC coordinates to a 3D position in front of camera
    const v = new THREE.Vector3(ndc.x, ndc.y, 0.5);
    v.unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const targetPos = camera.position.clone().add(dir.multiplyScalar(10));

    groupRef.current.position.lerp(targetPos, 0.35);
    groupRef.current.quaternion.copy(camera.quaternion);

    if (ringRef.current) {
      const targetScale = isPinching ? 0.65 : 1.0;
      ringRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.2
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* Outer target ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.22, 0.28, 32]} />
        <meshBasicMaterial
          color={isPinching ? '#3ecf8e' : '#38bdf8'}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center cursor dot */}
      <mesh>
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial
          color={isPinching ? '#3ecf8e' : '#f59e0b'}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Subtle glowing halo */}
      <mesh>
        <ringGeometry args={[0.35, 0.38, 24]} />
        <meshBasicMaterial
          color={isPinching ? '#3ecf8e' : '#38bdf8'}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Gesture & Physics Arena Controller ──────────────────────────────────────
interface ArenaControllerProps {
  personalityMode: PersonalityMode;
  onTileCountChange?: (count: number, max: number) => void;
  onBufferOverflow?: () => void;
  onSnapChange?: (isNested: boolean) => void;
  sceneRefObj: React.MutableRefObject<SceneRef | null>;
}

function ArenaController({
  personalityMode,
  onTileCountChange,
  onBufferOverflow,
  onSnapChange,
  sceneRefObj,
}: ArenaControllerProps) {
  const { scene, camera, gl } = useThree();
  const physicsRef = useRef<PhysicsManager | null>(null);
  const blocksRef = useRef<SpatialBlockManager | null>(null);
  const billboardRef = useRef<BillboardOverlay | null>(null);

  const [handState, setHandState] = useState<{
    ndc: { x: number; y: number };
    isPinching: boolean;
    pinchDistance: number;
  }>({
    ndc: { x: 0, y: 0 },
    isPinching: false,
    pinchDistance: 1.0,
  });

  // Initialize Physics, Blocks, and Billboard
  useEffect(() => {
    // 1. Billboard Overlay
    const billboard = new BillboardOverlay();
    billboard.setMode(personalityMode);
    camera.add(billboard.mesh);
    scene.add(camera);
    billboardRef.current = billboard;

    // 2. Physics Manager
    const physics = new PhysicsManager({
      scene,
      onTileCountChange,
      onBufferOverflow: () => {
        billboard.show();
        onBufferOverflow?.();
      },
    });
    physicsRef.current = physics;

    // 3. Spatial Block Manager
    const blocks = new SpatialBlockManager({
      scene,
      camera,
      onSnapChange: (nested) => {
        onSnapChange?.(nested);
      },
    });
    blocksRef.current = blocks;

    // 4. Hand tracking subscriptions
    const unsubResults = handTracking.onResults((res: HandTrackingResults) => {
      setHandState({
        ndc: res.ndc,
        isPinching: res.isPinching,
        pinchDistance: res.pinchDistance,
      });
      blocks.updatePointer(res.ndc);
    });

    const unsubPinchStart = handTracking.onPinchStart((ndc) => {
      blocks.handlePinchStart(ndc);
    });

    const unsubPinchEnd = handTracking.onPinchEnd((ndc) => {
      blocks.handlePinchEnd(ndc);
    });

    // 5. Expose Imperative Controls
    sceneRefObj.current = {
      spawnOutputTile: (text: string) => {
        physics.spawnOutputTile(text);
      },
      triggerShatter: () => {
        physics.triggerShatterEvent();
        billboard.show();
      },
      triggerRoast: (message?: string, title?: string) => {
        billboard.show(message, title);
      },
      resetPhysics: () => {
        physics.reset();
      },
      snapPrintToFor: () => {
        blocks.snapPrintToFor();
      },
      setPersonalityMode: (mode: PersonalityMode) => {
        billboard.setMode(mode);
      },
    };

    return () => {
      unsubResults();
      unsubPinchStart();
      unsubPinchEnd();
      physics.dispose();
      blocks.clear();
      camera.remove(billboard.mesh);
      billboard.dispose();
      sceneRefObj.current = null;
    };
  }, [scene, camera, onTileCountChange, onBufferOverflow, onSnapChange]);

  // Update Personality Mode
  useEffect(() => {
    if (billboardRef.current) {
      billboardRef.current.setMode(personalityMode);
    }
  }, [personalityMode]);

  // Mouse / Pointer fallback on Canvas element
  useEffect(() => {
    const dom = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const ndc = { x, y };

      setHandState((prev) => ({ ...prev, ndc, isPinching: true }));
      handTracking.simulatePinchStart(ndc);
      blocksRef.current?.handlePinchStart(ndc);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const ndc = { x, y };

      setHandState((prev) => ({ ...prev, ndc }));
      handTracking.simulatePinchMove(ndc);
      blocksRef.current?.updatePointer(ndc);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const ndc = { x, y };

      setHandState((prev) => ({ ...prev, isPinching: false }));
      handTracking.simulatePinchEnd(ndc);
      blocksRef.current?.handlePinchEnd(ndc);
    };

    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('pointermove', handlePointerMove);
    dom.addEventListener('pointerup', handlePointerUp);

    return () => {
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('pointermove', handlePointerMove);
      dom.removeEventListener('pointerup', handlePointerUp);
    };
  }, [gl.domElement]);

  // Main Render & Physics Tick (Capped at 0.1s max step)
  useFrame((_, delta) => {
    if (physicsRef.current) {
      physicsRef.current.step(delta);
    }
    if (blocksRef.current) {
      blocksRef.current.update(delta);
    }
    if (billboardRef.current) {
      billboardRef.current.update(delta);
    }
  });

  return (
    <>
      <HandReticle
        ndc={handState.ndc}
        isPinching={handState.isPinching}
        pinchDistance={handState.pinchDistance}
      />

      {/* Floating 3D Zone Title for Blocks */}
      <Text
        position={[-5.8, 4.4, 0]}
        fontSize={0.4}
        color="#38bdf8"
        letterSpacing={0.1}
        anchorX="center"
      >
        SPATIAL CODE BLOCKS [PINCH & SNAP]
      </Text>

      {/* Floating 3D Zone Title for Output Bin */}
      <Text
        position={[6.5, 4.4, 0]}
        fontSize={0.4}
        color="#60a5fa"
        letterSpacing={0.1}
        anchorX="center"
      >
        ACRYLIC OUTPUT BIN [35 MAX]
      </Text>
    </>
  );
}

// ─── Helpers for Classic Python Runtime Visualizer ───────────────────────────
function fmt(v: Value): string {
  if (Array.isArray(v)) return `[${(v as Value[]).map(fmt).join(', ')}]`;
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

function Region({ title, position, size, children }: any) {
  return (
    <group position={position}>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[size[0], 0.2, size[1]]} />
        <meshStandardMaterial color="#050810" metalness={0.1} roughness={0.9} />
      </mesh>
      <lineSegments position={[0, -0.5, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(size[0], 0.2, size[1])]} />
        <lineBasicMaterial color="#1e2d3d" transparent opacity={0.6} />
      </lineSegments>
      <Text
        position={[0, -0.39, -size[1] / 2 + 1.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={1.2}
        color="#15202e"
        anchorX="center"
        letterSpacing={0.2}
      >
        {title}
      </Text>
      {children}
    </group>
  );
}

function VarCard({ name, value, x, y, z }: any) {
  const displayValue = fmt(value);
  return (
    <Float speed={1.2} rotationIntensity={0.03} floatIntensity={0.12}>
      <group position={[x, y, z]}>
        <mesh>
          <boxGeometry args={[3.0, 1.6, 0.22]} />
          <meshStandardMaterial color="#0f1822" metalness={0.3} roughness={0.6} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(3.0, 1.6, 0.22)]} />
          <lineBasicMaterial color="#1e2d3d" transparent opacity={0.8} />
        </lineSegments>
        <Text position={[0, 0.4, 0.15]} fontSize={0.22} color="#6b8aa8" anchorX="center" letterSpacing={0.08}>
          {name.toUpperCase()}
        </Text>
        <Text position={[0, -0.15, 0.15]} fontSize={displayValue.length > 8 ? 0.24 : 0.35} color="#3ecf8e" anchorX="center" maxWidth={2.8}>
          {displayValue}
        </Text>
      </group>
    </Float>
  );
}

function OutputPanel({ lines }: { lines: string[] }) {
  const height = 2 + lines.length * 0.5;
  return (
    <group position={[0, height / 2 + 0.5, 0]}>
      <mesh>
        <boxGeometry args={[6, height, 0.2]} />
        <meshStandardMaterial color="#0a1a0d" metalness={0.2} roughness={0.6} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(6, height, 0.2)]} />
        <lineBasicMaterial color="#3ecf8e" transparent opacity={0.6} />
      </lineSegments>
      <Text position={[0, height / 2 - 0.5, 0.12]} fontSize={0.3} color="#3ecf8e" anchorX="center" letterSpacing={0.1}>
        OUTPUT TERMINAL
      </Text>
      {lines.map((line, i) => (
        <Text key={i} position={[0, height / 2 - 1.2 - i * 0.5, 0.12]} fontSize={0.4} color="#e8edf3" anchorX="center">
          {line}
        </Text>
      ))}
    </group>
  );
}

// ─── Scene Root Component ───────────────────────────────────────────────────
const Scene = forwardRef<SceneRef, SceneProps>(function Scene(
  {
    state,
    spatialMode = false,
    personalityMode = 'quirky',
    onTileCountChange,
    onBufferOverflow,
    onSnapChange,
    showClassicWorld = false,
  },
  ref
) {
  const internalRef = useRef<SceneRef | null>(null);

  useImperativeHandle(ref, () => ({
    spawnOutputTile: (text: string) => internalRef.current?.spawnOutputTile(text),
    triggerShatter: () => internalRef.current?.triggerShatter(),
    triggerRoast: (msg?: string, title?: string) => internalRef.current?.triggerRoast(msg, title),
    resetPhysics: () => internalRef.current?.resetPhysics(),
    snapPrintToFor: () => internalRef.current?.snapPrintToFor(),
    setPersonalityMode: (mode: PersonalityMode) => internalRef.current?.setPersonalityMode(mode),
  }));

  const vars = state ? Object.entries(state.variables) : [];
  const scalarVars = vars.filter(([, v]) => !Array.isArray(v));

  return (
    <div className="scene" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 4, 12], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#03060d']} />
        <fog attach="fog" args={['#03060d', 15, 55]} />

        {/* Lighting setup */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[8, 16, 12]} intensity={1.8} castShadow />
        <pointLight position={[-8, 6, 2]} intensity={1.2} color="#38bdf8" />
        <pointLight position={[8, 6, 2]} intensity={1.2} color="#f59e0b" />
        <pointLight position={[0, 4, 8]} intensity={0.9} color="#3ecf8e" />

        {/* Floor Grid */}
        <gridHelper args={[60, 60, '#1e293b', '#0b111e']} position={[0, -0.6, 0]} />

        {/* GestureBlocks AR Controller (Physics, Sockets, Blocks, Billboard) */}
        <ArenaController
          personalityMode={personalityMode}
          onTileCountChange={onTileCountChange}
          onBufferOverflow={onBufferOverflow}
          onSnapChange={onSnapChange}
          sceneRefObj={internalRef}
        />

        {/* Optional Classic Python Runtime World */}
        {showClassicWorld && (
          <group position={[0, 0, -8]}>
            <Region title="MEMORY" position={[-8, 0, 0]} size={[8, 8]}>
              {scalarVars.map(([k, v], i) => (
                <VarCard key={k} name={k} value={v} x={-1.5 + (i % 2) * 3} y={1.5} z={-2 + Math.floor(i / 2) * 2.5} />
              ))}
            </Region>
            <Region title="OUTPUT" position={[8, 0, 0]} size={[8, 8]}>
              <OutputPanel lines={state?.output ?? []} />
            </Region>
          </group>
        )}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={4}
          maxDistance={30}
          dampingFactor={0.08}
          enableDamping={true}
          maxPolarAngle={Math.PI / 2 - 0.05} // Keep camera above floor
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
});

export default Scene;
