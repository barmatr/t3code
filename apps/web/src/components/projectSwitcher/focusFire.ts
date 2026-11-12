/**
 * The Project focus card's fire: a smooth noise field scrolled upward and shaped against the card's
 * contour, so the tongues stay attached to the border and visibly climb. Each frame is a function
 * of the elapsed time alone, which keeps the pace the same at any refresh rate.
 */

const DURATION_SECONDS = 1.4;
/** One heat cell covers this many CSS pixels; drawing it larger smooths it. */
const CELL_SIZE = 1.5;

interface FireReach {
  readonly side: number;
  readonly top: number;
  readonly bottom: number;
}

export interface FireOptions {
  /** Corner radius of the element the fire wraps, in CSS pixels. */
  readonly radius: number;
  /** How far the flames reach from the border, in CSS pixels. */
  readonly reach: FireReach;
  /** Width of the element's border, which sits outside the box absolute children start from. */
  readonly border: number;
  /** Burns until stopped instead of one burst. */
  readonly continuous: boolean;
}

/** The Project focus card's burst. */
const FOCUS_CARD_FIRE: FireOptions = {
  radius: 12,
  reach: { side: 15, top: 30, bottom: 11 },
  border: 1,
  continuous: false,
};

function bleedOf(reach: FireReach): FireReach {
  return { side: reach.side + 3, top: reach.top + 4, bottom: reach.bottom + 3 };
}

/** Heat to color: indigo at the tips, blue in the body, white at the core. */
const HEAT_STOPS: ReadonlyArray<readonly [heat: number, ...rgba: number[]]> = [
  [0, 49, 46, 129, 0],
  [0.08, 55, 48, 163, 70],
  [0.26, 67, 56, 202, 190],
  [0.48, 59, 130, 246, 240],
  [0.72, 125, 211, 252, 255],
  [0.95, 255, 255, 255, 255],
  [1, 255, 255, 255, 255],
];

function buildPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray(256 * 4);
  for (let level = 0; level < 256; level++) {
    const heat = level / 255;
    const upper = Math.max(
      1,
      HEAT_STOPS.findIndex(([stop]) => heat <= stop),
    );
    const from = HEAT_STOPS[upper - 1]!;
    const to = HEAT_STOPS[upper]!;
    const mix = (heat - from[0]) / (to[0] - from[0]);
    for (let channel = 1; channel <= 4; channel++) {
      const start = from[channel]!;
      palette[level * 4 + channel - 1] = start + (to[channel]! - start) * mix;
    }
  }
  return palette;
}

const PALETTE = buildPalette();

const LATTICE_SIZE = 256;
const LATTICE_MASK = LATTICE_SIZE - 1;
const LATTICE = Float32Array.from({ length: LATTICE_SIZE * LATTICE_SIZE }, Math.random);

function noise(x: number, y: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fractionX = x - cellX;
  const fractionY = y - cellY;
  const easedX = fractionX * fractionX * (3 - 2 * fractionX);
  const easedY = fractionY * fractionY * (3 - 2 * fractionY);
  const x0 = cellX & LATTICE_MASK;
  const x1 = (cellX + 1) & LATTICE_MASK;
  const y0 = (cellY & LATTICE_MASK) * LATTICE_SIZE;
  const y1 = ((cellY + 1) & LATTICE_MASK) * LATTICE_SIZE;
  const topLeft = LATTICE[y0 + x0]!;
  const bottomLeft = LATTICE[y1 + x0]!;
  const top = topLeft + (LATTICE[y0 + x1]! - topLeft) * easedX;
  const bottom = bottomLeft + (LATTICE[y1 + x1]! - bottomLeft) * easedX;
  return top + (bottom - top) * easedY;
}

/** The fire catches at once, overshoots a little, holds, then sinks back against the border. */
function flameHeight(progress: number): number {
  if (progress < 0.08) return 1.18 * (1 - (1 - progress / 0.08) ** 2);
  if (progress < 0.21) return 1.18 - 0.18 * ((progress - 0.08) / 0.13);
  if (progress < 0.7) return 1;
  if (progress < 0.975) return 1 - ((progress - 0.7) / 0.275) ** 1.5;
  return 0;
}

/** Cells the fire can reach, with their distance to the border; the card's inside stays untouched. */
function reachableCells(
  cardWidth: number,
  cardHeight: number,
  cols: number,
  rows: number,
  { radius, reach: maxReach }: FireOptions,
) {
  const bleed = bleedOf(maxReach);
  const centerX = bleed.side + cardWidth / 2;
  const centerY = bleed.top + cardHeight / 2;
  const distanceToBorder = (x: number, y: number) => {
    const dx = Math.abs(x - centerX) - (cardWidth / 2 - radius);
    const dy = Math.abs(y - centerY) - (cardHeight / 2 - radius);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
  };
  const cells: Array<{ index: number; x: number; y: number; distance: number; reach: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * CELL_SIZE;
      const y = (row + 0.5) * CELL_SIZE;
      const distance = distanceToBorder(x, y);
      if (distance < -1.2) continue;
      // Tall above the card, shorter on its sides and shortest below it.
      const outwardY = distanceToBorder(x, y + 0.5) - distanceToBorder(x, y - 0.5);
      const reach =
        maxReach.side +
        (maxReach.top - maxReach.side) * Math.max(0, -outwardY) -
        (maxReach.side - maxReach.bottom) * Math.max(0, outwardY);
      if (distance > reach) continue;
      cells.push({ index: row * cols + col, x, y, distance: Math.max(0, distance), reach });
    }
  }
  return cells;
}

/**
 * Burns once on a canvas placed inside the card, calls `onBurnedOut` at the end, and returns a
 * function that stops the fire early.
 */
export function burnFocusFire(canvas: HTMLCanvasElement, onBurnedOut: () => void): () => void {
  return burnFire(canvas, FOCUS_CARD_FIRE, onBurnedOut);
}

/**
 * Burns on a canvas placed inside the element it wraps, once or until stopped. Returns a function
 * that stops the fire; `onBurnedOut` runs when a burst ends on its own.
 */
export function burnFire(
  canvas: HTMLCanvasElement,
  options: FireOptions,
  onBurnedOut: () => void = () => {},
): () => void {
  const bleed = bleedOf(options.reach);
  const card = canvas.parentElement;
  const buffer = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const bufferContext = buffer.getContext("2d");
  if (!card || !context || !bufferContext) {
    onBurnedOut();
    return () => {};
  }

  const cssWidth = card.offsetWidth + 2 * bleed.side;
  const cssHeight = card.offsetHeight + bleed.top + bleed.bottom;
  const scale = window.devicePixelRatio || 1;
  canvas.width = cssWidth * scale;
  canvas.height = cssHeight * scale;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  // A border sits outside the box absolute children are placed from.
  canvas.style.left = `${-bleed.side - options.border}px`;
  canvas.style.top = `${-bleed.top - options.border}px`;

  buffer.width = Math.ceil(cssWidth / CELL_SIZE);
  buffer.height = Math.ceil(cssHeight / CELL_SIZE);
  const image = bufferContext.createImageData(buffer.width, buffer.height);
  const cells = reachableCells(
    card.offsetWidth,
    card.offsetHeight,
    buffer.width,
    buffer.height,
    options,
  );
  // Each burn reads another part of the noise, so no two look the same.
  const seedX = Math.random() * LATTICE_SIZE;
  const seedY = Math.random() * LATTICE_SIZE;

  const paint = (seconds: number) => {
    const height = options.continuous ? 1 : flameHeight(seconds / DURATION_SECONDS);
    const fade = Math.min(1, height * 4);
    const pixels = image.data;
    pixels.fill(0);
    if (height > 0) {
      for (const { index, x, y, distance, reach } of cells) {
        const base = 1 - distance / (reach * height);
        if (base <= 0) continue;
        // Three scales of flame, the finer the faster.
        const sway = (noise(x * 0.03 + seedX, (y + seconds * 35) * 0.03 + seedY) - 0.5) * 1.8;
        const across = x * 0.065 + sway + seedX;
        const field =
          0.6 * noise(across, (y + seconds * 60) * 0.032 + seedY) +
          0.28 * noise(across * 2.3 + 9, (y + seconds * 95) * 0.07 + seedY) +
          0.12 * noise(across * 4.7 + 21, (y + seconds * 140) * 0.15 + seedY);
        const flame = Math.min(1, Math.max(0, (field - 0.25) / 0.5));
        const heat = (base * 1.3 - (1 - flame) * 0.95) * fade;
        if (heat <= 0) continue;
        const color = Math.min(255, Math.round(heat * 255)) * 4;
        const pixel = index * 4;
        pixels[pixel] = PALETTE[color]!;
        pixels[pixel + 1] = PALETTE[color + 1]!;
        pixels[pixel + 2] = PALETTE[color + 2]!;
        pixels[pixel + 3] = PALETTE[color + 3]!;
      }
    }
    bufferContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    // A blurred glow underneath, nearly sharp flames on top.
    context.filter = `blur(${3.5 * scale}px)`;
    context.globalAlpha = 0.7;
    context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    context.filter = `blur(${0.5 * scale}px)`;
    context.globalAlpha = 1;
    context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
  };

  // The clock starts on the first frame: its timestamp can precede a performance.now() taken here.
  let startedAt: number | null = null;
  const step = (now: number) => {
    startedAt ??= now;
    const seconds = (now - startedAt) / 1000;
    if (!options.continuous && seconds >= DURATION_SECONDS) {
      onBurnedOut();
      return;
    }
    paint(seconds);
    frame = requestAnimationFrame(step);
  };
  let frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
