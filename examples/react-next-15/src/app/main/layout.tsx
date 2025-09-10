"use client"

import { DeeplinkWalletAdapterPhantom, DeeplinkWalletAdapterSolflare } from "@biqprotocol/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo } from "react";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new DeeplinkWalletAdapterPhantom(),
      new DeeplinkWalletAdapterSolflare(),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  );
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {children}
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}