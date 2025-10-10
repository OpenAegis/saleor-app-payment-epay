import { sprinkles } from "@saleor/macaw-ui/theme/sprinkles.css";
import { style } from "@vanilla-extract/css";

export const fileUploadInput = style([
  sprinkles({
    color: "default2",
    backgroundColor: {
      default: "default3",
      hover: "default2",
    },
    borderRadius: 3,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: "transparent",
      hover: "default1",
    },
    paddingX: 2,
    cursor: "pointer",
    flexGrow: "1",
    display: "flex",
    alignItems: "center",
  }),
  { height: 56 },
]);