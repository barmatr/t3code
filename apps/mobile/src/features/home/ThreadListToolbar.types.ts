import type { MenuAction } from "@react-native-menu/menu";

export interface ThreadListToolbarProps {
  readonly workspaceTab?: "threads" | "pullRequests" | undefined;
  readonly hot?: boolean | undefined;
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly filterActions: MenuAction[];
  readonly filterCustomized: boolean;
  readonly onFilterSelect: (id: string) => void;
  readonly onOpenEnvironments: () => void;
  readonly onRequestVisibility?: () => void;
}
