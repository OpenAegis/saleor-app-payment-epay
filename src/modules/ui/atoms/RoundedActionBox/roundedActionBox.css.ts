import { sprinkles } from "@saleor/macaw-ui";
import { recipe } from "@vanilla-extract/recipes";

export const roundedActionBoxRecipe = recipe({
  variants: {
    error: {
      true: {},
      false: {},
    },
    disabled: { true: {}, false: {} },
  },
  compoundVariants: [
    {
      variants: {
        disabled: false,
        error: false,
      },
      style: sprinkles({
        borderColor: "default1",
      }),
    },
    {
      variants: {
        disabled: true,
        error: false,
      },
      style: sprinkles({
        borderColor: "default2",
      }),
    },
    {
      variants: {
        disabled: false,
        error: true,
      },
      style: sprinkles({
        backgroundColor: "critical2",
        borderColor: "critical1",
      }),
    },
    {
      variants: {
        disabled: true,
        error: true,
      },
      style: sprinkles({
        backgroundColor: "critical2",
        borderColor: "critical1",
      }),
    },
  ],
});
