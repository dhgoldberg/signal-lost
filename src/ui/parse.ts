import type { Command, SubsystemName } from "../engine/types";

const aliases: Record<string, SubsystemName> = {
  antenna: "Antenna Array",
  ant: "Antenna Array",
  cooling: "Cooling Loop",
  cool: "Cooling Loop",
  beacon: "Navigation Beacon",
  nav: "Navigation Beacon",
  ai: "AI Core",
  core: "AI Core",
  docking: "Docking Control",
  dock: "Docking Control",
};

function parseSubsystem(token?: string): SubsystemName | undefined {
  if (!token) return undefined;
  const t = token.toLowerCase();
  return aliases[t];
}

export function parseCommand(input: string): Command | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "Empty command. Type 'help'." };

  const parts = raw.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts[1];

  switch (cmd) {
    case "help":
    case "?":
      return { kind: "help" };
    case "status":
    case "st":
      return { kind: "status" };
    case "scan":
      return { kind: "scan" };
    case "rest":
      return { kind: "rest" };
    case "override":
    case "ovr":
      return { kind: "override" };
    case "tx":
    case "transmit":
      return { kind: "tx" };
    case "repair": {
      const target = parseSubsystem(arg);
      if (!target) return { error: "Usage: repair <antenna|cooling|beacon|ai|docking>" };
      return { kind: "repair", target };
    }
    case "reroute":
    case "route": {
      const target = parseSubsystem(arg);
      if (!target) return { error: "Usage: reroute <antenna|cooling|beacon|ai|docking>" };
      return { kind: "reroute", target };
    }
    case "restart":
    case "new": {
      const seedStr = parts[1];
      const seed = seedStr && /^-?\d+$/.test(seedStr) ? Number(seedStr) : undefined;
      return { kind: "restart", seed };
    }
    default:
      return { error: `Unknown command '${cmd}'. Type 'help'.` };
  }
}
