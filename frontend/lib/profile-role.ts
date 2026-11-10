"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/user";

type ProfileRole = {
  role: Role | null; // null when the role could not be read
  ready: boolean; // false while it is loading
};

// The signed-in user's role, read from the profiles table.
export function useProfileRole(): ProfileRole {
  const [state, setState] = useState<ProfileRole>({ role: null, ready: false });

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let role: Role | null = null;

      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("userID", user.id)
          .single();
        if (error) console.error("Profile role error:", error.message);
        if (data?.role === "homeowner" || data?.role === "architect") role = data.role;
      }
      if (active) setState({ role, ready: true });
    }

    load().catch((error: unknown) => {
      console.error("Profile role error:", error);
      if (active) setState({ role: null, ready: true });
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
