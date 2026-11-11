import { View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";

export function ThreadAgeFilterNotice(props: {
  readonly checking: boolean;
  readonly failed: boolean;
  readonly retry: () => void;
}) {
  if (!props.failed && !props.checking) return null;
  return (
    <View className="gap-2 px-4 py-3">
      <Text className="text-sm text-foreground-muted">
        {props.failed
          ? "Some conversations could not be checked for recent replies."
          : "Checking recent replies…"}
      </Text>
      {props.failed ? <Button label="Retry" tone="secondary" onPress={props.retry} /> : null}
    </View>
  );
}
