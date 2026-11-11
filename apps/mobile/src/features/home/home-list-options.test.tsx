import type { EnvironmentId } from "@t3tools/contracts";
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const harness = vi.hoisted(() => ({ saved: [] as unknown[] }));

vi.mock("../../state/preferences", () => ({ updateMobilePreferencesAtom: {} }));
vi.mock("@effect/atom-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@effect/atom-react")>()),
  useAtomSet: () => (value: unknown) => harness.saved.push(value),
}));

import { AGENTS_PROJECT } from "./agents-project";
import { scopedProjectKey } from "../../lib/scopedEntities";
import { HomeListOptionsProvider, useHomeListOptions } from "./home-list-options";

const ENVIRONMENT = "env-1" as EnvironmentId;
const AVAILABLE = new Set([ENVIRONMENT]);

it("saves the scope from every update made in one event", async () => {
  harness.saved = [];
  let controls: ReturnType<typeof useHomeListOptions> | undefined;
  function Probe() {
    const result = useHomeListOptions(AVAILABLE);
    useLayoutEffect(() => {
      controls = result;
    });
    return null;
  }

  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <HomeListOptionsProvider
        projectGroupingMode="repository"
        savedFilters={{ environmentId: null, projectKey: null }}
      >
        <Probe />
      </HomeListOptionsProvider>,
    ),
  );
  expect(controls!.options.selectedAge).toBe("all");
  expect(controls!.options.hot).toBe(false);
  expect(controls!.options.agentsHot).toBe(false);
  act(() => {
    controls!.setSelectedEnvironmentId(ENVIRONMENT);
    controls!.setSelectedProjectKey("env-1:project-1");
    controls!.setSelectedAge("1h");
  });

  expect(harness.saved.at(-1)).toEqual({
    threadListFilters: {
      environmentId: ENVIRONMENT,
      projectKey: "env-1:project-1",
      age: "1h",
      hot: false,
      agentsHot: false,
    },
  });
  expect(controls!.options.selectedEnvironmentId).toBe(ENVIRONMENT);
  expect(controls!.options.selectedProjectKey).toBe("env-1:project-1");
  expect(controls!.options.selectedAge).toBe("1h");
  act(() => {
    controls!.setSelectedEnvironmentId(null);
    controls!.setSelectedProjectKey(null);
    controls!.setSelectedAge("all");
  });
  expect(harness.saved.at(-1)).toEqual({
    threadListFilters: {
      environmentId: null,
      projectKey: null,
      age: "all",
      hot: false,
      agentsHot: false,
    },
  });
  act(() => root.unmount());
});

it("restores hot independently per tab and keeps the selected age when hot is toggled", async () => {
  harness.saved = [];
  let controls: ReturnType<typeof useHomeListOptions> | undefined;
  function Probe() {
    const result = useHomeListOptions(AVAILABLE);
    useLayoutEffect(() => {
      controls = result;
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
  await act(async () =>
    root.render(
      <HomeListOptionsProvider
        projectGroupingMode="separate"
        savedFilters={{
          environmentId: ENVIRONMENT,
          projectKey: "project",
          age: "1w",
          hot: true,
          agentsHot: false,
        }}
      >
        <Probe />
      </HomeListOptionsProvider>,
    ),
  );
  expect(controls!.options).toMatchObject({ hot: true, agentsHot: false, selectedAge: "1w" });
  act(() => {
    controls!.setHot(false);
    controls!.setAgentsHot(true);
  });
  expect(controls!.options).toMatchObject({ hot: false, agentsHot: true, selectedAge: "1w" });
  expect(harness.saved.at(-1)).toEqual({
    threadListFilters: {
      environmentId: ENVIRONMENT,
      projectKey: "project",
      age: "1w",
      hot: false,
      agentsHot: true,
    },
  });
});

it.each([true, false])(
  "recovers the exact legacy Agents filter without hiding a homonym (target: %s)",
  async (target) => {
    let selected: string | null | undefined;
    const key = scopedProjectKey(
      target ? AGENTS_PROJECT.environmentId : ENVIRONMENT,
      AGENTS_PROJECT.projectId,
    );
    function Probe() {
      const { options } = useHomeListOptions(AVAILABLE);
      useLayoutEffect(() => {
        selected = options.selectedProjectKey;
      });
      return null;
    }
    const root = createRoot(document.createElement("div"));
    using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
    await act(async () =>
      root.render(
        <HomeListOptionsProvider
          projectGroupingMode="separate"
          savedFilters={{ environmentId: null, projectKey: key }}
        >
          <Probe />
        </HomeListOptionsProvider>,
      ),
    );
    expect(selected).toBe(target ? null : key);
  },
);
