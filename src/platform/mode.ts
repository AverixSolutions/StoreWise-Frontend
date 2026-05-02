export type AppMode =
  | "desktop-offline"
  | "desktop-sync"
  | "web-offline"
  | "web-sync";

export function getAppMode(): AppMode {
  if (typeof window === "undefined") return "web-offline";

  const isDesktop = !!(window as any).electronAPI;

  if (isDesktop) {
    const modeFlag = localStorage.getItem("kynflow_mode") || "";
    const tier = localStorage.getItem("kynflow_tier") || "";
    const syncEnabled = modeFlag.toUpperCase() === "ONLINE" && tier === "PRO";
    return syncEnabled ? "desktop-sync" : "desktop-offline";
  }

  const hasApi = Boolean(process.env.NEXT_PUBLIC_KYNFLOW_API_BASE);
  const modeFlag = localStorage.getItem("kynflow_mode") || "";
  const isOnline = modeFlag.toUpperCase() === "ONLINE";

  if (hasApi && isOnline) return "web-sync";
  return "web-offline";
}

export function isSyncEnabled(): boolean {
  const mode = getAppMode();
  return mode === "desktop-sync" || mode === "web-sync";
}
