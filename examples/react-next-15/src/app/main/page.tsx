"use client"

import SampleActions from "@/components/SampleActions";
import { WalletDisconnectButton, WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function MainPage() {
  return (
    <>
      <WalletMultiButton />
      <WalletDisconnectButton />
      <SampleActions />
    </>
  )
}