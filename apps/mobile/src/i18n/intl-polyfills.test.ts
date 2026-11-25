import { afterEach, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reuses locale distances when successive thread rows format plurals on Hermes", async () => {
  // Node normally supplies native plural rules. Exercise the polyfill used on the phone.
  const { PluralRules: _nativeRules, ...descriptors } = Object.getOwnPropertyDescriptors(Intl);
  vi.stubGlobal("Intl", Object.defineProperties({}, descriptors));
  await import("./intl-polyfills");

  const categories = () => [
    new Intl.PluralRules("fr-CA").select(0),
    new Intl.PluralRules("ru").select(2),
  ];
  expect(categories()).toEqual(["one", "few"]);

  const maximize = vi.spyOn(Intl.Locale.prototype, "maximize");
  expect(categories()).toEqual(["one", "few"]);
  expect(maximize).not.toHaveBeenCalled();
});
