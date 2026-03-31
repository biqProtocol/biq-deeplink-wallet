export enum SolanaWalletProvider {
  PHANTOM = "Phantom",
  SOLFLARE = "Solflare",
}

export type SolanaWalletCluster = "mainnet-beta" | "devnet" | "testnet";

export type SolanaWalletConnectedWallet = {
  provider: SolanaWalletProvider;
  address: string;
}

export type SolanaWalletErrorType = "connect" | "disconnect" | "signTransaction" | "signMessage" | "unknown";
export type SolanaWalletErrorSource = "lib" | "wallet" | "unknown";
export type SolanaWalletError = {
  timestamp: number;
  type: SolanaWalletErrorType;
  source: SolanaWalletErrorSource;
  error?: {
    code: string | null;
    message: string | null;
  };
}

export enum SolanaWalletLibError {
  ENCRYPTION_KEY_NOT_INITIALIZED = "ENCRYPTION_KEY_NOT_INITIALIZED",
  FAILED_TO_OPEN_URL = "FAILED_TO_OPEN_URL",
  NOT_CONNECTED = "NOT_CONNECTED",
  FAILED_DECRYPT = "FAILED_DECRYPT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}