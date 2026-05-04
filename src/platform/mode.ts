// frontend/src/platform/mode.ts
export type AppMode =
  | "desktop-offline"
  | "desktop-sync"
  | "web-offline"
  | "web-sync";

export function getAppMode(): AppMode {
  if (typeof window === "undefined") return "web-offline";

  const isDesktop = !!(window as any).electronAPI;
  const isOnline =
    (localStorage.getItem("kynflow_mode") || "").toUpperCase() === "ONLINE";

  if (isDesktop) {
    return isOnline ? "desktop-sync" : "desktop-offline";
  }

  const hasApi = Boolean(process.env.NEXT_PUBLIC_KYNFLOW_API_BASE);
  return hasApi && isOnline ? "web-sync" : "web-offline";
}

export function isSyncEnabled(): boolean {
  const mode = getAppMode();
  return mode === "desktop-sync" || mode === "web-sync";
}
