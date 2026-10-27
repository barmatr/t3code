import * as Schema from "effect/Schema";
import { useLocalStorage } from "../../hooks/useLocalStorage";

export function useProjectSwitcherPreference() {
  return useLocalStorage("t4code:project-switcher-enabled", true, Schema.Boolean);
}
