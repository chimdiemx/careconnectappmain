import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellRing, CheckCheck, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchNotifications,
  fetchPatients,
  markAllNotificationsRead,
  markNotificationRead,
  sendNotification,
} from "@/lib/queries";
import { fullName } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — CareConnect" },
      {
        name: "description",
        content: "Appointment reminders, clinic announcements and alerts for patients, doctors and staff.",
      },
      { property: "og:title", content: "Notifications — CareConnect" },
      { property: "og:description", content: "Stay updated on appointments and clinic announcements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

const TYPE_TONE: Record<string, string> = {
  info: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  alert: "bg-destructive/10 text-destructive",
};

function relative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function NotificationsPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = hasRole("admin", "doctor", "receptionist");
  const [tab, setTab] = useState<"all" | "unread">("all");

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    enabled: Boolean(user),
  });

  const items = notificationsQuery.data ?? [];
  const unread = items.filter((n) => !n.is_read);
  const shown = tab === "unread" ? unread : items;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const toggleRead = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) => markNotificationRead(id, isRead),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => {
      invalidate();
      toast.success("All notifications marked as read");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="mt-1 text-muted-foreground">
            {unread.length > 0
              ? `${unread.length} unread ${unread.length === 1 ? "update" : "updates"}`
              : "You're all caught up"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAll.mutate()}
          disabled={unread.length === 0 || markAll.isPending}
        >
          <CheckCheck className="mr-2 size-4" /> Mark all read
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-primary" /> Inbox
          </CardTitle>
          <CardDescription>Appointment reminders, status changes and clinic announcements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notificationsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading notifications…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications to show.</p>
          ) : (
            shown.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 transition-colors duration-[var(--dur-fast)] ${
                  n.is_read ? "border-border" : "border-primary/40 bg-primary/5"
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <Badge className={TYPE_TONE[n.type] ?? TYPE_TONE.info} variant="secondary">
                      {n.type}
                    </Badge>
                    {!n.is_read ? <span className="size-2 rounded-full bg-primary" aria-label="Unread" /> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground">{relative(n.created_at)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleRead.mutate({ id: n.id, isRead: !n.is_read })}
                  disabled={toggleRead.isPending}
                >
                  {n.is_read ? "Unread" : "Read"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {isStaff ? <Composer /> : null}
    </div>
  );
}

function Composer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");

  const patientsQuery = useQuery({ queryKey: ["patients", "notify"], queryFn: () => fetchPatients() });
  const patients = useMemo(
    () => (patientsQuery.data ?? []).filter((p) => p.id !== user?.id),
    [patientsQuery.data, user?.id],
  );

  const send = useMutation({
    mutationFn: () =>
      sendNotification({
        userIds: recipient === "all" ? patients.map((p) => p.id) : [recipient],
        title: title.trim(),
        message: message.trim(),
        type,
      }),
    onSuccess: () => {
      toast.success("Notification sent");
      setTitle("");
      setMessage("");
      setRecipient("");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend = recipient !== "" && title.trim().length > 1 && message.trim().length > 2;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4 text-primary" /> Send a notification
        </CardTitle>
        <CardDescription>Notify a single patient or broadcast an announcement to everyone</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Recipient</Label>
          <Select value={recipient} onValueChange={setRecipient}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a recipient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All patients ({patients.length})</SelectItem>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {fullName(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="alert">Alert</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notif-title">Title</Label>
          <Input
            id="notif-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Clinic closed on Friday"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notif-message">Message</Label>
          <Textarea
            id="notif-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Details the recipient should know…"
            rows={3}
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => send.mutate()} disabled={!canSend || send.isPending}>
            <Send className="mr-2 size-4" /> {send.isPending ? "Sending…" : "Send notification"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
