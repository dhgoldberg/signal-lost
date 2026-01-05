import type { SubsystemName, Quirk, Severity } from "./types";

export const SUBSYSTEM_POOL: SubsystemName[] = [
  "Antenna Array",
  "Cooling Loop",
  "Navigation Beacon",
  "AI Core",
  "Docking Control",
];

export const STATUS_ORDER: Severity[] = ["Nominal", "Degraded", "Failing"];

export const QUIRKS: Record<SubsystemName, Quirk[]> = {
  "Antenna Array": [
    { name: "Calibration drift", desc: "Repairs work once; repeat repairs are less effective unless scanned first." },
    { name: "Hairline feed crack", desc: "Emergency transmission has higher surge risk unless repaired." },
    { name: "Intermittent phase noise", desc: "Reroute to antenna is stronger but drains extra power." },
  ],
  "Cooling Loop": [
    { name: "Sensor misread", desc: "Repair restores more Integrity, but costs extra Focus unless scanned." },
    { name: "Pump cavitation", desc: "Events are harsher while Degraded/Failing." },
    { name: "Feedback coupling", desc: "If AI Core unstable, Cooling Loop may worsen each turn." },
  ],
  "Navigation Beacon": [
    { name: "Loose mounting", desc: "Integrity loss events hit harder unless repaired." },
    { name: "Timing jitter", desc: "Scan is more valuable; reveals impending fault." },
    { name: "Ghost pings", desc: "AI advice becomes unreliable if Beacon is Failing." },
  ],
  "AI Core": [
    { name: "Thermal feedback loop", desc: "AI becomes misleading if unstable for 2 turns." },
    { name: "Priority inversion", desc: "Override is stronger but increases Integrity risk." },
    { name: "Memory leak", desc: "Rest recovers less Focus until repaired." },
  ],
  "Docking Control": [
    { name: "Stuck actuator", desc: "Escape risk increases unless repaired." },
    { name: "Power bus noise", desc: "Reroutes cause bigger swings." },
    { name: "Miswired relay", desc: "Repairs can fail if not scanned first." },
  ],
};

export const EVENTS = [
  "Power surge",
  "False diagnostic",
  "External signal window",
  "Structural groan",
  "Coolant hiccup",
  "AI commentary",
] as const;

export const AI_LINES = [
  "“Engineer. Panic remains inefficient.”",
  "“I have updated my confidence interval: lower.”",
  "“Your choices exhibit… creativity.”",
  "“I cannot feel fear. I can simulate it, if helpful.”",
  "“If this ends poorly, I will file a complaint.”",
];
