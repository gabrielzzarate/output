import type { Part } from "@output/react";
import { tokenize } from "./samples";

const reasoning = `The user says the retry helper sometimes fires two retries at once. That smells like shared mutable state read across an await. I should read \`src/net/retry.ts\` first, then look at how \`state.backoff\` is read and written.`;

const answer = `Found it. \`retry()\` read \`state.backoff\`, awaited the sleep, and only then wrote the new value back, so two failures in the same tick both saw the old delay and the second retry fired almost at once.

I moved the read and the write into \`nextBackoff()\`, which runs synchronously before any \`await\`, so every failure claims its own slot. I also capped the delay and added jitter, since synchronised retries from many clients cause the same pile-up at a larger scale. The new concurrency test failed on the old code and passes now, along with the rest of the suite.`;

const oldRetry = `export async function retry<T>(fn: () => Promise<T>, state: RetryState): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const delay = state.backoff * 2;
    await sleep(delay);
    state.backoff = delay;
    return retry(fn, state);
  }
}`;

const newRetry = `function nextBackoff(state: RetryState): number {
  state.backoff = Math.min(state.backoff * 2, state.maxBackoff);
  return state.backoff + Math.random() * state.jitter;
}

export async function retry<T>(fn: () => Promise<T>, state: RetryState): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (++state.attempts > state.maxAttempts) throw error;
    await sleep(nextBackoff(state));
    return retry(fn, state);
  }
}`;

const testOutput = ` ✓ src/net/retry.test.ts (6 tests) 41ms
   ✓ retries with exponential backoff
   ✓ caps the delay at maxBackoff
   ✓ gives up after maxAttempts
   ✓ concurrent failures get increasing delays

 Test Files  1 passed (1)
      Tests  6 passed (6)`;

export const agentPrompt = "My retry helper sometimes fires two retries at once. Can you fix it?";

/** The finished turn, for showing without streaming. */
export function finalAgentParts(): Part[] {
  return [
    { type: "reasoning", id: "r", text: reasoning, state: "done", durationMs: 6400 },
    { type: "tool", id: "t1", name: "read_file", state: "done", input: { path: "src/net/retry.ts" }, output: oldRetry, durationMs: 120 },
    { type: "tool", id: "t2", name: "Edit", state: "done", input: { file_path: "src/net/retry.ts", old_string: oldRetry, new_string: newRetry }, output: "Applied 1 edit.", durationMs: 310 },
    { type: "tool", id: "t3", name: "bash", state: "done", input: { command: "pnpm vitest run src/net/retry.test.ts" }, output: testOutput, durationMs: 2840 },
    { type: "text", id: "a", text: answer, state: "done" },
  ];
}

/**
 * Plays the turn the way an agent streams it: thinking, tool calls that run
 * and finish, then the answer. Calls `emit` with the parts so far.
 */
export async function playAgentTurn(emit: (parts: Part[], streaming: boolean) => void, speed: number, signal: { cancelled: boolean }) {
  const final = finalAgentParts();
  const done: Part[] = [];
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const tokenDelay = 1000 / speed;

  const streamText = async (base: Part, text: string) => {
    const tokens = tokenize(text);
    for (let i = 1; i <= tokens.length; i += 2) {
      if (signal.cancelled) return;
      emit([...done, { ...base, text: tokens.slice(0, i).join(""), state: "streaming" } as Part], true);
      await wait(tokenDelay * 2);
    }
    // Every await above can outlast a Stop, so callers check again too.
  };

  await streamText(final[0]!, reasoning);
  if (signal.cancelled) return;
  done.push({ ...(final[0] as Part), durationMs: undefined } as Part);
  for (const tool of final.slice(1, 4)) {
    if (signal.cancelled) return;
    const t = tool as Extract<Part, { type: "tool" }>;
    emit([...done, { ...t, state: "running", output: undefined, durationMs: undefined }], true);
    await wait(Math.min(t.durationMs ?? 400, 1400) + 300);
    if (signal.cancelled) return;
    done.push({ ...t, durationMs: undefined });
    emit([...done], true);
    await wait(250);
  }
  if (signal.cancelled) return;
  await streamText(final[4]!, answer);
  if (signal.cancelled) return;
  done.push(final[4]!);
  emit([...done], false);
}
