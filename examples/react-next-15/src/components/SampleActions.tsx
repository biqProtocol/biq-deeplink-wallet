"use client"

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Button from "./ui/Button";
import { useCallback, useEffect, useState } from "react";
import bs58 from "bs58";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export default function SampleActions() {
  const [lastSignedMessage, setLastSignedMessage] = useState<string | null>(null);
  const [lastSignedMessageSignature, setLastSignedMessageSignature] = useState<string | null>(null);
  const [lastSignedTransactionSignature, setLastSignedTransactionSignature] = useState<string | null>(null);
  const [createdTransaction, setCreatedTransaction] = useState<Transaction | null>(null);

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

  // iOS does not seem to like network calls being made between user interaction and opening an url
  // so we need to create the transaction first and then sign it
  const handleCreateTransaction = useCallback(async () => {
    if (!publicKey) {
      alert("Wallet not connected!");
      return;
    }

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
      setCreatedTransaction(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      alert("Failed to create transaction!");
    }

  }, [publicKey]);

  const handleSignTransaction = useCallback(async () => {
    if (!publicKey) {
      alert("Wallet not connected!");
      return;
    }
    if (!signTransaction) {
      alert("Wallet does not support transaction signing!");
      return;
    }
    if (!createdTransaction) {
      alert("Please create a transaction first!");
      return;
    }

    setLastSignedTransactionSignature(null);

    try {
      const transaction = createdTransaction;

      const signedTransaction = await signTransaction(transaction);
      const signature = bs58.encode(signedTransaction.signature!);

      setLastSignedTransactionSignature(signature);
      setCreatedTransaction(null);
    } catch (error) {
      console.error("Error signing transaction:", error);
      alert("Failed to sign transaction!");
    }
  }, [publicKey, signTransaction, createdTransaction]);

  useEffect(() => {
    // Clear created transaction if wallet gets disconnected
    if (!publicKey) {
      setCreatedTransaction(null);
      setLastSignedMessage(null);
      setLastSignedMessageSignature(null);
      setLastSignedTransactionSignature(null);
    }
  }, [publicKey]);

  return (
    <>
      {publicKey ? (
        <>
          <Button className="bg-cyan-500 text-white" onClick={handleSignMessage}>
            Sign message
          </Button>
          <div className="break-words w-full px-4 text-sm">
            {lastSignedMessage ? (
              <>
                <strong>Last signed message:</strong> {lastSignedMessage}
                <br />
                <strong>Signature:</strong> {lastSignedMessageSignature}
              </>
            ) : null}
          </div>
          <Button className="bg-cyan-500 text-white" onClick={handleCreateTransaction} disabled={!!createdTransaction}>
            Create transaction
          </Button>
          <Button className="bg-cyan-500 text-white" onClick={handleSignTransaction} disabled={!createdTransaction}>
            Sign transaction
          </Button>
          <div className="break-words w-full overflow-ellipsis px-4 text-sm">
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