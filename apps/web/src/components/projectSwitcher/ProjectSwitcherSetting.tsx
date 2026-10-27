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
    <SettingsSection id="t4-project-switcher" title="Projets T4">
      <SettingsRow
        title="⌥ Tab : changer de projet"
        description="Option + Tab alterne entre les projets récemment utilisés. Maintiens Option pour parcourir les projets cochés ; relâche pour ouvrir la dernière conversation mise à jour et filtrer la barre de gauche."
      >
        <Switch
          aria-label="⌥ Tab : changer de projet"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
