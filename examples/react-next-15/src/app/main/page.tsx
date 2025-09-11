"use client"

import SampleActions from "@/components/SampleActions";
import { WalletDisconnectButton, WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function MainPage() {
  return (
    <>
      <div className="text-2xl mb-4 font-bold">Deeplink wallet demo app</div>
      <div className="text-sm text-start px-4">
        <p className="mb-2">1️⃣ From a mobile browser, connect to <strong>Solflare APP</strong> or <strong>Phantom APP</strong>.</p>
        <p className="mb-2">2️⃣ Try signing a message first.</p>
        <p className="mb-2">3️⃣ To sign a transactions you need to first create the tx which creates a simple memo tx with latest blockhash, then sign it. <strong>The transaction is not sent to the network</strong> but you still need to have a bit of SOL so that wallet simulation works.</p>
      </div>
      <WalletMultiButton />
      <WalletDisconnectButton />
      <SampleActions />
    </>
  )
}