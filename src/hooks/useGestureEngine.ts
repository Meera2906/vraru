import { useState, useRef, useCallback, useEffect } from 'react';
import { PersonalityMode } from '../three/BillboardOverlay';

export interface GestureEngineState {
  personalityMode: PersonalityMode;
  isNested: boolean;
  isRunningLoop: boolean;
  isInfiniteLoop: boolean;
  tileCount: number;
  maxCapacity: number;
  isShattered: boolean;
  loopSpeed: number; // spawns per second
}

export interface UseGestureEngineOptions {
  onSpawnTile?: (text: string) => void;
  onShatter?: () => void;
  onTriggerRoast?: (message?: string, title?: string) => void;
  onResetPhysics?: () => void;
  onSnapBlock?: () => void;
}

export function useGestureEngine(options?: UseGestureEngineOptions) {
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>('quirky');
  const [isNested, setIsNested] = useState(false);
  const [isRunningLoop, setIsRunningLoop] = useState(false);
  const [isInfiniteLoop, setIsInfiniteLoop] = useState(false);
  const [tileCount, setTileCount] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(35);
  const [isShattered, setIsShattered] = useState(false);
  const [loopSpeed, setLoopSpeed] = useState(4); // 4 blocks/sec default

  const loopTimerRef = useRef<any>(null);
  const iterationRef = useRef<number>(0);

  // Throttled loop tick (capped at 60 Hz, never blocks main UI thread)
  const tickLoop = useCallback(() => {
    iterationRef.current++;
    const idx = iterationRef.current;
    const samples = [
      `OUT: i = ${idx}`,
      `PRINT("🔥 Overflow #${idx}")`,
      `HEAP_ALLOC: 0x${(idx * 1337).toString(16).toUpperCase()}`,
      `val = ${idx * 10}`,
      `STREAM[${idx}]`,
      `TUMBLE_TILE_${idx}`,
    ];
    const text = samples[(idx - 1) % samples.length];

    if (options?.onSpawnTile) {
      options.onSpawnTile(text);
    }
  }, [options]);

  // Start execution loop
  const startLoop = useCallback((infinite: boolean = false) => {
    setIsRunningLoop(true);
    setIsInfiniteLoop(infinite);
  }, []);

  // Stop execution loop
  const stopLoop = useCallback(() => {
    setIsRunningLoop(false);
    setIsInfiniteLoop(false);
    if (loopTimerRef.current) {
      clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  // Timer runner
  useEffect(() => {
    if (!isRunningLoop) {
      if (loopTimerRef.current) {
        clearInterval(loopTimerRef.current);
        loopTimerRef.current = null;
      }
      return;
    }

    const intervalMs = Math.max(16.67, Math.floor(1000 / loopSpeed));
    loopTimerRef.current = setInterval(() => {
      tickLoop();
    }, intervalMs);

    return () => {
      if (loopTimerRef.current) {
        clearInterval(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };
  }, [isRunningLoop, loopSpeed, tickLoop]);

  // Automatic loop start when block is nested
  const handleSnapChange = useCallback(
    (nested: boolean) => {
      setIsNested(nested);
      if (nested) {
        // Automatically start loop execution when PRINT snaps into FOR
        startLoop(true);
      } else {
        stopLoop();
      }
    },
    [startLoop, stopLoop]
  );

  // Buffer overflow shatter event callback
  const handleBufferOverflow = useCallback(() => {
    setIsShattered(true);
    // Pause rapid infinite spawner so user can appreciate the chaos
    stopLoop();

    if (options?.onShatter) {
      options.onShatter();
    }
    if (options?.onTriggerRoast) {
      options.onTriggerRoast();
    }
  }, [options, stopLoop]);

  // Reset physics and tiles
  const resetAll = useCallback(() => {
    stopLoop();
    iterationRef.current = 0;
    setTileCount(0);
    setIsShattered(false);
    if (options?.onResetPhysics) {
      options.onResetPhysics();
    }
  }, [options, stopLoop]);

  // Toggle personality mode
  const togglePersonalityMode = useCallback(() => {
    setPersonalityMode((prev) => (prev === 'quirky' ? 'serious' : 'quirky'));
  }, []);

  return {
    personalityMode,
    setPersonalityMode,
    togglePersonalityMode,
    isNested,
    setIsNested,
    isRunningLoop,
    isInfiniteLoop,
    tileCount,
    setTileCount,
    maxCapacity,
    setMaxCapacity,
    isShattered,
    setIsShattered,
    loopSpeed,
    setLoopSpeed,
    startLoop,
    stopLoop,
    resetAll,
    handleSnapChange,
    handleBufferOverflow,
    spawnTileManual: tickLoop,
  };
}
