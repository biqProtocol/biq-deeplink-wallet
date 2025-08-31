import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const solanaConnection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

export function trimAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export async function createMemoTransaction(wallet: string): Promise<Transaction> {
  const transaction = new Transaction();
  const walletPublicKey = new PublicKey(wallet);
  transaction.feePayer = walletPublicKey;
  transaction.add(new TransactionInstruction({
    keys: [
      { pubkey: walletPublicKey, isSigner: true, isWritable: false }
    ],
    data: Buffer.from("Hello, Biq Wallet!\n" + new Date().toISOString(), "utf8"),
    programId: MEMO_PROGRAM
  }));
  transaction.recentBlockhash = (await solanaConnection.getLatestBlockhash()).blockhash;
  return transaction;
}