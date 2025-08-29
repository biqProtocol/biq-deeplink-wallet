export enum SolanaWalletProvider {
  PHANTOM = "Phantom",
  SOLFLARE = "Solflare",
}

export type SolanaWalletCluster = "mainnet-beta" | "devnet" | "testnet";

export type SolanaWalletConnectedWallet = {
  provider: SolanaWalletProvider;
  address: string;
}

