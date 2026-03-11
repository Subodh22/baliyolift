import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

let cachedUserId: Id<"users"> | null = null;

function useClerkUser() {
  if (Platform.OS === "web") {
    const { useUser } = require("@clerk/clerk-react");
    return useUser();
  }
  const { useUser } = require("@clerk/clerk-expo");
  return useUser();
}

export function useCurrentUser() {
  const createOrGet = useMutation(api.users.createOrGetUser);
  const [userId, setUserId] = useState<Id<"users"> | null>(cachedUserId);
  const [loading, setLoading] = useState(!cachedUserId);
  const initialized = useRef(!!cachedUserId);

  const { user, isLoaded } = useClerkUser();
  const clerkId = user?.id ?? null;
  const clerkName = user?.fullName ?? "Athlete";

  useEffect(() => {
    if (!isLoaded || !clerkId) return;
    if (initialized.current) return;
    initialized.current = true;

    createOrGet({ clerkId, name: clerkName, experienceLevel: "intermediate", unitSystem: "kg" })
      .then((id) => {
        cachedUserId = id as Id<"users">;
        setUserId(id as Id<"users">);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isLoaded, clerkId]);

  return { userId, loading };
}
