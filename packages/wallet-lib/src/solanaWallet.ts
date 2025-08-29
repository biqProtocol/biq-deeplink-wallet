import * as nacl from "tweetnacl";
import bs58 from "bs58";
import { SolanaWalletCluster, SolanaWalletConnectedWallet, SolanaWalletProvider } from "./types";
import {
  ConnectEventParams, DisconnectEventParams, SignMessageEventParams,
  SolanaWalletCallbackParams, SolanaWalletConnectData,
  SolanaWalletConnectRequest, SolanaWalletDisconnectRequest,
  SolanaWalletDisconnectRequestData, SolanaWalletProviderConfigType,
  SolanaWalletProviderSecrets, SolanaWalletSignMessageRequest,
  SolanaWalletSignMessageRequestData, SolanaWalletSignMessageResponseData
} from "./types/internal";
import { SolanaWalletStorageProvider } from "./types/storage";
import EventEmitter from "eventemitter3";
import { SolanaWalletLinkingProvider } from "./types/linking";

const SolanaWalletProviderConfig: Record<SolanaWalletProvider, SolanaWalletProviderConfigType> = {
  [SolanaWalletProvider.PHANTOM]: {
    name: "Phantom",
    url: "https://phantom.app/ul/v1",
    icon: "https://www.phantom.app/img/logo.png",
  },
  [SolanaWalletProvider.SOLFLARE]: {
    name: "Solflare",
    url: "https://solflare.com/ul/v1",
    icon: "https://solflare.com/favicon.ico",
  },
}

const ENCRYPTION_KEY_STORAGE = "solanaWalletEncryptionKey";
const CONNECTED_WALLET_STORAGE_PREFIX = "solanaConnectedWallet_";

interface SolanaWalletOptions {
  appUrl: string;
  redirectUrl: string;
  cluster?: SolanaWalletCluster;
  storageProvider?: SolanaWalletStorageProvider;
  linkingProvider?: SolanaWalletLinkingProvider;
}

export class SolanaWalletBase extends EventEmitter {
  private appUrl: string;
  private cluster: SolanaWalletCluster = "mainnet-beta";
  private storage: SolanaWalletStorageProvider;
  private linking: SolanaWalletLinkingProvider;
  private connectCallbackUrl: string = "";
  private signMessageCallbackUrl: string = "";
  private disconnectCallbackUrl: string = "";
  private encryptionKey: Uint8Array | null = null;
  private encryptionPublicKey: string | null = null;
  private providerSecrets: Partial<Record<string, SolanaWalletProviderSecrets>> = {};
  private requestIdCounter: number = 0;
  private requestWalletMap: Record<number, string> = {};

  constructor(options: SolanaWalletOptions) {
    super();
    this.appUrl = options.appUrl;
    this.cluster = options.cluster || "mainnet-beta";

    if (typeof options.storageProvider !== "undefined") {
      this.storage = options.storageProvider;
    } else {
      // TODO: try to detect environment and use appropriate storage
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
        // Browser environment
        this.storage = {
          getItem: async (key: string) => {
            return Promise.resolve(window.localStorage.getItem(key));
          },
          setItem: async (key: string, value: string) => {
            window.localStorage.setItem(key, value);
            return Promise.resolve();
          },
          removeItem: async (key: string) => {
            window.localStorage.removeItem(key);
            return Promise.resolve();
          }
        };
      } else {
        throw new Error("No storage provider specified for SolanaWallet and non detected");
      }
    }

    if (typeof options.linkingProvider !== "undefined") {
      this.linking = options.linkingProvider;
    } else {
      if (typeof window !== "undefined" && typeof window.open === "function") {
        // Browser environment
        this.linking = {
          openURL: async (url: string) => {
            window.open(url, "_blank");
            return Promise.resolve();
          }
        };
      } else {
        throw new Error("No linking provider specified for SolanaWallet and non detected");
      }
    }

    // Setup linking
    let baseUrl = options.redirectUrl;
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }
    this.connectCallbackUrl = `${baseUrl}/solanawallet/onconnect`; //Linking.createURL("/solanawallet/onconnect", { scheme: options.appScheme });
    this.signMessageCallbackUrl = `${baseUrl}/solanawallet/onsignmessage`; //Linking.createURL("/solanawallet/onsignmessage", { scheme: options.appScheme });
    this.disconnectCallbackUrl = `${baseUrl}/solanawallet/ondisconnect`; //Linking.createURL("/solanawallet/ondisconnect", { scheme: options.appScheme });
    // Linking.addEventListener("url", this.handleCallback.bind(this));
    // Linking.getInitialURL().then((url) => {
    //   if (url !== null) {
    //     this.handleCallback({ url });
    //   }
    // });
  }

  async init() {
    if (this.encryptionKey === null) {
      const storedEncryptionKey = await this.storage.getItem(ENCRYPTION_KEY_STORAGE);
      if (storedEncryptionKey !== null) {
        try {
          this.encryptionKey = bs58.decode(storedEncryptionKey);
          this.encryptionPublicKey = bs58.encode(nacl.box.keyPair.fromSecretKey(this.encryptionKey).publicKey);
        } catch (e) {
        }
      }
      if (this.encryptionKey === null) {
        console.log("[SolanaWallet] generating new encryption key");
        await this.regenerateEncryptionKey();
      } else {
        await this.loadProviderSecrets();
      }
      console.log("[SolanaWallet] encryption key loaded:", this.encryptionPublicKey !== null);
    }
  }

  async regenerateEncryptionKey() {
    console.log("[SolanaWallet] regenerating encryption key");
    const keyPair = nacl.box.keyPair();
    this.encryptionKey = keyPair.secretKey;
    this.encryptionPublicKey = bs58.encode(keyPair.publicKey);
    await this.storage.setItem(ENCRYPTION_KEY_STORAGE, bs58.encode(this.encryptionKey));
  }

  private async loadProviderSecrets() {
    // Load connected wallet sessions
    this.providerSecrets = {};
    const currentWalletIndex = await this.storage.getItem(CONNECTED_WALLET_STORAGE_PREFIX + "index");
    if (currentWalletIndex !== null) {
      try {
        const walletIndex = JSON.parse(currentWalletIndex);
        if (Array.isArray(walletIndex)) {
          for (const wallet of walletIndex) {
            if (typeof wallet === "string") {
              const storedProviderSecret = await this.storage.getItem(CONNECTED_WALLET_STORAGE_PREFIX + wallet);
              if (storedProviderSecret !== null) {
                try {
                  const parsed = JSON.parse(storedProviderSecret);
                  this.providerSecrets[wallet] = {
                    provider: parsed.provider,
                    wallet: parsed.wallet,
                    session: parsed.session,
                    pubKey: bs58.decode(parsed.pubKey),
                    sharedSecret: bs58.decode(parsed.sharedSecret),
                  };
                } catch (e) {
                  console.warn(`[SolanaWallet] failed to parse stored provider secret for ${wallet}, ignoring.`);
                }
              } else {
                // TODO: remove from index
              }
            }
          }
        }
      } catch (e) {
        console.warn("[SolanaWallet] failed to parse stored wallet index, ignoring.");
      }
    }
    console.log("[SolanaWallet] loaded connected wallet sessions:", Object.keys(this.providerSecrets).join(", "));
  }

  async connect(provider: SolanaWalletProvider): Promise<SolanaWalletConnectedWallet | undefined> {
    return new Promise(async (resolve) => {
      await this.init();
      if (this.encryptionKey === null || this.encryptionPublicKey === null) {
        console.error("[SolanaWallet] encryption key is not initialized");
        resolve(undefined);
        return;
      }

      const requestId = this.requestIdCounter++;

      const connectRequest: SolanaWalletConnectRequest = {
        app_url: this.appUrl,
        dapp_encryption_public_key: this.encryptionPublicKey,
        redirect_link: this.connectCallbackUrl + `?provider=${provider}&requestId=${requestId}`,
        cluster: this.cluster,
      };

      const url = new URL(SolanaWalletProviderConfig[provider].url + "/connect");
      Object.entries(connectRequest).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.log(`[SolanaWallet] opening ${provider} URL:`, url.toString());

      try {
        // Open the wallet app
        await this.linking.openURL(url.toString());
      } catch (e) {
        console.error("[SolanaWallet] failed to open URL:", e);
        resolve(undefined);
        return;
      }

      // TODO: add timeout
      this.on("connect" + requestId.toString(), (response: ConnectEventParams) => {
        this.removeAllListeners("connect" + requestId.toString());
        if (response.error || !response.publicKey) {
          console.error("[SolanaWallet] connect error:", response.error);
          resolve(undefined);
          return;
        }
        resolve({
          provider: response.provider!,
          address: response.publicKey!
        });
      });
    });
  }

  async getConnectedWallets(): Promise<SolanaWalletConnectedWallet[]> {
    await this.init();
    const connectedWallets: SolanaWalletConnectedWallet[] = [];
    for (const address in this.providerSecrets) {
      const secret = this.providerSecrets[address];
      if (typeof secret !== "undefined") {
        connectedWallets.push({
          provider: secret.provider,
          address: secret.wallet,
        });
      }
    }
    return connectedWallets;
  }

  async disconnect(wallet: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      await this.init();
      if (this.encryptionKey === null || this.encryptionPublicKey === null) {
        console.error("[SolanaWallet] encryption key is not initialized");
        resolve(false);
        return;
      }
      if (!(wallet in this.providerSecrets)) {
        console.error(`SolanaWallet not connected to wallet ${wallet}`);
        resolve(false);
        return;
      }

      const requestId = this.requestIdCounter++;
      this.requestWalletMap[requestId] = wallet;

      const providerSecret = this.providerSecrets[wallet] as SolanaWalletProviderSecrets;

      const disconnectRequestData: SolanaWalletDisconnectRequestData = {
        session: providerSecret.session,
      }

      const [nonce, payload] = this.encrypt(disconnectRequestData, providerSecret.sharedSecret);
      const disconnectRequest: SolanaWalletDisconnectRequest = {
        dapp_encryption_public_key: this.encryptionPublicKey,
        nonce: bs58.encode(nonce),
        redirect_link: this.disconnectCallbackUrl + `?provider=${providerSecret.provider}&requestId=${requestId}`,
        payload: bs58.encode(payload),
      };

      const url = new URL(SolanaWalletProviderConfig[providerSecret.provider].url + "/disconnect");
      Object.entries(disconnectRequest).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.log(`[SolanaWallet] opening ${providerSecret.provider} URL:`, url.toString());

      try {
        // Open the wallet app
        await this.linking.openURL(url.toString());
      } catch (e) {
        console.error("[SolanaWallet] failed to open URL:", e);
        resolve(false);
        return;
      }

      // TODO: add timeout
      this.on("disconnect" + requestId, (response: DisconnectEventParams) => {
        this.removeAllListeners("disconnect" + requestId);
        if (response.error) {
          console.error("[SolanaWallet] disconnect error:", response.error);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  async signMessage(wallet: string, message: string): Promise<string | undefined> {
    return new Promise(async (resolve) => {
      await this.init();
      if (this.encryptionKey === null || this.encryptionPublicKey === null) {
        console.error("[SolanaWallet] encryption key is not initialized");
        resolve(undefined);
        return;
      }
      if (!(wallet in this.providerSecrets)) {
        console.error(`SolanaWallet not connected to wallet ${wallet}`);
        resolve(undefined);
        return;
      }

      const requestId = this.requestIdCounter++;
      this.requestWalletMap[requestId] = wallet;

      const providerSecret = this.providerSecrets[wallet] as SolanaWalletProviderSecrets;

      console.log(`[SolanaWallet] signMessage ${providerSecret.provider} pubKey: ${bs58.encode(providerSecret.pubKey)}`);
      console.log(`[SolanaWallet] signMessage ${providerSecret.provider} session: ${providerSecret.session}`);
      console.log(`[SolanaWallet] signMessage ${providerSecret.provider} sharedSecret: ${bs58.encode(providerSecret.sharedSecret)}`);

      const signMessageRequestData: SolanaWalletSignMessageRequestData = {
        message: bs58.encode(Buffer.from(message, "utf8")),
        session: providerSecret.session,
        display: "utf8",
      };
      const [nonce, payload] = this.encrypt(signMessageRequestData, providerSecret.sharedSecret);
      const signMesssageRequest: SolanaWalletSignMessageRequest = {
        dapp_encryption_public_key: this.encryptionPublicKey,
        nonce: bs58.encode(nonce),
        redirect_link: this.signMessageCallbackUrl + `?provider=${providerSecret.provider}&requestId=${requestId}`,
        payload: bs58.encode(payload),
      };

      const url = new URL(SolanaWalletProviderConfig[providerSecret.provider].url + "/signMessage");
      Object.entries(signMesssageRequest).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.log(`[SolanaWallet] opening ${providerSecret.provider} signMessage URL:`, url.toString());

      try {
        // Open the wallet app
        await this.linking.openURL(url.toString());
      } catch (e) {
        console.error("[SolanaWallet] failed to open URL:", e);
        resolve(undefined);
        return;
      }

      // TODO: add timeout
      this.on("signMessage" + requestId, (response: SignMessageEventParams) => {
        this.removeAllListeners("signMessage" + requestId);
        if (response.error) {
          console.error("[SolanaWallet] signMessage error:", response.error);
          resolve(undefined);
          return;
        }
        resolve(response.signature);
      });
    });
  }

  private encrypt(payload: any, sharedSecret: Uint8Array): [Uint8Array, Uint8Array] {
    const nonce = nacl.randomBytes(24);

    console.log("[SolanaWallet] encrypting payload", sharedSecret);
    try {
      const encryptedPayload = nacl.box.after(
        Buffer.from(JSON.stringify(payload), "utf8"),
        nonce,
        sharedSecret
      );

      return [nonce, encryptedPayload];
    } catch (e) {
      console.error("[SolanaWallet] error encrypting payload:", e);
      return [new Uint8Array(), new Uint8Array()];
    }
  }

  private decrypt<T>(payload: string, nonce: string, sharedSecret: Uint8Array): T | null {
    if (this.encryptionKey !== null) {
      try {
        const decryptedPayload = nacl.box.open.after(
          bs58.decode(payload),
          bs58.decode(nonce),
          sharedSecret
        );
        if (decryptedPayload !== null) {
          return JSON.parse(Buffer.from(decryptedPayload).toString("utf8")) as T;
        } else {
          console.warn("[SolanaWallet] failed to decrypt payload");
        }
      } catch (e) {
        console.error("[SolanaWallet] error decrypting payload:", e);
      }
    }
    return null;
  }

  private async extractCallbackParams(url: string): Promise<SolanaWalletCallbackParams | undefined> {
    await this.init();
    if (this.encryptionKey === null) {
      console.error("[SolanaWallet] encryption key is not initialized");
      return;
    }

    // Bug fix for Solflare errors not adding params to the URL properly
    if (url.includes("?errorCode=")) {
      url = url.replace("?errorCode=", "&errorCode=");
    }
    // Bug fix for Solflare adding space and duplicating params for disconnect
    if (url.includes(" ")) {
      url = url.split(" ")[0];
    }

    const params = new URL(url).searchParams;
    console.log("[SolanaWallet] handling callback", url, params.toString());

    if (!params.has("provider") || !params.has("requestId")) {
      console.error("[SolanaWallet] callback missing provider or requestId");
      return;
    }

    const extractedParams: SolanaWalletCallbackParams = {
      provider: params.get("provider") as SolanaWalletProvider,
      requestId: params.get("requestId") || "",
    };
    for (const param of params) {
      extractedParams[param[0]] = param[1];
    }

    return extractedParams;
  }

  private isErrorCallback(params: SolanaWalletCallbackParams, eventName: string): boolean {
    if (typeof params.errorCode !== "undefined") {
      console.error(`[SolanaWallet] ${eventName} response error:`, params.errorCode, params.errorMessage);
      this.emit(eventName + params.requestId, {
        error: {
          code: params.errorCode,
          message: params.errorMessage || "",
        }
      });
      return true;
    }
    return false;
  }

  getCallbackHandler() {
    return this.handleCallback.bind(this);
  }

  private async handleCallback(url: string): Promise<void> {
    if (url.startsWith(this.connectCallbackUrl)) {
      await this.handleOnConnectCallback(url);
    } else if (url.startsWith(this.signMessageCallbackUrl)) {
      await this.handleOnSignMessageCallback(url);
    } else if (url.startsWith(this.disconnectCallbackUrl)) {
      await this.handleOnDisconnectCallback(url);
    }
  }

  private async handleOnConnectCallback(url: string): Promise<void> {
    const params = await this.extractCallbackParams(url);
    if (typeof params !== "undefined" && !this.isErrorCallback(params, "connect")) {
      if ((
        (params.provider === SolanaWalletProvider.PHANTOM && typeof params.phantom_encryption_public_key === "string")
        || (params.provider === SolanaWalletProvider.SOLFLARE && typeof params.solflare_encryption_public_key === "string")
      ) && typeof params.nonce === "string" && typeof params.data === "string") {
        try {
          const encryption_public_key = bs58.decode(params.phantom_encryption_public_key || params.solflare_encryption_public_key || "");

          console.log(`[SolanaWallet] connect ${params.provider} key: ${bs58.encode(encryption_public_key)}`);
          console.log(this);

          const sharedSecret = nacl.box.before(
            encryption_public_key,
            this.encryptionKey!
          );

          const data = this.decrypt<SolanaWalletConnectData>(params.data, params.nonce, sharedSecret);
          if (data !== null) {
            console.log(`[SolanaWallet] connect ${params.provider} session: ${data.session}`);
            console.log(`[SolanaWallet] connect ${params.provider} sharedSecret: ${bs58.encode(sharedSecret)}`);
            // Store the connected wallet session
            this.providerSecrets[data.public_key] = {
              provider: params.provider,
              wallet: data.public_key,
              session: data.session,
              pubKey: encryption_public_key,
              sharedSecret: sharedSecret,
            };
            const storedData = JSON.stringify({
              provider: params.provider,
              wallet: data.public_key,
              session: data.session,
              pubKey: bs58.encode(encryption_public_key),
              sharedSecret: bs58.encode(sharedSecret),
            });
            // Update the wallet index
            const walletIndex: string[] = [];
            const currentWalletIndex = await this.storage.getItem(CONNECTED_WALLET_STORAGE_PREFIX + "index");
            if (currentWalletIndex !== null) {
              try {
                const parsed = JSON.parse(currentWalletIndex);
                if (Array.isArray(parsed)) {
                  for (const w of parsed) {
                    if (typeof w === "string") {
                      walletIndex.push(w);
                    }
                  }
                }
              } catch (e) {
                console.warn("[SolanaWallet] failed to parse stored wallet index, ignoring.");
              }
            }
            if (!walletIndex.includes(data.public_key)) {
              walletIndex.push(data.public_key);
              await this.storage.setItem(CONNECTED_WALLET_STORAGE_PREFIX + "index", JSON.stringify(walletIndex));
            }
            await this.storage.setItem(CONNECTED_WALLET_STORAGE_PREFIX + data.public_key, storedData);
            this.emit("connect" + params.requestId, {
              provider: params.provider,
              publicKey: data.public_key,
            });
            return;
          } else {
            console.error(`[SolanaWallet] failed to decrypt connect ${params.provider} response`);
          }
        } catch (e) {
          console.error("[SolanaWallet] error handling connect callback:", e);
        }
      }

      console.error(`[SolanaWallet] connect response from ${params.provider} could not be processed`);
      this.emit("connect" + params.requestId, {
        error: {
          code: "unknown_error",
          message: "Unknown error for connect response"
        }
      });
    }
  }

  private async handleOnDisconnectCallback(url: string): Promise<void> {
    const params = await this.extractCallbackParams(url);
    if (typeof params !== "undefined" && !this.isErrorCallback(params, "disconnect")) {
      const wallet = this.requestWalletMap[parseInt(params.requestId)];
      if (typeof wallet === "undefined" || !(wallet in this.providerSecrets)) {
        console.error(`[SolanaWallet] disconnect response for unknown wallet: ${wallet}`);
        this.emit("disconnect" + params.requestId, {
          error: {
            code: "unknown_wallet",
            message: "Unknown wallet for disconnect response"
          }
        });
        return;
      }
      delete this.requestWalletMap[parseInt(params.requestId)];

      const currentWalletIndex = await this.storage.getItem(CONNECTED_WALLET_STORAGE_PREFIX + "index");
      if (currentWalletIndex !== null) {
        try {
          const parsed = JSON.parse(currentWalletIndex);
          const walletIndex: string[] = parsed.filter((w: string) => w !== wallet);
          await this.storage.setItem(CONNECTED_WALLET_STORAGE_PREFIX + "index", JSON.stringify(walletIndex));
        } catch (e) {
          console.warn("SolanaWallet failed to parse stored wallet index, ignoring.");
          await this.storage.setItem(CONNECTED_WALLET_STORAGE_PREFIX + "index", JSON.stringify([]));
        }
      }
      await this.storage.removeItem(CONNECTED_WALLET_STORAGE_PREFIX + wallet);
      delete this.providerSecrets[wallet];

      this.emit("disconnect" + params.requestId, {
        provider: params.provider,
        publicKey: wallet,
      });

      return;
    }

    if (typeof params !== "undefined") {
      console.error(`[SolanaWallet] disconnect response from ${params.provider} could not be processed`);
      this.emit("disconnect" + params.requestId, {
        error: {
          code: "unknown_error",
          message: "Unknown error for disconnect response"
        }
      });
    }
  }

  private async handleOnSignMessageCallback(url: string): Promise<void> {
    const params = await this.extractCallbackParams(url);
    if (typeof params !== "undefined" && !this.isErrorCallback(params, "signMessage")) {
      if (typeof params.nonce === "string" && typeof params.data === "string") {
        // We need to find which wallet this response is for
        const wallet = this.requestWalletMap[parseInt(params.requestId)];
        if (typeof wallet === "undefined" || !(wallet in this.providerSecrets)) {
          console.error(`[SolanaWallet] signMessage response for unknown wallet: ${wallet}`);
          this.emit("signMessage" + params.requestId, {
            error: {
              code: "unknown_wallet",
              message: "Unknown wallet for signMessage response"
            }
          });
          return;
        }
        delete this.requestWalletMap[parseInt(params.requestId)];

        const providerSecret = this.providerSecrets[wallet] as SolanaWalletProviderSecrets;
        const data = this.decrypt<SolanaWalletSignMessageResponseData>(params.data, params.nonce, providerSecret.sharedSecret);
        if (data !== null) {
          console.log(`SolanaWallet signMessage response from ${wallet}:`, data);
          // Here you can handle the signed message (data.signature)
          this.emit("signMessage" + params.requestId, {
            provider: params.provider,
            signature: data.signature
          });
          return;
        }

        console.error("[SolanaWallet] failed to decrypt signMessage response with any known provider");
      }

      console.error(`[SolanaWallet] signMessage response from ${params.provider} could not be processed`);
      this.emit("signMessage" + params.requestId, {
        error: {
          code: "unknown_error",
          message: "Unknown error for signMessage response"
        }
      });
    }
  }
}
