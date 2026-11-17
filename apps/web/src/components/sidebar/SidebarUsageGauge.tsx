import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts } from "@t3tools/shared/usageLimits";
import { memo } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { environmentPresentations } from "../../state/presentation";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { providerClients } from "../settings/providerDriverMeta";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { weeklyUsageChips } from "./sidebarUsageGauge.logic";

export function useWeeklyUsageChips() {
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const now = Date.parse(`${useNowMinute()}:00.000Z`);
  return weeklyUsageChips(collectLimitAccounts(presentations), presentations, now);
}

/**
 * T4: a footer row showing each account's weekly share used ("W 60%") next to its provider
 * icon and instance initials, in the sidebar's neutral colors. It replaces the Usage icon,
 * which comes back in the utility row when no account reports a week.
 */
export const SidebarUsageGauge = memo(function SidebarUsageGauge({
  onClick,
}: {
  readonly onClick: () => void;
}) {
  const chips = useWeeklyUsageChips();
  if (chips.length === 0) return null;

  const named = chips.map((chip) => {
    const provider = providerClients.get(chip.driver)?.label ?? String(chip.driver);
    const used = chip.usedPercent === null ? "–" : `${chip.usedPercent}%`;
    return {
      ...chip,
      iconName: chip.displayName ?? provider,
      name: chip.displayName ? `${provider} ${chip.displayName}` : provider,
      used,
      detail: chip.usedPercent === null ? "limits unavailable" : `${used} of the week used`,
    };
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarMenuButton
                aria-label={`Usage: ${named.map((chip) => `${chip.name} ${chip.detail}`).join(", ")}`}
                onClick={onClick}
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5 overflow-hidden">
                  {named.map((chip) => (
                    <span key={chip.key} className="inline-flex shrink-0 items-center gap-0.5">
                      <ProviderInstanceIcon
                        driverKind={chip.driver}
                        displayName={chip.iconName}
                        showBadge={Boolean(chip.displayName)}
                        size="compact"
                        indicatorBackground="var(--sidebar)"
                        className="size-4 grayscale"
                        iconClassName="fill-current text-sidebar-foreground/80"
                        badgeClassName="bg-sidebar text-sidebar-foreground"
                      />
                      <span className="text-xs font-medium text-sidebar-foreground/80 tabular-nums">
                        W {chip.used}
                      </span>
                    </span>
                  ))}
                </span>
              </SidebarMenuButton>
            }
          />
          <TooltipPopup side="top">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Usage · weekly limits used</span>
              {named.map((chip) => (
                <span key={chip.key} className="tabular-nums">
                  {chip.name}: {chip.detail}
                </span>
              ))}
            </div>
          </TooltipPopup>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  );
});
