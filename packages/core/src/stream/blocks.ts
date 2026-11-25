import { Lexer, type Token, type MarkedOptions } from "marked";

export interface Block {
  /** Stable id: blocks are numbered in the order they appear. */
  id: number;
  /** The markdown token type (paragraph, heading, code, list, ...). */
  type: string;
  /** The block's markdown source. */
  raw: string;
  token: Token;
  /** Settled blocks are final and never change again. */
  settled: boolean;
}

export interface BlockUpdate {
  /** Blocks that became final in this update, in order. */
  settled: Block[];
  /** The block still being written, if any. */
  live: Block | null;
}

/**
 * Splits a growing markdown stream into blocks.
 *
 * Every block except the last is settled: it will never change, so it can
 * be rendered once and typeset at leisure. Only the text after the last
 * settled block is re-lexed on each update, so the cost of an update stays
 * flat however long the answer gets.
 */
export class BlockStream {
  private text = "";
  private offset = 0;
  private nextId = 0;
  private done = false;
  private readonly options: MarkedOptions;

  constructor(options: MarkedOptions = { gfm: true }) {
    this.options = options;
  }

  get source(): string {
    return this.text;
  }

  get ended(): boolean {
    return this.done;
  }

  append(chunk: string): BlockUpdate {
    if (this.done) throw new Error("Cannot append to a stream that has ended.");
    this.text += chunk.replace(/\r\n?/g, "\n");
    return this.update();
  }

  end(): BlockUpdate {
    this.done = true;
    return this.update();
  }

  private update(): BlockUpdate {
    const tail = this.text.slice(this.offset);
    const tokens = new Lexer(this.options).lex(tail);
    const content = tokens.filter((t) => t.type !== "space" && t.type !== "def");
    const settleCount = this.done ? content.length : Math.max(0, content.length - 1);

    const settled: Block[] = [];
    let cursor = 0;
    let consumed = 0;
    let settledSoFar = 0;
    for (const token of tokens) {
      const at = tail.indexOf(token.raw, cursor);
      const start = at === -1 ? cursor : at;
      const end = start + token.raw.length;
      if (token.type === "space" || token.type === "def") {
        cursor = end;
        if (settledSoFar > 0 && settledSoFar <= settleCount) consumed = end;
        continue;
      }
      if (settledSoFar >= settleCount) break;
      settled.push({ id: this.nextId++, type: token.type, raw: token.raw, token, settled: true });
      settledSoFar++;
      cursor = end;
      consumed = end;
    }
    this.offset += consumed;

    let live: Block | null = null;
    if (!this.done) {
      const last = content[content.length - 1];
      if (last && settleCount < content.length) {
        live = { id: this.nextId, type: last.type, raw: last.raw, token: last, settled: false };
      }
    }
    return { settled, live };
  }
}
