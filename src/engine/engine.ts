import type { Command, EngineOutput, GameState, Severity, Subsystem, SubsystemName } from "./types";
import { makeRng } from "./rng";
import { AI_LINES, EVENTS, QUIRKS, STATUS_ORDER, SUBSYSTEM_POOL } from "./data";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function worsen(s: Subsystem): Subsystem {
  if (s.status === "Nominal") return { ...s, status: "Degraded" };
  if (s.status === "Degraded") return { ...s, status: "Failing" };
  return s;
}

function improve(s: Subsystem): Subsystem {
  if (s.status === "Failing") return { ...s, status: "Degraded" };
  if (s.status === "Degraded") return { ...s, status: "Nominal" };
  return s;
}

function severityIndex(status: Severity) {
  return STATUS_ORDER.indexOf(status);
}

function aiLine(seed: number, turn: number) {
  const r = makeRng(seed ^ (turn * 2654435761));
  return r.pick(AI_LINES);
}

export function initGame(seed: number): { state: GameState; out: EngineOutput } {
  const rng = makeRng(seed);

  const mandatory: SubsystemName[] = ["Antenna Array", "AI Core"];
  const extra = SUBSYSTEM_POOL.filter((s) => !mandatory.includes(s));
  rng.shuffle(extra);
  const chosen = [...mandatory, ...extra.slice(0, rng.int(1, 3))];

  const subsystems = {} as Record<SubsystemName, Subsystem>;
  for (const name of chosen) {
    const q = rng.pick(QUIRKS[name]);
    const status: Severity =
      name === "Antenna Array" ? "Degraded" : rng.pick(["Nominal", "Degraded"]);
    subsystems[name] = {
      name,
      status,
      quirk: q,
      scanned: false,
      repairedOnce: false,
    };
  }

  const state: GameState = {
    seed,
    turn: 1,
    turnsLeft: 10,
    power: 55,
    integrity: 70,
    focus: 60,

    subsystems,
    subsystemList: chosen,

    externalWindow: false,
    externalWindowTurns: 0,
    transmitted: false,

    aiMisleadCounter: 0,
    ended: false,
  };

  const out: EngineOutput = {
    lines: [
      "==============================================================",
      " SIGNAL LOST: THE LAST RELAY",
      "==============================================================",
      "You are the last field engineer at Relay Station K-7.",
      "Restore stability long enough to transmit, then attempt escape.",
      "",
      "Type 'help' for commands.",
      "",
      renderStatus(state),
    ],
    prompt: "k7> ",
  };

  return { state: finalizeState(state), out };
}

function renderStatus(s: GameState): string {
  const parts: string[] = [];
  parts.push(`Turn ${s.turn} | Turns Left: ${s.turnsLeft}`);
  parts.push(`Power ${s.power} | Integrity ${s.integrity} | Focus ${s.focus}`);
  parts.push("Subsystems:");
  for (const name of s.subsystemList) {
    const ss = s.subsystems[name];
    parts.push(`  - ${ss.name}: ${ss.status}${ss.scanned ? " (scanned)" : ""}`);
  }
  if (s.externalWindow) {
    parts.push(
      `ALERT: EXTERNAL SIGNAL WINDOW OPEN (${s.externalWindowTurns} turn(s) remaining)`
    );
  }
  return parts.join("\n");
}

function checkEnd(s: GameState): GameState {
  if (s.ended) return s;

  let ending: string | undefined;

  if (s.power <= 0) ending = "LOSS: POWER DEPLETED — Station goes dark.";
  else if (s.integrity <= 0) ending = "LOSS: STATION FAILURE — Structural collapse.";
  else if (s.focus <= 0) ending = "LOSS: FOCUS LOST — You freeze, unable to act.";
  else if (s.turnsLeft <= 0 && !s.transmitted)
    ending = "LOSS: TIME EXPIRED — Relay fails before transmission.";
  else if (s.transmitted) {
    const docking = s.subsystems["Docking Control"];
    let risk = 0;
    if (docking && docking.status !== "Nominal") risk += 1;
    if (s.power < 10) risk += 1;
    if (s.integrity < 40) risk += 1;
    ending =
      risk >= 2
        ? "SUCCESS (IMPERFECT): Transmission sent, but escape is uncertain."
        : "SUCCESS: Transmission sent and escape sequence viable.";
  }

  if (ending) return { ...s, ended: true, endingText: ending };
  return s;
}

function finalizeState(s: GameState): GameState {
  return checkEnd({
    ...s,
    power: clamp(s.power),
    integrity: clamp(s.integrity),
    focus: clamp(s.focus),
    turnsLeft: Math.max(0, s.turnsLeft),
  });
}

function endOfTurnTick(s: GameState): { state: GameState; lines: string[] } {
  const rng = makeRng(s.seed ^ (s.turn * 1013904223));

  const lines: string[] = [];

  // Drift: degraded subsystems may worsen
  let subs = { ...s.subsystems };
  for (const name of s.subsystemList) {
    const ss = subs[name];
    if (ss.status !== "Nominal") {
      let p = 0.15 + 0.10 * severityIndex(ss.status);
      if (ss.name === "Cooling Loop" && ss.quirk.name === "Pump cavitation") p += 0.10;
      if (rng.next() < Math.min(0.85, p)) subs[name] = worsen(ss);
    }
  }

  // Feedback coupling: AI instability worsens Cooling Loop
  const ai = subs["AI Core"];
  const cool = subs["Cooling Loop"];
  if (
    ai &&
    cool &&
    cool.quirk.name === "Feedback coupling" &&
    ai.status !== "Nominal" &&
    rng.next() < 0.5
  ) {
    subs["Cooling Loop"] = worsen(cool);
  }

  // Random event chance
  const failingCount = s.subsystemList.filter((n) => subs[n].status === "Failing").length;
  let pEvent = 0.35 + 0.08 * failingCount;
  if (s.integrity < 50) pEvent += 0.10;
  if (s.power < 20) pEvent += 0.08;

  let power = s.power;
  let integrity = s.integrity;
  let focus = s.focus;
  let externalWindow = s.externalWindow;
  let externalWindowTurns = s.externalWindowTurns;

  if (rng.next() < Math.min(0.85, pEvent)) {
    const ev = rng.pick([...EVENTS]);
    switch (ev) {
      case "Power surge": {
        const loss = rng.int(4, 12);
        power -= loss;
        lines.push(`EVENT: Power surge. Power -${loss}.`);
        break;
      }
      case "False diagnostic": {
        const beacon = subs["Navigation Beacon"];
        const aiCore = subs["AI Core"];
        const relevant =
          (aiCore && aiCore.status !== "Nominal") ||
          (beacon && beacon.quirk.name === "Ghost pings" && beacon.status === "Failing");
        if (relevant) {
          focus -= 6;
          lines.push("EVENT: False diagnostic flood. Focus -6.");
        } else {
          lines.push("EVENT: Diagnostic anomaly detected; resolved automatically.");
        }
        break;
      }
      case "External signal window": {
        externalWindow = true;
        externalWindowTurns = 2;
        lines.push("EVENT: EXTERNAL SIGNAL WINDOW OPEN — limited duration.");
        break;
      }
      case "Structural groan": {
        let dmg = rng.int(3, 9);
        const beacon = subs["Navigation Beacon"];
        if (beacon && beacon.quirk.name === "Loose mounting" && beacon.status !== "Nominal") dmg += 3;
        integrity -= dmg;
        lines.push(`EVENT: Structural strain. Integrity -${dmg}.`);
        break;
      }
      case "Coolant hiccup": {
        const cl = subs["Cooling Loop"];
        if (cl && cl.status !== "Nominal") {
          const dmg = rng.int(4, 10);
          integrity -= dmg;
          lines.push(`EVENT: Cooling instability cascades. Integrity -${dmg}.`);
        } else {
          lines.push("EVENT: Cooling oscillation detected; contained.");
        }
        break;
      }
      case "AI commentary": {
        lines.push(`EVENT: AI says: ${aiLine(s.seed, s.turn)}`);
        break;
      }
    }
  }

  // External window countdown
  if (externalWindow) {
    externalWindowTurns -= 1;
    if (externalWindowTurns <= 0) {
      externalWindow = false;
      externalWindowTurns = 0;
      lines.push("The external signal window closes.");
    }
  }

  // AI misleading counter update
  let aiMisleadCounter = s.aiMisleadCounter;
  const ai2 = subs["AI Core"];
  if (ai2 && ai2.status !== "Nominal") aiMisleadCounter += 1;
  else aiMisleadCounter = 0;

  const next: GameState = finalizeState({
    ...s,
    subsystems: subs,
    power,
    integrity,
    focus,
    externalWindow,
    externalWindowTurns,
    aiMisleadCounter,
    turnsLeft: s.turnsLeft - 1,
    turn: s.turn + 1,
  });

  return { state: next, lines };
}

export function step(state: GameState, cmd: Command): { state: GameState; out: EngineOutput } {
  if (cmd.kind === "restart") {
    const seed = cmd.seed ?? Math.floor(Math.random() * 1_000_000_000);
    const { state: ns, out } = initGame(seed);
    return { state: ns, out };
  }

  if (state.ended) {
    return {
      state,
      out: {
        lines: ["Game has ended. Type 'restart' or 'restart <seed>' to play again."],
        prompt: "k7> ",
      },
    };
  }

  const lines: string[] = [];

  const rng = makeRng(state.seed ^ (state.turn * 1664525));

  let s = { ...state, subsystems: { ...state.subsystems } };

  const antenna = s.subsystems["Antenna Array"];
  const ai = s.subsystems["AI Core"];

  const apply = (patch: Partial<GameState>) => {
    s = { ...s, ...patch };
  };

  const setSubsystem = (name: SubsystemName, ss: Subsystem) => {
    s.subsystems = { ...s.subsystems, [name]: ss };
  };

  const needSubsystem = (name: SubsystemName) => s.subsystems[name];

  if (cmd.kind === "help") {
    return {
      state: s,
      out: {
        lines: [
          "Commands:",
          "  scan",
          "  repair <subsystem>         e.g. repair antenna | repair cooling | repair ai",
          "  reroute <subsystem>        e.g. reroute antenna",
          "  rest",
          "  override",
          "  tx                         (only during external signal window)",
          "  status",
          "  restart [seed]",
          "",
          "Subsystem keywords: antenna, cooling, beacon, ai, docking",
        ],
        prompt: "k7> ",
      },
    };
  }

  if (cmd.kind === "status") {
    return { state: s, out: { lines: [renderStatus(s)], prompt: "k7> " } };
  }

  if (cmd.kind === "scan") {
    const costPower = 5;
    const costFocus = 2;
    if (s.power < costPower) {
      lines.push("Scan aborted: insufficient power.");
    } else {
      apply({ power: s.power - costPower, focus: s.focus - costFocus });

      const list = [...s.subsystemList];
      rng.shuffle(list);
      const revealCount = rng.int(1, Math.min(2, list.length));
      lines.push("You initiate a diagnostic sweep.");
      for (const name of list.slice(0, revealCount)) {
        const ss = needSubsystem(name);
        setSubsystem(name, { ...ss, scanned: true });
        lines.push(`- ${name}: quirk detected — ${ss.quirk.name}. (${ss.quirk.desc})`);
      }

      const aiCore = s.subsystems["AI Core"];
      if (aiCore && aiCore.status !== "Nominal") apply({ aiMisleadCounter: s.aiMisleadCounter + 1 });
      else apply({ aiMisleadCounter: 0 });

      if (s.aiMisleadCounter >= 2)
        lines.push("Hidden warning: AI Core instability may produce incorrect recommendations.");
      lines.push(aiLine(s.seed, s.turn));
    }
  }

  if (cmd.kind === "repair") {
    const target = needSubsystem(cmd.target);
    const sev = severityIndex(target.status);
    let costPower = 8 + 2 * sev;
    let costFocus = 4 + 2 * sev;

    if (target.name === "Cooling Loop" && target.quirk.name === "Sensor misread" && !target.scanned) {
      costFocus += 2;
    }

    if (s.power < costPower) lines.push("Repair aborted: insufficient power.");
    else if (s.focus < costFocus) lines.push("Repair aborted: insufficient focus.");
    else {
      apply({ power: s.power - costPower, focus: s.focus - costFocus });

      let success = 0.75 - 0.10 * sev;
      if (target.scanned) success += 0.10;

      const aiMisleading = s.aiMisleadCounter >= 2;
      if (aiMisleading && target.name !== "AI Core") success -= 0.15;

      if (target.name === "Antenna Array" && target.quirk.name === "Calibration drift") {
        if (target.repairedOnce && !target.scanned) success -= 0.25;
      }
      if (target.name === "Docking Control" && target.quirk.name === "Miswired relay" && !target.scanned) {
        success -= 0.15;
      }

      success = clamp(success * 100, 5, 95) / 100;

      if (rng.next() < success) {
        const prev = target.status;
        let ns = improve(target);
        ns = { ...ns, repairedOnce: true };
        setSubsystem(cmd.target, ns);

        const integrityGain = 3 + (target.name === "Cooling Loop" ? 2 : 0);
        apply({ integrity: s.integrity + integrityGain });

        lines.push(`You repair ${cmd.target}. Status ${prev} -> ${ns.status}. Integrity +${integrityGain}.`);
      } else {
        const integrityLoss = 6 + 2 * sev;
        apply({ integrity: s.integrity - integrityLoss });

        let ns = target;
        if (rng.next() < 0.5) ns = worsen(ns);
        setSubsystem(cmd.target, ns);

        lines.push(
          `Repair attempt on ${cmd.target} fails. Integrity -${integrityLoss}. ${cmd.target} now ${ns.status}.`
        );
      }
    }
  }

  if (cmd.kind === "reroute") {
    const target = needSubsystem(cmd.target);
    const costPower = 6;
    if (s.power < costPower) {
      lines.push("Reroute aborted: insufficient power.");
    } else {
      apply({ power: s.power - costPower });

      let improvedFlag = false;
      if (target.status !== "Nominal" && rng.next() < 0.75) {
        const ns = improve(target);
        setSubsystem(cmd.target, ns);
        improvedFlag = true;
      }

      if (target.name === "Antenna Array" && target.quirk.name === "Intermittent phase noise") {
        apply({ power: s.power - 4 });
        lines.push("(Extra power drain -4 due to phase noise.)");
      }

      const others = s.subsystemList.filter((n) => n !== cmd.target);
      if (others.length > 0) {
        const side = rng.pick(others);
        if (rng.next() < 0.6) {
          setSubsystem(side, worsen(needSubsystem(side)));
          lines.push(
            `You reroute power to ${cmd.target}. ${
              improvedFlag ? "It stabilizes slightly." : "It resists stabilization."
            } Side effect: ${side} worsens.`
          );
        } else {
          apply({ integrity: s.integrity - 4 });
          lines.push(
            `You reroute power to ${cmd.target}. ${
              improvedFlag ? "It stabilizes slightly." : "It resists stabilization."
            } Side effect: structural strain (Integrity -4).`
          );
        }
      } else {
        lines.push(
          `You reroute power to ${cmd.target}. ${improvedFlag ? "It stabilizes slightly." : "No measurable improvement."}`
        );
      }
    }
  }

  if (cmd.kind === "rest") {
    let recover = 12;
    if (ai && ai.quirk.name === "Memory leak" && ai.status !== "Nominal") recover = 7;
    apply({ focus: s.focus + recover, integrity: s.integrity - 1 });
    lines.push(`You rest briefly. Focus +${recover}. Integrity -1.`);
  }

  if (cmd.kind === "override") {
    const costPower = 10;
    const costFocus = 8;
    if (s.power < costPower || s.focus < costFocus) {
      lines.push("Override aborted: insufficient resources.");
    } else {
      apply({ power: s.power - costPower, focus: s.focus - costFocus });

      const targetName = rng.pick([...s.subsystemList]);
      const target = needSubsystem(targetName);

      const stronger = ai && ai.quirk.name === "Priority inversion";
      const p = stronger ? 0.6 : 0.5;

      if (rng.next() < p) {
        const prev = target.status;
        let ns = target;
        if (ns.status !== "Nominal") ns = improve(ns);
        if (ns.status !== "Nominal") ns = improve(ns);
        setSubsystem(targetName, ns);
        apply({ integrity: s.integrity + (stronger ? 6 : 4) });
        lines.push(`Override succeeds. ${targetName} ${prev} -> ${ns.status}. Integrity +${stronger ? 6 : 4}.`);
      } else {
        const prev = target.status;
        const ns = worsen(worsen(target));
        setSubsystem(targetName, ns);
        const dmg = stronger ? 12 : 10;
        apply({ integrity: s.integrity - dmg });
        lines.push(`Override backfires. ${targetName} ${prev} -> ${ns.status}. Integrity -${dmg}.`);
      }
    }
  }

  if (cmd.kind === "tx") {
    if (!s.externalWindow) {
      lines.push("Transmission attempt fails: no external signal window.");
    } else {
      const cost = 14;
      if (s.power < cost) {
        lines.push("Transmission aborted: insufficient power.");
      } else {
        apply({ power: s.power - cost });

        const ant = antenna;
        const sev = severityIndex(ant.status);

        let success = 0.8 - 0.2 * sev;
        if (ant.scanned) success += 0.08;
        if (ant.quirk.name === "Hairline feed crack" && ant.status !== "Nominal") success -= 0.1;
        success = clamp(success * 100, 5, 95) / 100;

        if (rng.next() < success) {
          apply({ transmitted: true });

          const surge = ant.status !== "Nominal" ? rng.int(6, 16) : rng.int(2, 8);
          apply({ power: s.power - surge });

          const newAnt =
            ant.status === "Nominal"
              ? ({ ...ant, status: "Degraded" } as const)
              : ({ ...ant, status: "Failing" } as const);
          setSubsystem("Antenna Array", newAnt);

          lines.push("You force an emergency transmission.");
          lines.push("For one second, silence—then: “Relay K-7, signal received.”");
          lines.push(`Power surge -${surge}. Antenna now ${newAnt.status}.`);
        } else {
          const dmg = 10 + 4 * sev;
          apply({ integrity: s.integrity - dmg, focus: s.focus - 6 });
          setSubsystem("Antenna Array", worsen(ant));
          lines.push("You attempt an emergency transmission, but the carrier collapses.");
          lines.push(`Integrity -${dmg}, Focus -6. Antenna now ${s.subsystems["Antenna Array"].status}.`);
        }
      }
    }
  }

  s = finalizeState(s);

  if (!s.ended) {
    const tick = endOfTurnTick(s);
    s = tick.state;
    lines.push(...tick.lines);
  }

  s = finalizeState(s);

  if (s.ended && s.endingText) {
    lines.push("");
    lines.push("==============================================================");
    lines.push(s.endingText);
    lines.push("==============================================================");
  }

  lines.push("");
  lines.push(renderStatus(s));

  return { state: s, out: { lines, prompt: "k7> " } };
}
