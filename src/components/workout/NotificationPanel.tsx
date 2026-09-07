import { formatDistanceToNow } from "date-fns";
import { Check, CheckCheck, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/workouts/hooks";

const CATEGORY_LABEL: Record<string, string> = {
  progress: "Progress",
  motivation: "Motivation",
  workout_guidance: "Guidance",
  progression: "Progression",
  nutrition: "Nutrition",
  recovery: "Recovery",
  safety: "Safety",
  wearable: "Wearable",
  system: "System",
};

export function NotificationPanel() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();

  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.is_read).length;

  return (
    <div className="w-[min(20rem,calc(100vw-2rem))]">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">Notifications</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="size-3.5" /> Mark all read
        </Button>
      </div>

      <ScrollArea className="max-h-80">
        {notifications.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : notifications.isError ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Could not load notifications.
          </p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">
            You are all caught up. Insights appear here as your training history grows.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.id}
                className={`px-3 py-2.5 ${item.is_read ? "opacity-70" : "bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </Badge>
                      <span className="text-xs font-semibold">{item.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!item.is_read ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label="Mark as read"
                        onClick={() => markRead.mutate(item.id)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label="Dismiss"
                      onClick={() => dismiss.mutate(item.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
