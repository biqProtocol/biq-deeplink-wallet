import { useRouter } from "expo-router";
import { useEffect } from "react";

export function SolanaWalletScreen() {

  const router = useRouter();

  useEffect(() => {
    console.log("[SolanaWalletScreen] mounted, going back");
    if (router.canGoBack()) {
      router.back();
    } else {
      try {
        router.replace("/");
      } catch (e) {
        // Handle router not ready for when the app is cold started
        setTimeout(() => {
          router.replace("/");
        }, 500);
      }
    }
  }, [router]);

  return null;
}