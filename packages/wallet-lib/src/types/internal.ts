import { SolanaWalletCluster, SolanaWalletProvider } from "../types";

export type SolanaWalletProviderSecrets = {
  provider: SolanaWalletProvider;
  wallet: string;
  session: string;
  pubKey: Uint8Array;
  sharedSecret: Uint8Array;
}

export type SolanaWalletConnectRequest = {
  app_url: string;
  dapp_encryption_public_key: string;
  redirect_link: string;
  cluster: SolanaWalletCluster;
}

export type SolanaWalletConnectData = {
  public_key: string; // base58 encoded public key
  session: string; // base58 encoded session key
}

export type SolanaWalletDisconnectRequest = {
  dapp_encryption_public_key: string;
  nonce: string;
  redirect_link: string;
  payload: string; // base58 encoded encrypted message
}

export type SolanaWalletDisconnectRequestData = {
  session: string;
}

export type SolanaWalletSignMessageRequest = {
  dapp_encryption_public_key: string;
  nonce: string;
  redirect_link: string;
  payload: string; // base58 encoded encrypted message
}

export type SolanaWalletSignMessageRequestData = {
  message: string; // the message, base58 encoded
  session: string;
  display: "utf8" | "hex";
}

export type SolanaWalletSignMessageResponseData = {
  signature: string; // base58 encoded signature
}

export interface SolanaWalletProviderConfigType {
  name: string;
  url: string;
  icon: string;
}

export type ConnectEventParams = {
  provider?: SolanaWalletProvider;
  publicKey?: string;
  error?: {
    code: string | null;
    message: string | null;
  };
}

export type DisconnectEventParams = {
  provider?: SolanaWalletProvider;
  publicKey?: string;
  error?: {
    code: string | null;
    message: string | null;
  };
}

export type SignMessageEventParams = {
  provider?: SolanaWalletProvider;
  signature?: string;
  error?: {
    code: string | null;
    message: string | null;
  };
}

export interface SolanaWalletCallbackParams {
  provider: SolanaWalletProvider;
  requestId: string;
  [key: string]: string;
}