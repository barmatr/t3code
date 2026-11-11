import { createLatestThreadMessageAtoms } from "@t3tools/client-runtime/state/threads";
import { connectionAtomRuntime } from "../connection/runtime";

export const latestThreadMessageAtom = createLatestThreadMessageAtoms(connectionAtomRuntime);
