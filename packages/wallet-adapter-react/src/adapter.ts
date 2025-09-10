import { SolanaWalletBase, SolanaWalletCluster, SolanaWalletProvider } from "@biqprotocol/wallet-lib";
import { BaseMessageSignerWalletAdapter, scopePollingDetectionStrategy, WalletAdapterNetwork, WalletConnectionError, WalletReadyState, WalletSignMessageError, WalletSignTransactionError } from "@solana/wallet-adapter-base";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

export interface DeeplinkWalletAdapterConfig {
  provider: SolanaWalletProvider;
  network?: WalletAdapterNetwork;
  appUrl?: string;
  redirectUrl?: string;
}

export interface DeeplinkWalletAdapterOptions {
  network?: WalletAdapterNetwork;
  appUrl?: string;
  redirectUrl?: string;
}

interface DeeplinkWalletCallbackMessage {
  event: "callback";
  url: string;
}

export abstract class DeeplinkWalletAdapter extends BaseMessageSignerWalletAdapter {
  private _provider: SolanaWalletProvider;
  private _connecting: boolean = false;
  private _wallet: SolanaWalletBase | null = null;
  private _publicKey: PublicKey | null = null;
  private _readyState: WalletReadyState = WalletReadyState.Unsupported;
  private _broadcast: BroadcastChannel | null = null;

  constructor(options: DeeplinkWalletAdapterConfig) {
    super();
    this._provider = options.provider;
    scopePollingDetectionStrategy(() => {
      if (typeof window !== "undefined") {
        // Setup depplink wallet
        let appUrl = options.appUrl;
        if (typeof appUrl !== "string" || appUrl.length === 0) {
          if (typeof window !== "undefined" && typeof window.location === "object") {
            appUrl = window.location.origin;
          } else {
            throw new Error("DeeplinkWalletAdapter: appUrl is required in non-browser environments");
          }
        }
        let redirectUrl = options.redirectUrl;
        if (typeof redirectUrl !== "string" || redirectUrl.length === 0) {
          redirectUrl = appUrl;
        }
        console.log("DeeplinkWalletAdapter: appUrl", appUrl);
        console.log("DeeplinkWalletAdapter: redirectUrl", redirectUrl);

        this._wallet = new SolanaWalletBase({
          appUrl: appUrl,
          redirectUrl: redirectUrl,
          cluster: this.getClusterFromNetwork(options.network),
        });

        // Mark wallet as ready
        this._readyState = WalletReadyState.Loadable;
        this.emit("readyStateChange", this._readyState);

        return true;
      }
      return false;
    });
  }

  private getClusterFromNetwork(network: WalletAdapterNetwork | undefined): SolanaWalletCluster {
    switch (network) {
      case WalletAdapterNetwork.Mainnet:
        return "mainnet-beta";
      case WalletAdapterNetwork.Testnet:
        return "testnet";
      case WalletAdapterNetwork.Devnet:
      default:
        return "devnet";
    }
  }

  private subscribeToBroadcast() {
    // Setup broadcast channel to receive callback messages
    this._broadcast = new BroadcastChannel("deeplink-wallet");
    if (this._broadcast === null) {
      throw new Error("DeeplinkWalletAdapter: BroadcastChannel not supported");
    }
    this._broadcast.onmessage = (event: MessageEvent<DeeplinkWalletCallbackMessage>) => {
      console.log("DeeplinkWalletAdapter: broadcast message", event);
      if (event.data.event === "callback" && typeof event.data.url !== "undefined") {
        this._wallet?.getCallbackHandler()(event.data.url);
      }
    }
  }

  private unsubscribeFromBroadcast() {
    if (this._broadcast !== null) {
      this._broadcast.close();
      this._broadcast = null;
    }
  }

  async connect(): Promise<void> {
    if (this._wallet === null) return;
    if (this.connected || this.connecting) return;

    this._connecting = true;
    this.subscribeToBroadcast();
    const result = await this._wallet.connect(this._provider);
    if (typeof result !== "undefined") {
      this._publicKey = new PublicKey(result.address);
      localStorage.setItem("lastWalletConnected", this._publicKey.toString());
      this._connecting = false;
      this.emit("connect", this._publicKey);
    } else {
      this._connecting = false;
      const error = new WalletConnectionError("Connection failed");
      this.emit('error', error);
      throw error;
    }
  }

  async autoConnect(): Promise<void> {
    const lastWalletConnected = localStorage.getItem("lastWalletConnected");
    if (lastWalletConnected !== null) {
      this.subscribeToBroadcast();
      this._publicKey = new PublicKey(lastWalletConnected);
      this.emit("connect", this._publicKey);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.unsubscribeFromBroadcast();
      this._publicKey = null;
      localStorage.removeItem("lastWalletConnected");
    }
    this.emit("disconnect");
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.connected || this._publicKey === null) throw new WalletConnectionError("Wallet not connected");
    if (this._wallet === null) throw new WalletSignMessageError("Wallet not initialized");
    const signedMessage = await this._wallet.signMessage(this._publicKey.toString(), Buffer.from(message).toString("utf8"));
    if (typeof signedMessage !== "undefined") {
      return bs58.decode(signedMessage);
    } else {
      throw new WalletSignMessageError("signMessage failed");
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    if (!this.connected || this._publicKey === null) throw new WalletConnectionError("Wallet not connected");
    if (this._wallet === null) throw new WalletSignTransactionError("Wallet not initialized");
    const signedTransaction = await this._wallet.signTransaction(this._publicKey.toString(), bs58.encode(transaction.serialize({
      requireAllSignatures: false,
    })));
    if (typeof signedTransaction !== "undefined") {
      if (transaction instanceof Transaction) {
        const tx = Transaction.from(bs58.decode(signedTransaction));
        (transaction as Transaction).signatures = tx.signatures;
        return transaction;
      } else if (transaction instanceof VersionedTransaction) {
        const tx = VersionedTransaction.deserialize(bs58.decode(signedTransaction));
        (transaction as VersionedTransaction).signatures = tx.signatures;
        return transaction;
      } else {
        throw new WalletSignTransactionError("Unsupported transaction type");
      }
    } else {
      throw new WalletSignTransactionError("signTransaction failed");
    }
  }
}