import { CompactBrandTitle } from "../../components/CompactBrandTitle";
import { WorkspaceConnectionTitle } from "../home/WorkspaceConnectionTitle";

/** The title of a workspace list tab: the brand and the connection status. */
export function WorkspaceBrandTitle(props: {
  readonly continuousFire?: boolean | undefined;
  readonly accessibilityLabel: string;
  readonly onOpenEnvironments: () => void;
}) {
  return (
    <WorkspaceConnectionTitle
      grow
      onPress={props.onOpenEnvironments}
      brand={
        <CompactBrandTitle
          continuousFire={props.continuousFire}
          allowFontScaling={false}
          accessibilityLabel={props.accessibilityLabel}
          fit
        />
      }
    />
  );
}
