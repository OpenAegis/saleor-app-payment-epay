import { type ReactNode } from "react";

export const ChipNeutral = ({ children }: { children: ReactNode }) => (
  <span style={{
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "16px",
    backgroundColor: "#f5f5f5",
    fontSize: "12px",
    fontWeight: "normal",
  }}>
    {children}
  </span>
);
export const ChipDanger = ({ children }: { children: ReactNode }) => (
  <span style={{
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "16px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    fontSize: "12px",
    fontWeight: "normal",
  }}>
    {children}
  </span>
);
export const ChipSuccess = ({ children }: { children: ReactNode }) => (
  <span style={{
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "16px",
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
    fontSize: "12px",
    fontWeight: "normal",
  }}>
    {children}
  </span>
);
export const ChipInfo = ({ children }: { children: ReactNode }) => (
  <span style={{
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "16px",
    backgroundColor: "#e3f2fd",
    color: "#1565c0",
    fontSize: "12px",
    fontWeight: "normal",
  }}>
    {children}
  </span>
);