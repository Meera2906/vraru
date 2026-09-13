import { useCallback, useEffect, useRef, useState } from 'react';
import { Interpreter } from '../interpreter/interpreter';
import { ProgramResult, RuntimeState } from '../types/runtime';

export function useExecutionEngine(code: string) {
  const [states, setStates] = useState<RuntimeState[]>([]);
  const [current, setCurrent] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<ProgramResult['error']>();
  const timer = useRef<number>();

  const run = useCallback(() => {
    const r = new Interpreter().run(code);
    setStates(r.states);
    setCurrent(0);
    setError(r.error);
    setRunning(true);
  }, [code]);

  const reset = useCallback(() => {
    setRunning(false);
    setCurrent(0);
    setStates([]);
    setError(undefined);
  }, []);

  const stepForward = useCallback(() => {
    setRunning(false);
    setCurrent((c) => Math.min(Math.max(0, states.length - 1), c + 1));
  }, [states.length]);

  const stepBack = useCallback(() => {
    setRunning(false);
    setCurrent((c) => Math.max(0, c - 1));
  }, []);

  const jumpTo = useCallback(
    (i: number) => {
      setRunning(false);
      setCurrent(Math.max(0, Math.min(states.length - 1, i)));
    },
    [states.length]
  );

  const restart = useCallback(() => {
    const r = new Interpreter().run(code);
    setStates(r.states);
    setCurrent(0);
    setError(r.error);
    setRunning(true);
  }, [code]);

  useEffect(() => {
    if (!running) return;
    if (current >= states.length - 1) {
      setRunning(false);
      return;
    }
    timer.current = window.setTimeout(() => setCurrent((c) => c + 1), 400 / speed);
    return () => window.clearTimeout(timer.current);
  }, [running, current, states.length, speed]);

  return {
    states,
    current,
    state: states[current],
    running,
    speed,
    setSpeed,
    error,
    run,
    pause: () => setRunning(false),
    stop: () => { setRunning(false); },
    reset,
    restart,
    stepForward,
    stepBack,
    jumpTo,
  };
}
