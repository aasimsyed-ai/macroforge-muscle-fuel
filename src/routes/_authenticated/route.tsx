import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { guestActive, guestExpired, migrateGuestToCloud } from "@/lib/guest";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() resolves only after the client has finished restoring the
    // stored session and processing any auth redirect in the URL, and reads
    // it locally. getUser() is a network round-trip whose transient failure
    // used to be treated as "logged out" and bounced a signed-in user to the
    // sign-up page. Data access is still enforced server-side by RLS.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;

    if (user) {
      // A signed-in user who still has local guest data: migrate it once.
      if (guestActive()) {
        try {
          await migrateGuestToCloud();
        } catch {
          // leave the local copy in place if the upload failed
        }
      }
      return { user, guest: false };
    }

    // No account — allow the local trial until it runs out.
    if (guestActive() && !guestExpired()) {
      return { user: null, guest: true };
    }

    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
