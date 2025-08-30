import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: [
    "react", 
    "react-native", 
    "expo-linking", 
    "expo-router", 
    "expo-secure-store", 
  ],
  // noExternal: ["react-native-get-random-values"],
});