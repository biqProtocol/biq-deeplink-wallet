"use client"

import { broadcastSent } from "@/lib/adapter";
import { useEffect } from "react";

export default function SolanaWalletPage() {
  // Send broadcast message with current URL and close the window
  useEffect(() => {
    if (broadcastSent.sent) return;
    broadcastSent.sent = true;
    const broadcast = new BroadcastChannel("deeplink-wallet");
    broadcast.postMessage({ event: "callback", url: window.location.href });
    window.close();
  }, []);

  return null;
}