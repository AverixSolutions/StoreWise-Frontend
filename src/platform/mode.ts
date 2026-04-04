// src/platform/mode.ts
import { platform } from "@/platform";

export type AppMode = "desktop-offline" | "web-offline" | "web-sync";

export function getAppMode(): AppMode {
  const runtime = platform.getRuntimeInfo();

  if (runtime.runtime === "desktop") {
    return "desktop-offline";
  }

  const hasSyncApi = Boolean(process.env.NEXT_PUBLIC_KYNFLOW_API_BASE);

  if (!hasSyncApi) {
    return "web-offline";
  }

  return "web-sync";
}
