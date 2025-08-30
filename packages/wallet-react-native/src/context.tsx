import { SolanaWalletBase, SolanaWalletCluster, SolanaWalletStorageProvider, SolanaWalletLinkingProvider } from "@biqprotocol/wallet-lib";
import { createContext, PropsWithChildren, useEffect, useState } from "react";
import * as Linking from "expo-linking";
import * as SecureStore from 'expo-secure-store';

export type SolanaWalletContextOptions = PropsWithChildren & {
  appUrl: string;
  appScheme?: string;
  cluster?: SolanaWalletCluster;
}

export const SolanaWalletContext = createContext<{
  solanaWallet?: SolanaWalletBase | null;
}>({
  solanaWallet: null
});

const storageProvider: SolanaWalletStorageProvider = {
  getItem: async (key: string) => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  }
}

const linkingProvider: SolanaWalletLinkingProvider = {
  openURL: async (url: string) => {
    await Linking.openURL(url);
  }
}

export function SolanaWallet({ appUrl, appScheme, cluster, children }: SolanaWalletContextOptions) {
  const [solanaWallet, setSolanaWallet] = useState<SolanaWalletBase | null>(null);

  const baseUrl = Linking.createURL("/", { scheme: appScheme });

  useEffect(() => {
    const newSolanaWallet = new SolanaWalletBase({
      appUrl: appUrl,
      redirectUrl: baseUrl,
      cluster,
      storageProvider,
      linkingProvider
    });

    const callbackSubscriber = Linking.addEventListener("url", (event) => newSolanaWallet.getCallbackHandler()(event.url));
    Linking.getInitialURL().then((url) => {
      if (url !== null) {
        newSolanaWallet.getCallbackHandler()(url);
      }
    });
    setSolanaWallet(newSolanaWallet);

    return () => {
      callbackSubscriber.remove();
      setSolanaWallet(null);
    }
  }, [appScheme, cluster]);

  return (
    <SolanaWalletContext.Provider value={{
      solanaWallet
    }}>
      {children}
    </SolanaWalletContext.Provider>
  )
}