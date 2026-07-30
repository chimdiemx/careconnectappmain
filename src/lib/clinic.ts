export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const statusLabel: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export const statusTone: Record<AppointmentStatus, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  confirmed: "bg-accent text-accent-foreground",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  no_show: "bg-warning/20 text-warning-foreground",
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Build the bookable slots for a doctor on a given date from their weekly availability. */
export function buildSlots(start: string, end: string, slotMinutes: number) {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cursor = sh * 60 + sm;
  const limit = eh * 60 + em;
  while (cursor + slotMinutes <= limit) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    cursor += slotMinutes;
  }
  return slots;
}

export function fullName(p?: { first_name?: string | null; last_name?: string | null } | null) {
  if (!p) return "Unknown";
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return name || "Unnamed patient";
}