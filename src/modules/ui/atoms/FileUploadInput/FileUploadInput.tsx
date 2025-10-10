import { Box, Button, Text } from "@saleor/macaw-ui";
import { forwardRef } from "react";
import { fileUploadInput } from "./fileUploadInput.css";

export type FileUploadInputProps = {
  label: string;
  disabled?: boolean;
} & JSX.IntrinsicElements["input"];

export const FileUploadInput = forwardRef<HTMLInputElement, FileUploadInputProps>(
  ({ label, disabled = false, ...props }, ref) => {
    return (
      <Box display="flex" alignItems="stretch" flexDirection="row" columnGap={4}>
        <Box as="label" className={fileUploadInput}>
          <Text size={3} color="default1">
            {label}
          </Text>
          <input
            {...props}
            value={undefined}
            type="file"
            className="visually-hidden"
            disabled={disabled}
            ref={ref}
          />
        </Box>
        <Button
          variant="primary"
          disabled={disabled}
          size="medium"
          marginTop={6}
          whiteSpace="nowrap"
          type="submit"
        >
          <Box
            display="inline-flex"
            justifyContent="center"
            alignItems="center"
            paddingY={"px"}
            paddingX={0.5}
            __transform="rotate(90deg) scale(0.75)"
            __borderWidth={0.5}
            borderColor="default1"
            borderRadius={2}
            borderStyle="solid"
            outlineStyle="none"
          >
            {/* 替换 ArrowLeftIcon，使用文本表示箭头 */}
            <Text size={2}>←</Text>
          </Box>
          Upload certificate
        </Button>
      </Box>
    );
  },
);
FileUploadInput.displayName = "FileUploadInput";