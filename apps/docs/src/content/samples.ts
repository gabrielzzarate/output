/** Recorded model answers the examples replay. */

export const skyAnswer = `Sunlight looks white, but it is a mixture of every visible wavelength. On its way through the atmosphere that light collides with nitrogen and oxygen molecules, which are far smaller than the wavelengths themselves. Particles that small scatter light through a process called **Rayleigh scattering**, and its strength depends very steeply on wavelength: it goes with the inverse fourth power, so blue light at about 450 nanometres is scattered roughly five and a half times more strongly than red light at 700.

At noon the sun is high and its light takes the shortest possible path through the air. The direct beam stays mostly white, while the blue that has been knocked sideways reaches your eye from every direction at once. That diffuse blue glow, arriving from the whole dome overhead, is what you perceive as the colour of the sky.

## Why not violet?

Violet light scatters even more than blue, so you might expect a violet sky. Three things work against it:

- The sun emits less violet than blue to begin with.
- Some violet is absorbed high in the atmosphere by ozone.
- Human eyes are much less sensitive to violet, and the mix of wavelengths that does arrive stimulates our cones in a way the brain reads as a slightly pale blue.

## Sunset

When the sun sits near the horizon, its light has to cross as much as forty times more atmosphere before it reaches you. Over that long path almost all of the blue is scattered out of the direct beam long before it arrives. What survives is the light that scatters least, the oranges and reds, and it is that light that colours the sun and the clouds it illuminates.

> Dust, smoke, and volcanic aerosols make sunsets more vivid still, because larger particles scatter in a different regime and can tint the whole sky.

The same physics explains why distant mountains look bluish and why the sky on Mars, whose fine dust scatters red light preferentially, turns blue only around the setting sun.`;

export const readingAnswer = `Comfortable reading is mostly about removing small frictions the reader never consciously notices. Each one costs a little attention, and over a long article those costs add up to fatigue. Most of them come down to a handful of decisions about size, measure, spacing, and the shape of each line.

## Measure

The measure is the length of a line. Somewhere between sixty and seventy-five characters is the long-standing recommendation, and it holds up well on screens. Lines much longer than that make it hard for the eye to find the start of the next line on the return sweep; lines much shorter break phrases apart and force constant, choppy returns. A good reading layout therefore sets a maximum width on its text column rather than letting paragraphs stretch across a wide monitor.

## Leading

Leading, the vertical distance between lines, should grow with the measure. Longer lines need more space between them so the eye can track back to the correct line. For body text on screens a line height of roughly one and a half to one and two thirds of the font size reads comfortably; headings, which are short and large, want much tighter leading so their lines hold together as a unit.

## Justification and hyphenation

Justified text gives a page a calm, even texture, which is why books have used it for centuries. Done carelessly it does the opposite. Browsers justify one line at a time, stretching whatever spaces happen to fall on that line, and the result is uneven gaps that line up vertically into distracting rivers of white. Typesetting systems such as TeX instead consider the whole paragraph at once, choosing the combination of line breaks that keeps spacing most uniform throughout, and they hyphenate long words when that produces a better paragraph. With that care, justified text is a genuine improvement; without it, ragged-right is the safer choice.

## Typeface

A good text face for long reading has a generous x-height, open counters, and spacing designed for running text rather than headlines. Optical sizes help a great deal: a variable font with an optical size axis can draw slightly sturdier, more loosely spaced letters at reading sizes and finer, tighter ones at display sizes, the way metal type was once cut separately for each size.

## Rhythm

Finally, consistent vertical rhythm ties everything together. When the space between paragraphs, around headings, and around code and quotations is drawn from a small, related set of values, the page feels organised before a single word is read. The reader stops noticing the layout altogether, which is exactly the point.`;

/** Splits text into chunks about the size of model tokens. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = /\s*[^\s]{1,5}|\s+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push(m[0]);
  return out;
}
