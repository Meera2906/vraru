export type Value = number | string | boolean | null | Value[];

export type EventType =
  | 'PROGRAM_START'
  | 'VARIABLE_CREATED'
  | 'VARIABLE_UPDATED'
  | 'ARRAY_CREATED'
  | 'LOOP_STARTED'
  | 'LOOP_ITERATION'
  | 'CONDITION_EVALUATED'
  | 'BRANCH_TAKEN'
  | 'FUNCTION_CALL'
  | 'FUNCTION_RETURN'
  | 'OUTPUT'
  | 'PROGRAM_END'
  | 'ERROR';

export interface RuntimeEvent {
  type: EventType;
  line: number;
  message: string;
  // Variable events
  name?: string;
  value?: Value;
  prevValue?: Value;
  // Condition events
  expression?: string;
  result?: boolean;
  // Loop events
  loopIndex?: number;
  loopTotal?: number;
  arrayName?: string;
  // Function events
  fnName?: string;
  fnArgs?: Value[];
}

export interface RuntimeState {
  step: number;
  line: number;
  variables: Record<string, Value>;
  output: string[];
  callStack: string[];
  event: RuntimeEvent;
  halted?: boolean;
}

export interface ProgramResult {
  states: RuntimeState[];
  error?: { line: number; message: string };
}
