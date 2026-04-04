// src/platform/index.ts
import { desktopPlatform } from "./desktop";
import { webPlatform } from "./web";

export const platform =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined"
    ? desktopPlatform
    : webPlatform;
