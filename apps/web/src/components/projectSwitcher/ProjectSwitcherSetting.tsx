import { SettingsRow, SettingsSection } from "../settings/settingsLayout";
import { Switch } from "../ui/switch";
import { useProjectSwitcherPreference } from "./useProjectSwitcherPreference";

export function ProjectSwitcherSetting() {
  const [enabled, setEnabled] = useProjectSwitcherPreference();
  if (
    !window.desktopBridge?.setProjectSwitcherEnabled ||
    !navigator.platform.toLowerCase().includes("mac")
  )
    return null;
  return (
    <SettingsSection id="t4-project-switcher" title="T4 projects">
      <SettingsRow
        title="⌥ Tab: switch project"
        description="Option + Tab switches between recently used projects. Hold Option to cycle through the checked projects; release to open the latest updated thread and focus the sidebar on its project."
      >
        <Switch aria-label="⌥ Tab: switch project" checked={enabled} onCheckedChange={setEnabled} />
      </SettingsRow>
    </SettingsSection>
  );
}
