import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchAppointments, fetchProfilesByIds, notify } from "@/lib/queries";
import {
  APPOINTMENT_STATUSES,
  formatDate,
  formatTime,
  fullName,
  statusLabel,
  statusTone,
  todayISO,
} from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — CareConnect" },
      { name: "description", content: "View, reschedule, cancel and update the status of clinic appointments." },
      { property: "og:title", content: "Appointments — CareConnect" },
      { property: "og:description", content: "Manage every booking in the CareConnect clinic schedule." },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { user, doctorId, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const isPatientOnly = !hasRole("admin", "doctor", "receptionist");
  const isDoctorOnly = hasRole("doctor") && !hasRole("admin", "receptionist");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [rescheduling, setRescheduling] = useState<{ id: string; date: string; time: string; patient: string } | null>(
    null,
  );

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "list", user?.id, doctorId, isPatientOnly, isDoctorOnly],
    queryFn: () =>
      fetchAppointments(isPatientOnly ? { patientId: user!.id } : isDoctorOnly && doctorId ? { doctorId } : {}),
    enabled: Boolean(user),
  });

  const rows = (appointmentsQuery.data ?? []).filter(
    (a) => (statusFilter === "all" || a.status === statusFilter) && (!dateFilter || a.appointment_date === dateFilter),
  );

  const patientsQuery = useQuery({
    queryKey: ["profiles", "appointments", rows.map((r) => r.patient_id).join(",")],
    queryFn: () => fetchProfilesByIds(rows.map((r) => r.patient_id)),
    enabled: !isPatientOnly && rows.length > 0,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, patientId }: { id: string; status: string; patientId: string }) => {
      const { error } = await supabase.from("appointments").update({ status } as never).eq("id", id);
      if (error) throw new Error(error.message);
      await notify(
        patientId,
        `Appointment ${statusLabel[status as keyof typeof statusLabel].toLowerCase()}`,
        `The status of your appointment was updated to ${statusLabel[status as keyof typeof statusLabel]}.`,
        status === "cancelled" ? "warning" : "info",
      );
    },
    onSuccess: () => {
      toast.success("Appointment updated");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!rescheduling) return;
      if (rescheduling.date < todayISO()) throw new Error("Pick a future date");
      const { error } = await supabase
        .from("appointments")
        .update({
          appointment_date: rescheduling.date,
          appointment_time: rescheduling.time,
          status: "scheduled",
        } as never)
        .eq("id", rescheduling.id);
      if (error) {
        if (error.code === "23505") throw new Error("That doctor already has a booking at that time.");
        throw new Error(error.message);
      }
      await notify(
        rescheduling.patient,
        "Appointment rescheduled",
        `Your appointment moved to ${rescheduling.date} at ${formatTime(rescheduling.time)}.`,
      );
    },
    onSuccess: () => {
      toast.success("Appointment rescheduled");
      setRescheduling(null);
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Appointments</h1>
          <p className="mt-1 text-muted-foreground">
            {isPatientOnly ? "Your bookings with CareConnect doctors" : "Clinic-wide appointment schedule"}
          </p>
        </div>
        {hasRole("patient", "admin", "receptionist") ? (
          <Button asChild>
            <Link to="/app/book">New appointment</Link>
          </Button>
        ) : null}
      </header>

      <Card className="shadow-card">
        <CardHeader className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {APPOINTMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-filter">Date</Label>
            <Input
              id="date-filter"
              type="date"
              className="w-44"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          {dateFilter ? (
            <Button variant="ghost" onClick={() => setDateFilter("")}>
              Clear date
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {appointmentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading appointments…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments match these filters.</p>
          ) : (
            rows.map((a) => {
              const canModify =
                (isPatientOnly && ["scheduled", "confirmed"].includes(a.status)) ||
                hasRole("admin", "receptionist") ||
                (hasRole("doctor") && a.doctor_id === doctorId);
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div className="min-w-48">
                    <p className="font-medium">
                      {formatDate(a.appointment_date)} · {formatTime(a.appointment_time)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.doctors?.full_name} · {a.doctors?.specialization}
                    </p>
                    {!isPatientOnly ? (
                      <p className="text-sm text-muted-foreground">
                        Patient: {fullName(patientsQuery.data?.[a.patient_id])}
                      </p>
                    ) : null}
                    {a.reason ? <p className="mt-1 text-sm">{a.reason}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[a.status]}`}>
                      {statusLabel[a.status]}
                    </span>
                    {canModify ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRescheduling({
                              id: a.id,
                              date: a.appointment_date,
                              time: a.appointment_time.slice(0, 5),
                              patient: a.patient_id,
                            })
                          }
                        >
                          Reschedule
                        </Button>
                        {!isPatientOnly ? (
                          <Select
                            value={a.status}
                            onValueChange={(status) =>
                              updateStatus.mutate({ id: a.id, status, patientId: a.patient_id })
                            }
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {APPOINTMENT_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {statusLabel[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        {a.status !== "cancelled" ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              updateStatus.mutate({ id: a.id, status: "cancelled", patientId: a.patient_id })
                            }
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(rescheduling)} onOpenChange={(open) => !open && setRescheduling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
            <DialogDescription>
              Choose a new date and time. Conflicting slots are rejected automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-date">Date</Label>
              <Input
                id="new-date"
                type="date"
                min={todayISO()}
                value={rescheduling?.date ?? ""}
                onChange={(e) => setRescheduling((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-time">Time</Label>
              <Input
                id="new-time"
                type="time"
                step={1800}
                value={rescheduling?.time ?? ""}
                onChange={(e) => setRescheduling((prev) => (prev ? { ...prev, time: e.target.value } : prev))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduling(null)}>
              Cancel
            </Button>
            <Button onClick={() => reschedule.mutate()} disabled={reschedule.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}