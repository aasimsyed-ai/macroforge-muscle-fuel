import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { guestActive, guestExpired, migrateGuestToCloud } from "@/lib/guest";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user) {
      // A signed-in user who still has local guest data: migrate it once.
      if (guestActive()) {
        try {
          await migrateGuestToCloud();
        } catch {
          // leave the local copy in place if the upload failed
        }
      }
      return { user: data.user, guest: false };
    }

    // No account — allow the local trial until it runs out.
    if (guestActive() && !guestExpired()) {
      return { user: null, guest: true };
    }

    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
