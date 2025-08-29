export interface SolanaWalletLinkingProvider {
  openURL(url: string): Promise<void>;
}