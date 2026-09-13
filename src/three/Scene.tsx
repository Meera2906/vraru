import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Float, Environment, Line } from '@react-three/drei';
import { RuntimeState, Value, RuntimeEvent } from '../types/runtime';
import * as THREE from 'three';
import { useRef, useState, useEffect, useMemo } from 'react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: Value): string {
  if (Array.isArray(v)) return `[${(v as Value[]).map(fmt).join(', ')}]`;
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function isArrayValue(value: Value): value is Value[] {
  return Array.isArray(value);
}

// ─── Data Orb Animation ───────────────────────────────────────────────────────

function DataOrb({
  from,
  to,
  label,
  color,
  onComplete,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  label: string;
  color?: string;
  onComplete?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
  }, [from, to, label]);

  useFrame((_, delta) => {
    if (progress < 1) {
      setProgress((p) => Math.min(1, p + delta * 1.6));
    } else if (onComplete) {
      onComplete();
    }

    if (meshRef.current) {
      const x = lerp(from.x, to.x, progress);
      const z = lerp(from.z, to.z, progress);
      const baseY = lerp(from.y, to.y, progress);
      const arc = Math.sin(progress * Math.PI) * 1.5;
      meshRef.current.position.set(x, baseY + arc, z);
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  if (progress >= 1) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.25, 18, 18]} />
      <meshStandardMaterial color={color ?? '#4d9eff'} emissive={color ?? '#4d9eff'} emissiveIntensity={2.8} />
      <Text position={[0, 0.4, 0]} fontSize={0.22} color="#ffffff" anchorX="center">
        {label}
      </Text>
    </mesh>
  );
}

// ─── Variable Capsule ─────────────────────────────────────────────────────────

interface MemoryNodeProps {
  name: string;
  value: Value;
  position: [number, number, number];
  active: boolean;
}

function MemoryNode({ name, value, position, active }: MemoryNodeProps) {
  const displayValue = fmt(value);
  const valueColor =
    typeof value === 'number'
      ? '#fbbf24'
      : typeof value === 'boolean'
        ? value
          ? '#34d399'
          : '#f87171'
        : '#8bd3ff';

  return (
    <Float speed={1.1} rotationIntensity={0.04} floatIntensity={0.2}>
      <group position={position}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.9, 1, 1.3, 18]} />
          <meshStandardMaterial
            color={active ? '#13263d' : '#0c141d'}
            metalness={0.45}
            roughness={0.4}
            emissive={active ? '#4d9eff' : '#0d1b2a'}
            emissiveIntensity={active ? 1.1 : 0.25}
          />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <sphereGeometry args={[0.65, 18, 18]} />
          <meshStandardMaterial
            color={active ? '#1a3d62' : '#0d1b2a'}
            emissive={active ? '#4d9eff' : '#0d1b2a'}
            emissiveIntensity={active ? 1.6 : 0.3}
          />
        </mesh>
        <Text position={[0, 1.7, 0]} fontSize={0.18} color="#98abc0" anchorX="center" letterSpacing={0.05}>
          {name.toUpperCase()}
        </Text>
        <Text position={[0, 0.2, 0.7]} fontSize={displayValue.length > 6 ? 0.22 : 0.28} color={valueColor} anchorX="center">
          {displayValue}
        </Text>
      </group>
    </Float>
  );
}

// ─── Array View ───────────────────────────────────────────────────────────────

interface ArrayViewProps {
  name: string;
  values: Value[];
  activeIndex?: number;
  maxVar?: Value;
  position: [number, number, number];
}

function ArrayView({ name, values, activeIndex, maxVar, position }: ArrayViewProps) {
  const cellWidth = 1.4;
  const totalWidth = values.length * cellWidth;
  const startX = -totalWidth / 2 + cellWidth / 2;

  return (
    <group position={position}>
      <Text position={[0, 1.4, 0.1]} fontSize={0.24} color="#9bb1c8" anchorX="center" letterSpacing={0.06}>
        {name.toUpperCase()}
      </Text>
      <Line
        points={[
          [-totalWidth / 2 - 0.3, 0, 0],
          [totalWidth / 2 + 0.3, 0, 0],
        ]}
        color="#4f6c87"
        lineWidth={1}
        transparent
        opacity={0.7}
      />

      {values.map((v, i) => {
        const cx = startX + i * cellWidth;
        const isActive = i === activeIndex;
        const isMax = maxVar !== undefined && v === maxVar;
        const hoverY = isActive ? 0.9 : isMax ? 0.45 : 0;

        return (
          <group key={i} position={[cx, hoverY, 0]}>
            {isActive && (
              <mesh position={[0, 1.1, 0]}>
                <coneGeometry args={[0.18, 0.42, 14]} />
                <meshStandardMaterial color="#4d9eff" emissive="#4d9eff" emissiveIntensity={1.8} />
              </mesh>
            )}
            <mesh>
              <boxGeometry args={[1.05, 0.95, 0.45]} />
              <meshStandardMaterial
                color={isActive ? '#162038' : isMax ? '#1d1a06' : '#111d2b'}
                metalness={0.25}
                roughness={0.65}
                emissive={isActive ? '#123056' : isMax ? '#3b3200' : '#0a111a'}
                emissiveIntensity={isActive ? 1.2 : isMax ? 0.8 : 0.2}
              />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(1.05, 0.95, 0.45)]} />
              <lineBasicMaterial color={isActive ? '#4d9eff' : isMax ? '#fbbf24' : '#2d425b'} transparent opacity={0.9} />
            </lineSegments>
            <Text position={[0, 0.06, 0.26]} fontSize={0.26} color="#edf5ff" anchorX="center">
              {fmt(v)}
            </Text>
            <Text position={[0, -0.7, 0.12]} fontSize={0.15} color="#55708b" anchorX="center">
              {i}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

// ─── Control Flow Graph ───────────────────────────────────────────────────────

interface FlowNodeProps {
  label: string;
  position: [number, number, number];
  active?: boolean;
  accent?: string;
}

function FlowNode({ label, position, active = false, accent = '#4d9eff' }: FlowNodeProps) {
  return (
    <Float speed={1.3} rotationIntensity={0.05} floatIntensity={0.15}>
      <group position={position}>
        <mesh>
          <cylinderGeometry args={[1.2, 1.2, 0.4, 18]} />
          <meshStandardMaterial
            color={active ? '#112843' : '#0d151d'}
            metalness={0.5}
            roughness={0.45}
            emissive={active ? accent : '#0f1d2a'}
            emissiveIntensity={active ? 1.3 : 0.3}
          />
        </mesh>
        <Text position={[0, 0.75, 0]} fontSize={0.2} color="#dfeaf8" anchorX="center">
          {label}
        </Text>
      </group>
    </Float>
  );
}

function ConditionGate({
  expression,
  result,
  position,
}: {
  expression?: string;
  result?: boolean;
  position: [number, number, number];
}) {
  const gateColor = result ? '#34d399' : '#f87171';

  return (
    <group position={position}>
      <Text position={[0, 1.15, 0.1]} fontSize={0.22} color="#a7bfd9" anchorX="center">
        {expression ?? 'CONDITION'}
      </Text>
      <mesh position={[0, 0, 0]}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color="#0d1724" emissive={gateColor} emissiveIntensity={1.2} metalness={0.4} roughness={0.4} />
      </mesh>
      <Text position={[0, -0.7, 0.1]} fontSize={0.26} color={gateColor} anchorX="center">
        {result ? 'TRUE' : 'FALSE'}
      </Text>
      <Line
        points={[
          [-2.8, 0.2, 0],
          [-1.4, 0.2, 0],
        ]}
        color={result ? '#34d399' : '#4d9eff'}
        lineWidth={1.2}
      />
      <Line
        points={[
          [1.4, 0.2, 0],
          [2.8, 0.2, 0],
        ]}
        color={result ? '#f87171' : '#4d9eff'}
        lineWidth={1.2}
      />
    </group>
  );
}

// ─── Output Panel ─────────────────────────────────────────────────────────────

function OutputPanel({ lines }: { lines: string[] }) {
  const panelHeight = Math.max(1.8, 1.1 + lines.length * 0.38);

  return (
    <group position={[0, panelHeight / 2, 0]}>
      <mesh>
        <boxGeometry args={[5.6, panelHeight, 0.18]} />
        <meshStandardMaterial color="#0b1d16" metalness={0.25} roughness={0.7} emissive="#0d452d" emissiveIntensity={0.35} />
      </mesh>
      <Text position={[0, panelHeight / 2 - 0.25, 0.12]} fontSize={0.18} color="#8ef7c8" anchorX="center">
        OUTPUT
      </Text>
      {lines.map((line, i) => (
        <Text key={i} position={[0, panelHeight / 2 - 0.6 - i * 0.34, 0.12]} fontSize={0.18} color="#edf6ff" anchorX="center">
          {line}
        </Text>
      ))}
    </group>
  );
}

// ─── Camera Rig ───────────────────────────────────────────────────────────────

function CameraRig({ spatialMode, event }: { spatialMode: boolean; event?: RuntimeEvent }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 18, 24));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (spatialMode) {
      targetPos.current.set(0, 24, 30);
      targetLook.current.set(0, 1.5, 0);
      return;
    }

    const type = event?.type;
    if (!type) return;

    if (type.startsWith('VARIABLE_')) {
      targetPos.current.set(10, 7, 12);
      targetLook.current.set(10, 1, -2);
    } else if (type === 'ARRAY_CREATED' || type === 'LOOP_ITERATION') {
      targetPos.current.set(-10, 7, 12);
      targetLook.current.set(-10, 1, -2);
    } else if (type === 'CONDITION_EVALUATED' || type === 'BRANCH_TAKEN') {
      targetPos.current.set(0, 8, 15);
      targetLook.current.set(0, 4, 1);
    } else if (type === 'OUTPUT') {
      targetPos.current.set(0, 6, -8);
      targetLook.current.set(0, 0, -10);
    } else {
      targetPos.current.set(0, 18, 24);
      targetLook.current.set(0, 0, 0);
    }
  }, [spatialMode, event]);

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.05);
    currentLook.current.lerp(targetLook.current, 0.05);
    camera.lookAt(currentLook.current);
  });

  return null;
}

interface WorldProps {
  state?: RuntimeState;
  spatialMode: boolean;
  visualMode?: 'live' | 'flow' | 'memory' | 'data' | 'ast';
}

function World({ state, spatialMode, visualMode = 'live' }: WorldProps) {
  const vars = state ? Object.entries(state.variables) : [];
  const scalarVars = vars.filter(([, v]) => !isArrayValue(v));
  const arrayVars = vars.filter(([, v]) => isArrayValue(v));

  const ev = state?.event;
  const activeArrayName = ev?.arrayName;
  const activeIndex = ev?.type === 'LOOP_ITERATION' ? ev.loopIndex : undefined;
  const changedVarName = ev?.name;

  const memoryPositions = useMemo(
    () =>
      scalarVars.map(([,], idx) => {
        const x = 10 + (idx % 2) * 3;
        const y = 1.5 + Math.floor(idx / 2) * 1.7;
        const z = -3 + (idx % 2) * 2.5;
        return [x, y, z] as [number, number, number];
      }),
    [scalarVars]
  );

  const arrayPositions = useMemo(
    () =>
      arrayVars.map(([,], idx) => {
        const x = -11 + (idx % 2) * 0.5;
        const y = 1 + idx * 2.2;
        const z = -3 + (idx % 2) * 2.8;
        return [x, y, z] as [number, number, number];
      }),
    [arrayVars]
  );

  const arrayMap = arrayVars.reduce<Record<string, [number, number, number]>>((acc, [name], idx) => {
    acc[name] = arrayPositions[idx] ?? [-11, 1, -3];
    return acc;
  }, {});

  const memoryMap = scalarVars.reduce<Record<string, [number, number, number]>>((acc, [name], idx) => {
    acc[name] = memoryPositions[idx] ?? [10, 1.5, -3];
    return acc;
  }, {});

  const [transfer, setTransfer] = useState<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    label: string;
    color: string;
  } | null>(null);

  useEffect(() => {
    if (ev?.type === 'VARIABLE_UPDATED' && ev.name && ev.value !== undefined) {
      const from = new THREE.Vector3(0, 6, 3);
      const target = memoryMap[ev.name] ?? [10, 1.5, -3];
      setTransfer({
        from,
        to: new THREE.Vector3(target[0], target[1], target[2]),
        label: fmt(ev.value),
        color: '#4d9eff',
      });
    } else if (ev?.type === 'LOOP_ITERATION' && ev.arrayName && ev.name) {
      const target = memoryMap[ev.name] ?? [10, 1.5, -3];
      const origin = arrayMap[ev.arrayName] ?? [-11, 1, -3];
      setTransfer({
        from: new THREE.Vector3(origin[0], origin[1], origin[2]),
        to: new THREE.Vector3(target[0], target[1], target[2]),
        label: fmt(ev.value ?? 0),
        color: '#34d399',
      });
    }
  }, [ev, memoryMap, arrayMap]);

  const flowNodes = [
    { label: 'START', position: [-6, 5.5, 1] as [number, number, number], active: ev?.type === 'PROGRAM_START' || !ev },
    { label: 'ARRAY', position: [-3, 4.2, -1] as [number, number, number], active: ev?.type === 'ARRAY_CREATED' || ev?.type === 'LOOP_ITERATION', accent: '#8bd3ff' },
    { label: 'LOOP', position: [0, 5.2, 2] as [number, number, number], active: ev?.type === 'LOOP_STARTED' || ev?.type === 'LOOP_ITERATION', accent: '#34d399' },
    { label: 'COND', position: [3.8, 4.2, 1] as [number, number, number], active: ev?.type === 'CONDITION_EVALUATED' || ev?.type === 'BRANCH_TAKEN', accent: '#fbbf24' },
    { label: 'UPDATE', position: [7.2, 5.5, -1] as [number, number, number], active: ev?.type === 'VARIABLE_UPDATED', accent: '#4d9eff' },
    { label: 'OUT', position: [0, 1.2, -9] as [number, number, number], active: ev?.type === 'OUTPUT', accent: '#34d399' },
  ];

  const activeCursor = useMemo(() => {
    if (ev?.type === 'LOOP_ITERATION' && activeArrayName && activeIndex !== undefined) {
      const arrPos = arrayMap[activeArrayName] ?? [-11, 1, -3];
      const values = (arrayVars.find(([name]) => name === activeArrayName)?.[1] as Value[] | undefined) ?? [];
      const cellWidth = 1.4;
      const totalWidth = values.length * cellWidth;
      const startX = -totalWidth / 2 + cellWidth / 2;
      const cursorX = arrPos[0] + startX + activeIndex * cellWidth;
      return new THREE.Vector3(cursorX, 2.2, arrPos[2] + 0.6);
    }

    if (ev?.type === 'CONDITION_EVALUATED') {
      return new THREE.Vector3(4, 4, 1.5);
    }

    if (ev?.type === 'VARIABLE_UPDATED' && ev.name) {
      const position = memoryMap[ev.name] ?? [10, 1.5, -3];
      return new THREE.Vector3(position[0], position[1] + 1.4, position[2]);
    }

    if (ev?.type === 'OUTPUT') {
      return new THREE.Vector3(0, 1.6, -9);
    }

    return new THREE.Vector3(-6, 5.5, 1);
  }, [ev, activeArrayName, activeIndex, arrayMap, arrayVars, memoryMap]);

  const lines: [number, number, number][] = [
    [-6, 5.5, 1],
    [-3, 4.2, -1],
    [0, 5.2, 2],
    [3.8, 4.2, 1],
    [7.2, 5.5, -1],
    [0, 1.2, -9],
  ];

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 18, 12]} intensity={1.5} castShadow />
      <pointLight position={[-9, 6, -4]} intensity={0.8} color="#67b5ff" />
      <pointLight position={[9, 6, -4]} intensity={0.8} color="#fbbf24" />
      <pointLight position={[0, 7, 8]} intensity={0.6} color="#34d399" />

      <gridHelper args={[80, 80, '#1a2535', '#0a0f16']} position={[0, -0.6, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.59, 0]}>
        <circleGeometry args={[13, 64]} />
        <meshStandardMaterial color="#081018" transparent opacity={0.32} />
      </mesh>

      <CameraRig spatialMode={spatialMode} event={ev} />

      {transfer && (
        <DataOrb
          from={transfer.from}
          to={transfer.to}
          label={transfer.label}
          color={transfer.color}
          onComplete={() => setTransfer(null)}
        />
      )}

      <mesh position={[0, 3.4, 3.2]}>
        <torusGeometry args={[6.2, 0.08, 16, 120]} />
        <meshStandardMaterial color="#20364d" transparent opacity={0.5} emissive="#1d4c78" emissiveIntensity={0.35} />
      </mesh>

      {flowNodes.map((node, index) => (
        <FlowNode key={node.label + index} label={node.label} position={node.position} active={node.active} accent={node.accent} />
      ))}

      <Line
        points={lines.map((point) => point)}
        color={visualMode === 'flow' ? '#4d9eff' : '#375066'}
        lineWidth={1.2}
        transparent
        opacity={0.8}
      />

      {ev && (ev.type === 'CONDITION_EVALUATED' || ev.type === 'BRANCH_TAKEN') && (
        <ConditionGate expression={ev.expression} result={ev.result} position={[3.8, 0.8, 1]} />
      )}

      <group position={[0, 0, -3]}>
        {arrayVars.map(([name, value], idx) => (
          <ArrayView
            key={name}
            name={name}
            values={value as Value[]}
            activeIndex={activeArrayName === name ? activeIndex : undefined}
            maxVar={state?.variables.max_value}
            position={arrayPositions[idx] ?? [-11, 1, -3]}
          />
        ))}
      </group>

      <group position={[0, 0, 0]}>
        {scalarVars.map(([name, value], idx) => (
          <MemoryNode
            key={name}
            name={name}
            value={value}
            position={memoryPositions[idx] ?? [10, 1.5, -3]}
            active={name === changedVarName}
          />
        ))}
      </group>

      <mesh position={activeCursor.toArray() as [number, number, number]}>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#d3f0ff" emissive="#d3f0ff" emissiveIntensity={2.2} />
      </mesh>

      <group position={[0, 0, -10]}>
        <OutputPanel lines={state?.output ?? []} />
      </group>

      {visualMode !== 'flow' && (
        <Text position={[10.5, 5, -4.5]} fontSize={0.25} color="#8aa6bc" anchorX="left">
          {visualMode.toUpperCase()} MODE
        </Text>
      )}
    </>
  );
}

interface SceneProps {
  state?: RuntimeState;
  spatialMode?: boolean;
  visualMode?: 'live' | 'flow' | 'memory' | 'data' | 'ast';
}

export default function Scene({ state, spatialMode = false, visualMode = 'live' }: SceneProps) {
  return (
    <div className="scene">
      <Canvas camera={{ position: [0, 18, 24], fov: 45 }} shadows gl={{ antialias: true, alpha: false }}>
        <color attach="background" args={['#030508']} />
        <fog attach="fog" args={['#030508', 24, 70]} />
        <World state={state} spatialMode={spatialMode} visualMode={visualMode} />
        <OrbitControls enablePan enableZoom minDistance={6} maxDistance={50} dampingFactor={0.08} enableDamping />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
