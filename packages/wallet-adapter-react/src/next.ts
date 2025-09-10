export function DeeplinkWalletAdapterRedirect() {
  if (typeof window === "undefined") return null;
  
  // Send broadcast message with current URL and close the window
  const broadcast = new BroadcastChannel("deeplink-wallet");
  broadcast.postMessage({ event: "callback", url: window.location.href });
  window.close();

  return null;
}