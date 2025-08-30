import { trimAddress } from "@/lib/utils";
import { SolanaWalletConnectedWallet, SolanaWalletContext, SolanaWalletProvider } from "@biqprotocol/wallet-react-native";
import { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function IndexScreen() {
  const [connectedWallets, setConnectedWallets] = useState<SolanaWalletConnectedWallet[]>([]);

  const { solanaWallet } = useContext(SolanaWalletContext);

  /**
   * Get a list of connected wallets
   */
  const handleGetConnectedWallets = useCallback(async () => {
    try {
      const wallets = await solanaWallet!.getConnectedWallets();
      setConnectedWallets(wallets);
      console.log("Connected wallets:", wallets);
    } catch (error) {
      console.error("Error getting connected wallets:", error);
    }
  }, [solanaWallet]);

  /**
   * Connect to a wallet
   */
  const handleConnectWallet = useCallback(async (provider: SolanaWalletProvider) => {
    try {
      const wallet = await solanaWallet!.connect(provider);
      console.log("Connected wallet:", wallet);
      await handleGetConnectedWallets();
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  }, [solanaWallet, handleGetConnectedWallets]);

  const handleDisconnectWallet = useCallback(async (wallet: string) => {
    try {
      await solanaWallet!.disconnect(wallet);
      console.log("Disconnected wallet");
      await handleGetConnectedWallets();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  }, [solanaWallet, handleGetConnectedWallets]);

  const handleSignMessage = useCallback(async (wallet: string) => {
    try {
      const message = "Hello, Biq Wallet!\n" + new Date().toISOString();
      const signature = await solanaWallet!.signMessage(wallet, message);
      console.log("Signature:", signature);
      Alert.alert("Signature", signature);
    } catch (error) {
      console.error("Error signing message:", error);
    }
  }, [solanaWallet]);

  /**
   * Get connected wallets at startup
   */
  useEffect(() => {
    if (solanaWallet !== null) {
      handleGetConnectedWallets();
    }
  }, [solanaWallet, handleGetConnectedWallets]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.title}>Welcome to Biq Wallet!</Text>

        <Button title="Get connected wallets" onPress={handleGetConnectedWallets} />

        <Button title="Connect Solflare Wallet" onPress={() => handleConnectWallet(SolanaWalletProvider.SOLFLARE)} />

        <Button title="Connect Phantom Wallet" onPress={() => handleConnectWallet(SolanaWalletProvider.PHANTOM)} />

        {connectedWallets.length > 0 ? (
          <>
            <Text style={styles.subtitle}>Connected Wallets:</Text>
            {connectedWallets.map((wallet) => (
              <View key={wallet.address} style={{ gap: 10 }}>
                <Text style={styles.wallet}>{trimAddress(wallet.address)}</Text>
                <Button title={`Sign message`} color="green" onPress={() => handleSignMessage(wallet.address)}></Button>
                <Button title={`Disconnect`} color="#991c1c" onPress={() => handleDisconnectWallet(wallet.address)} />
              </View>
            ))}
          </>
        ) : (
          <Text>No connected wallets</Text>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'blue',
    paddingTop: 30,
  },
  content: {
    flexGrow: 1,
    gap: 20,
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  wallet: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold'
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
