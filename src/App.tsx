import { useEffect, useMemo, useRef, useState } from "react";
import "./terminal.css";
import { initGame, step } from "./engine/engine";
import type { GameState } from "./engine/types";
import { parseCommand } from "./ui/parse";

type Line = { id: string; text: string };

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const initialSeed = useMemo(() => {
    // allow URL param ?seed=123
    const url = new URL(window.location.href);
    const s = url.searchParams.get("seed");
    return s && /^-?\d+$/.test(s) ? Number(s) : Math.floor(Math.random() * 1_000_000_000);
  }, []);

  const [{ state, buffer }, setSession] = useState<{
    state: GameState;
    buffer: Line[];
  }>(() => {
    const { state, out } = initGame(initialSeed);
    return {
      state,
      buffer: out.lines.map((t) => ({ id: makeId(), text: t })),
    };
  });

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number>(-1);

  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [buffer.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function append(lines: string[]) {
    setSession((prev) => ({
      ...prev,
      buffer: [...prev.buffer, ...lines.map((t) => ({ id: makeId(), text: t }))],
    }));
  }

  function runCommand(raw: string) {
    append([`k7> ${raw}`]);

    const parsed = parseCommand(raw);
    if ("error" in parsed) {
      append([`ERR: ${parsed.error}`]);
      return;
    }

    const res = step(state, parsed);
    setSession((prev) => ({
      state: res.state,
      buffer: [...prev.buffer, ...res.out.lines.map((t) => ({ id: makeId(), text: t }))],
    }));
  }

  function onSubmit() {
    const raw = input.trimEnd();
    if (!raw.trim()) return;

    setHistory((h) => [raw, ...h].slice(0, 100));
    setHistIdx(-1);

    setInput("");
    runCommand(raw);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistIdx((idx) => {
        const next = Math.min(idx + 1, history.length - 1);
        if (next >= 0) setInput(history[next]);
        return next;
      });
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistIdx((idx) => {
        const next = Math.max(idx - 1, -1);
        if (next === -1) setInput("");
        else setInput(history[next]);
        return next;
      });
      return;
    }
  }

  return (
    <div className="page">
      <div className="terminal" onClick={() => inputRef.current?.focus()}>
        <div className="screen" aria-label="terminal output">
          {buffer.map((l) => (
            <pre className="line" key={l.id}>
              {l.text}
            </pre>
          ))}
          <div ref={endRef} />
        </div>

        <div className="promptRow">
          <span className="prompt">k7&gt;</span>
          <input
            ref={inputRef}
            className="promptInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="command input"
          />
        </div>

        <div className="hint">
          Try: <code>scan</code>, <code>repair antenna</code>, <code>reroute ai</code>, <code>tx</code>,{" "}
          <code>status</code>, <code>restart 123</code>
        </div>
      </div>
    </div>
  );
}
