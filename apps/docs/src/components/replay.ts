import { useCallback, useEffect, useRef, useState } from "react";
import type { Part } from "@output/react";
import { tokenize } from "../content/samples";
import { finalAgentParts, playAgentTurn } from "../content/agent";

/** Replays a recorded answer at a given token rate, the way a model streams it. */
export function useReplay(full: string, tokensPerSecond = 70, { autoplay = false } = {}) {
  const [text, setText] = useState(autoplay ? "" : full);
  const [streaming, setStreaming] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const rate = useRef(tokensPerSecond);
  rate.current = tokensPerSecond;

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStreaming(false);
  }, []);

  const play = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    const tokens = tokenize(full);
    let i = 0;
    setText("");
    setStreaming(true);
    const tick = 1000 / 30;
    timer.current = setInterval(() => {
      const perTick = Math.max(1, Math.round((rate.current * tick) / 1000 + (Math.random() - 0.5) * 2));
      i = Math.min(tokens.length, i + perTick);
      setText(tokens.slice(0, i).join(""));
      if (i >= tokens.length) {
        clearInterval(timer.current!);
        timer.current = null;
        setStreaming(false);
      }
    }, tick);
  }, [full]);

  // Start in view, so the first thing a reader sees is the stream settling.
  const autoplayed = useRef(false);
  useEffect(() => {
    if (autoplay && !autoplayed.current) {
      autoplayed.current = true;
      play();
    }
  }, [autoplay, play]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  return { text, streaming, play, stop };
}

/** Replays the recorded agent turn: thinking, tool calls, then the answer. */
export function useAgentReplay(speed = 80) {
  const [parts, setParts] = useState<Part[]>(finalAgentParts);
  const [streaming, setStreaming] = useState(false);
  const token = useRef({ cancelled: false });

  const stop = useCallback(() => {
    token.current.cancelled = true;
    setStreaming(false);
  }, []);

  const play = useCallback(() => {
    token.current.cancelled = true;
    const t = { cancelled: false };
    token.current = t;
    setParts([]);
    setStreaming(true);
    playAgentTurn(
      (p, live) => {
        if (t.cancelled) return;
        setParts(p);
        setStreaming(live);
      },
      speed,
      t,
    ).finally(() => !t.cancelled && setStreaming(false));
  }, [speed]);

  useEffect(() => () => {
    token.current.cancelled = true;
  }, []);

  return { parts, streaming, play, stop };
}
