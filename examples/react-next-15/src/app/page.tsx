"use client"

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {

  const router = useRouter();

  // Redirect to /main
  useEffect(() => {
    router.replace("/main");
  }, [router]);
  

  return null;
}
