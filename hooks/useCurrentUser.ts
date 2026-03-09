import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";

// Stable device ID for development — replace with real auth (Clerk) later
const DEV_CLERK_ID = "local-dev-user-001";

// Module-level cache so multiple hook instances share the same userId
let cachedUserId: Id<"users"> | null = null;

export function useCurrentUser() {
  const createOrGet = useMutation(api.users.createOrGetUser);
  const [userId, setUserId] = useState<Id<"users"> | null>(cachedUserId);
  const [loading, setLoading] = useState(!cachedUserId);
  const initialized = useRef(!!cachedUserId);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    createOrGet({
      clerkId: DEV_CLERK_ID,
      name: "Athlete",
      experienceLevel: "intermediate",
      unitSystem: "kg",
    })
      .then((id) => {
        cachedUserId = id as Id<"users">;
        setUserId(id as Id<"users">);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [createOrGet]);

  return { userId, loading };
}
