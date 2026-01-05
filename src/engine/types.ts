export type Severity = "Nominal" | "Degraded" | "Failing";

export type SubsystemName =
  | "Antenna Array"
  | "Cooling Loop"
  | "Navigation Beacon"
  | "AI Core"
  | "Docking Control";

export type Quirk = { name: string; desc: string };

export type Subsystem = {
  name: SubsystemName;
  status: Severity;
  quirk: Quirk;
  scanned: boolean;
  repairedOnce: boolean;
};

export type GameState = {
  seed: number;
  turn: number;
  turnsLeft: number;
  power: number;
  integrity: number;
  focus: number;

  subsystems: Record<SubsystemName, Subsystem>;
  subsystemList: SubsystemName[];

  externalWindow: boolean;
  externalWindowTurns: number;
  transmitted: boolean;

  aiMisleadCounter: number;
  ended: boolean;
  endingText?: string;
};

export type EngineOutput = {
  lines: string[];
  prompt?: string;
};

export type Command =
  | { kind: "scan" }
  | { kind: "repair"; target: SubsystemName }
  | { kind: "reroute"; target: SubsystemName }
  | { kind: "rest" }
  | { kind: "override" }
  | { kind: "tx" }
  | { kind: "status" }
  | { kind: "help" }
  | { kind: "restart"; seed?: number };
