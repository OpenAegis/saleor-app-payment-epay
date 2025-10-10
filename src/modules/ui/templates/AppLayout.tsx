import { Box, Text } from "@saleor/macaw-ui";
import { type ReactNode, isValidElement } from "react";
import { appLayoutBoxRecipe, appLayoutTextRecipe } from "./appLayout.css";

export const AppLayout = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap={9}
      marginX="auto"
      __maxWidth={1156}
      paddingTop={10}
      __paddingBottom="20rem"
    >
      <Box display="flex" flexDirection="column" rowGap={2}>
        <Text as="h1" size={7}>
          {title}
        </Text>
        {isValidElement(description) ? (
          description
        ) : (
          <Text as="p" size={5}>
            {description}
          </Text>
        )}
      </Box>
      {children}
    </Box>
  );
};

export const AppLayoutRow = ({
  title,
  description,
  children,
  disabled = false,
  error = false,
}: {
  title: string;
  description?: ReactNode;
  disabled?: boolean;
  error?: boolean;
  children: ReactNode;
}) => {
  return (
    <Box display="grid" className={appLayoutBoxRecipe({ error, disabled })}>
      <Box display="flex" flexDirection="column" rowGap={10}>
        <Text
          as="h2"
          className={appLayoutTextRecipe({ error, disabled })}
          size={7}
        >
          {title}
        </Text>
        {isValidElement(description) ? (
          <Box display="flex" flexDirection="column" rowGap={2}>
            {description}
          </Box>
        ) : (
          <Text
            as="p"
            className={appLayoutTextRecipe({ error, disabled })}
            size={5}
          >
            {description}
          </Text>
        )}
      </Box>
      <Box display="flex" flexDirection="column" rowGap={10}>
        {children}
      </Box>
    </Box>
  );
};