import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { fetchWhatsAppPreferences, saveWhatsAppPreferences } from "@/lib/whatsapp/api";
import { WHATSAPP_DELIVERY_ENABLED } from "@/lib/whatsapp/provider";
import type { WhatsAppPreferencesView } from "@/lib/whatsapp/types";

const KEY = ["whatsapp", "preferences"] as const;

export function WhatsAppSettings() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: KEY, queryFn: fetchWhatsAppPreferences });
  const save = useMutation({
    mutationFn: (patch: Partial<WhatsAppPreferencesView>) => saveWhatsAppPreferences(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const [form, setForm] = useState({
    phoneNumber: "",
    notificationsEnabled: false,
    enableProgress: true,
    enableWorkoutGuidance: true,
    enableRecovery: true,
    enableSafety: true,
    quietStart: "",
    quietEnd: "",
  });

  useEffect(() => {
    const data = prefs.data;
    if (!data) return;
    setForm({
      phoneNumber: data.phoneNumber ?? "",
      notificationsEnabled: data.notificationsEnabled,
      enableProgress: data.enableProgress,
      enableWorkoutGuidance: data.enableWorkoutGuidance,
      enableRecovery: data.enableRecovery,
      enableSafety: data.enableSafety,
      quietStart: data.quietHoursStart?.slice(0, 5) ?? "",
      quietEnd: data.quietHoursEnd?.slice(0, 5) ?? "",
    });
  }, [prefs.data]);

  async function submit() {
    try {
      await save.mutateAsync({
        phoneNumber: form.phoneNumber.trim() || null,
        notificationsEnabled: form.notificationsEnabled,
        enableProgress: form.enableProgress,
        enableWorkoutGuidance: form.enableWorkoutGuidance,
        enableRecovery: form.enableRecovery,
        enableSafety: form.enableSafety,
        quietHoursStart: form.quietStart ? `${form.quietStart}:00` : null,
        quietHoursEnd: form.quietEnd ? `${form.quietEnd}:00` : null,
      });
      toast.success("WhatsApp preferences saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preferences");
    }
  }

  if (prefs.isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  const categoryToggles: {
    key: "enableProgress" | "enableWorkoutGuidance" | "enableRecovery" | "enableSafety";
    label: string;
  }[] = [
    { key: "enableProgress", label: "Progress updates" },
    { key: "enableWorkoutGuidance", label: "Workout guidance" },
    { key: "enableRecovery", label: "Recovery" },
    { key: "enableSafety", label: "Safety & health awareness" },
  ];

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">WhatsApp updates</p>
        <Badge variant="outline">{WHATSAPP_DELIVERY_ENABLED ? "Active" : "Not connected"}</Badge>
      </div>

      <p className="rounded-md bg-secondary p-2 text-[11px] text-muted-foreground">
        WhatsApp delivery will be available after the WhatsApp Business connection and message-template
        approval are completed. This uses the official WhatsApp Business Cloud API only — no personal
        number, and access tokens live server-side.
      </p>

      <div className="space-y-1">
        <Label htmlFor="wa-phone" className="text-xs">
          Phone number (with country code)
        </Label>
        <Input
          id="wa-phone"
          type="tel"
          inputMode="tel"
          placeholder="+91 98765 43210"
          value={form.phoneNumber}
          onChange={(event) => setForm((c) => ({ ...c, phoneNumber: event.target.value }))}
        />
      </div>

      <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2">
        <div>
          <Label htmlFor="wa-enabled" className="text-sm">
            Send me WhatsApp updates
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Opt-in only. You can turn this off any time; doing so records a revoke.
          </p>
        </div>
        <Switch
          id="wa-enabled"
          checked={form.notificationsEnabled}
          onCheckedChange={(checked) => setForm((c) => ({ ...c, notificationsEnabled: checked }))}
        />
      </div>

      <div className="space-y-2">
        {categoryToggles.map((toggle) => (
          <div
            key={toggle.key}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <Label htmlFor={toggle.key} className="text-sm">
              {toggle.label}
            </Label>
            <Switch
              id={toggle.key}
              checked={form[toggle.key]}
              onCheckedChange={(checked) => setForm((c) => ({ ...c, [toggle.key]: checked }))}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="wa-quiet-start" className="text-xs">
            Quiet hours start
          </Label>
          <Input
            id="wa-quiet-start"
            type="time"
            value={form.quietStart}
            onChange={(event) => setForm((c) => ({ ...c, quietStart: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wa-quiet-end" className="text-xs">
            Quiet hours end
          </Label>
          <Input
            id="wa-quiet-end"
            type="time"
            value={form.quietEnd}
            onChange={(event) => setForm((c) => ({ ...c, quietEnd: event.target.value }))}
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Delivery status: <strong>disabled</strong> — no messages are sent until the WhatsApp Business
        connection and approved templates are in place.
      </p>

      <Button
        type="button"
        onClick={submit}
        disabled={save.isPending}
        className="w-full sm:w-auto"
      >
        {save.isPending ? "Saving…" : "Save WhatsApp preferences"}
      </Button>
    </div>
  );
}
