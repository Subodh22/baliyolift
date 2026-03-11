import { Platform } from "react-native";

// Web: use localStorage (Clerk on web handles sessions via cookies anyway)
// Native: use expo-secure-store
export const tokenCache = Platform.OS === "web"
  ? {
      getToken: (key: string) => Promise.resolve(localStorage.getItem(key)),
      saveToken: (key: string, value: string) => { localStorage.setItem(key, value); return Promise.resolve(); },
      clearToken: (key: string) => { localStorage.removeItem(key); return Promise.resolve(); },
    }
  : (() => {
      const SecureStore = require("expo-secure-store");
      return {
        getToken: (key: string) => SecureStore.getItemAsync(key),
        saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        clearToken: (key: string) => SecureStore.deleteItemAsync(key),
      };
    })();
