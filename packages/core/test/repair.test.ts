import { describe, expect, it } from "vitest";
import { repairTail } from "../src/stream/repair";

describe("repairTail", () => {
  it.each([
    ["Some **bold", "Some **bold**"],
    ["Some *italic", "Some *italic*"],
    ["Some ~~gone", "Some ~~gone~~"],
    ["Call `fetch", "Call `fetch`"],
    ["Mixed **bold and *it", "Mixed **bold and *it***"],
    ["Ends with **", "Ends with "],
    ["See [the docs](https://exa", "See the docs"],
    ["See [the do", "See the do"],
    ["An image ![alt](http://x", "An image "],
    ["Done **bold** and *it*", "Done **bold** and *it*"],
    ["snake_case_name stays", "snake_case_name stays"],
    ["* a bullet", "* a bullet"],
    ["2 * 3 = 6", "2 * 3 = 6"],
    ["Code `a * b` is fine", "Code `a * b` is fine"],
  ])("%j becomes %j", (input, expected) => {
    expect(repairTail(input)).toBe(expected);
  });
});
