import * as NodeVM from "node:vm";
import { expect, it, vi } from "vite-plus/test";

import { brandFocusFireHtml } from "./brandFocusFireHtml";

function canvasDocument(reducedMotion = false, mode: "burst" | "continuous" = "burst") {
  let frame = 0;
  const frames = new Map<number, (time: number) => void>();
  const events = new Map<string, () => void>();
  const done = vi.fn();
  const paint = vi.fn();
  const context = {
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: paint,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const canvas = {
    style: {},
    parentElement: { offsetWidth: 150, offsetHeight: 26 },
    getContext: () => context,
  };
  const document = {
    hidden: false,
    querySelector: () => canvas,
    createElement: () => ({ getContext: () => context }),
    addEventListener: (event: string, listener: () => void) => events.set(event, listener),
  };
  const script = brandFocusFireHtml(150, 26, mode).match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error("Missing local fire script");
  new NodeVM.Script(script).runInNewContext({
    document,
    window: {
      devicePixelRatio: 3,
      matchMedia: () => ({ matches: reducedMotion }),
      ReactNativeWebView: { postMessage: done },
    },
    requestAnimationFrame: (callback: (time: number) => void) => {
      frames.set(++frame, callback);
      return frame;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  return {
    done,
    paint,
    frames,
    hide() {
      document.hidden = true;
      events.get("visibilitychange")?.();
    },
    advance(time: number) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(time);
    },
  };
}

it("paints the local fire and releases its frame loop after one burst", () => {
  const fire = canvasDocument();
  fire.advance(100);
  fire.advance(600);
  expect(fire.paint).toHaveBeenCalledTimes(2);
  const pixels = fire.paint.mock.lastCall?.[0].data as Uint8ClampedArray;
  expect(pixels.some((value) => value > 0)).toBe(true);
  fire.advance(1_500);
  expect(fire.done).toHaveBeenCalledExactlyOnceWith("burned-out");
  expect(fire.frames.size).toBe(0);
});

it("cancels immediately when WebKit is hidden", () => {
  const fire = canvasDocument();
  fire.advance(0);
  fire.hide();
  expect(fire.frames.size).toBe(0);
  expect(fire.done).toHaveBeenCalledExactlyOnceWith("burned-out");
});

it("does not allocate a frame loop when WebKit requests reduced motion", () => {
  const fire = canvasDocument(true);
  expect(fire.frames.size).toBe(0);
  expect(fire.paint).not.toHaveBeenCalled();
  expect(fire.done).toHaveBeenCalledExactlyOnceWith("burned-out");
});

it("runs continuous noise past the burst deadline, caps paint rate and stops when hidden", () => {
  const fire = canvasDocument(false, "continuous");
  fire.advance(0);
  fire.advance(500);
  fire.advance(1400);
  expect(fire.paint).toHaveBeenCalledTimes(3);
  fire.advance(1401);
  expect(fire.paint).toHaveBeenCalledTimes(3);
  fire.advance(10_000);
  expect(fire.paint).toHaveBeenCalledTimes(4);
  expect(fire.done).not.toHaveBeenCalled();
  expect(fire.frames.size).toBe(1);
  fire.hide();
  expect(fire.frames.size).toBe(0);
  expect(fire.done).toHaveBeenCalledExactlyOnceWith("burned-out");
  expect(canvasDocument(true, "continuous").frames.size).toBe(0);
});
