import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

export function T3Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  const aspectRatio = 94.3941 / 56.96;
  return (
    <Svg
      accessibilityLabel="T4"
      height={props.height}
      width={props.height * aspectRatio}
      viewBox="15.5309 37 94.3941 56.96"
    >
      <ThemedPath
        d="M33.4509 93V47.56H15.5309V37H64.3309V47.56H46.4109V93H33.4509Z M92 37H106V72H109.925V83H106V93H93V83H66V72L92 37Z M93 53L78 72H93V53Z"
        fillRule="evenodd"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
