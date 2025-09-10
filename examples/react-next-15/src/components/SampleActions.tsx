"use client"

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Button from "./ui/Button";
import { useCallback, useState } from "react";
import bs58 from "bs58";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export default function SampleActions() {
  const [lastSignedMessage, setLastSignedMessage] = useState<string | null>(null);
  const [lastSignedMessageSignature, setLastSignedMessageSignature] = useState<string | null>(null);
  const [lastSignedTransactionSignature, setLastSignedTransactionSignature] = useState<string | null>(null);

  const { connection } = useConnection();
  const { publicKey, signMessage, signTransaction } = useWallet();

  const handleSignMessage = useCallback(async () => {
    if (!publicKey) {
      alert("Wallet not connected!");
      return;
    }
    if (!signMessage) {
      alert("Wallet does not support message signing!");
      return;
    }

    setLastSignedMessage(null);
    setLastSignedMessageSignature(null);

    try {
      const message = `Hello, Solana! - ${new Date().toISOString()}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await signMessage(encodedMessage);
      const signature = bs58.encode(signedMessage);
      setLastSignedMessage(message);
      setLastSignedMessageSignature(signature);
    } catch (error) {
      setLastSignedMessage("Error signing messsage");
      console.error("Error signing message:", error);
    }
  }, [publicKey, signMessage]);

  const handleSignTransaction = useCallback(async () => {
    if (!publicKey) {
      alert("Wallet not connected!");
      return;
    }
    if (!signTransaction) {
      alert("Wallet does not support transaction signing!");
      return;
    }

    setLastSignedTransactionSignature(null);

    try {
      // Create a simple memo transaction
      const transaction = new Transaction();
      transaction.feePayer = publicKey;
      transaction.add(new TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: false }
        ],
        data: Buffer.from("Hello, Biq Wallet!\n" + new Date().toISOString(), "utf8"),
        programId: MEMO_PROGRAM
      }));
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signedTransaction = await signTransaction(transaction);
      const signature = bs58.encode(signedTransaction.signature!);

      setLastSignedTransactionSignature(signature);
    } catch (error) {
      console.error("Error signing transaction:", error);
      alert("Failed to sign transaction!");
    }
  }, [publicKey, signTransaction, connection]);

  return (
    <>
      {publicKey ? (
        <>
          <Button className="bg-cyan-500 text-white" onClick={handleSignMessage}>
            Sign message
          </Button>
          <div className="break-words w-full px-4">
            {lastSignedMessage ? (
              <>
                <strong>Last signed message:</strong> {lastSignedMessage}
                <br />
                <strong>Signature:</strong> {lastSignedMessageSignature}
              </>
            ) : null}
          </div>
          <Button className="bg-cyan-500 text-white" onClick={handleSignTransaction}>
            Sign transaction
          </Button>
          <div className="break-words w-full overflow-ellipsis px-4">
            {lastSignedTransactionSignature ? (
              <>
                <strong>Last signed transaction signature:</strong> <code>{lastSignedTransactionSignature}</code>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}