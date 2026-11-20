import { useGT } from "gt-react-native";
import { View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";

export function ThreadAgeFilterNotice(props: {
  readonly checking: boolean;
  readonly failed: boolean;
  readonly retry: () => void;
}) {
  const gt = useGT();
  if (!props.failed && !props.checking) return null;
  return (
    <View className="gap-2 px-4 py-3">
      <Text className="text-sm text-foreground-muted">
        {props.failed
          ? gt("Some conversations could not be checked for recent replies.")
          : gt("Checking recent replies…")}
      </Text>
      {props.failed ? <Button label={gt("Retry")} tone="secondary" onPress={props.retry} /> : null}
    </View>
  );
}
