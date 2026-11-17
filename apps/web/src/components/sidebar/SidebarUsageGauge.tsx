import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts } from "@t3tools/shared/usageLimits";
import { ChartNoAxesColumnIcon } from "lucide-react";
import { memo } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { environmentPresentations } from "../../state/presentation";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { providerClients } from "../settings/providerDriverMeta";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { weeklyUsageChips } from "./sidebarUsageGauge.logic";

/**
 * T4: the sidebar's Usage entry shows each account's weekly share used ("W 60%")
 * next to its provider icon and instance initials, in the sidebar's neutral colors.
 */
export const SidebarUsageGauge = memo(function SidebarUsageGauge({
  onClick,
}: {
  readonly onClick: () => void;
}) {
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const now = Date.parse(`${useNowMinute()}:00.000Z`);
  const chips = weeklyUsageChips(collectLimitAccounts(presentations), now);

  if (chips.length === 0) {
    return (
      <SidebarMenuItem className="shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarMenuButton aria-label="Usage" onClick={onClick} size="icon">
                <ChartNoAxesColumnIcon />
              </SidebarMenuButton>
            }
          />
          <TooltipPopup side="top">Usage</TooltipPopup>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  const named = chips.map((chip) => {
    const name =
      chip.account.displayName ??
      providerClients.get(chip.account.driver)?.label ??
      String(chip.account.driver);
    return { ...chip, name };
  });

  return (
    <SidebarMenuItem className="min-w-0 shrink">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label={`Usage: ${named.map((chip) => `${chip.name} ${chip.usedPercent}% of the week used`).join(", ")}`}
              onClick={onClick}
            >
              <span className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                {named.map((chip) => (
                  <span key={chip.key} className="inline-flex shrink-0 items-center gap-1">
                    <ProviderInstanceIcon
                      driverKind={chip.account.driver}
                      displayName={chip.name}
                      showBadge={Boolean(chip.account.displayName)}
                      size="compact"
                      indicatorBackground="var(--sidebar)"
                      className="size-4 grayscale"
                      iconClassName="fill-current text-sidebar-foreground/80"
                      badgeClassName="bg-sidebar text-sidebar-foreground"
                    />
                    <span className="text-xs font-medium text-sidebar-foreground/80 tabular-nums">
                      W {chip.usedPercent}%
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
                {chip.name}: {chip.usedPercent}%
              </span>
            ))}
          </div>
        </TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
});
