"use client"

import { PropsWithChildren } from "react";

export default function Button({ children, className, ...props }: PropsWithChildren<{ className?: string, [x: string]: unknown }>) {
  return (
    <button className={`px-4 py-2 font-semibold text-lg rounded-full shadow-sm ${className}`} {...props}>
      {children}
    </button>
  );
}