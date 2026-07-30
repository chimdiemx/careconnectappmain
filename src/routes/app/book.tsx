import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchAvailability, fetchDoctors, fetchPatients, notify } from "@/lib/queries";
import { buildSlots, formatTime, todayISO } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/book")({
  head: () => ({
    meta: [
      { title: "Book an appointment — CareConnect" },
      { name: "description", content: "Pick a doctor, choose an available slot and confirm your clinic appointment." },
      { property: "og:title", content: "Book an appointment — CareConnect" },
      { property: "og:description", content: "Real-time doctor availability with conflict-free booking." },
    ],
  }),
  component: BookPage,
});

const bookingSchema = z.object({
  doctorId: z.string().uuid("Select a doctor"),
  date: z.string().min(1, "Choose a date"),
  time: z.string().min(1, "Choose a time slot"),
  reason: z.string().trim().max(500).optional(),
  patientId: z.string().uuid("Select a patient"),
});

function BookPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isStaffBooking = hasRole("admin", "receptionist");

  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [patientId, setPatientId] = useState("");

  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: fetchDoctors });
  const availabilityQuery = useQuery({
    queryKey: ["availability", doctorId],
    queryFn: () => fetchAvailability(doctorId),
    enabled: Boolean(doctorId),
  });
  const patientsQuery = useQuery({
    queryKey: ["patients", "booking"],
    queryFn: () => fetchPatients(),
    enabled: isStaffBooking,
  });
  const bookedQuery = useQuery({
    queryKey: ["booked", doctorId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("appointment_time,status")
        .eq("doctor_id", doctorId)
        .eq("appointment_date", date)
        .in("status", ["scheduled", "confirmed"]);
      if (error) throw error;
      return (data ?? []).map((r) => (r as { appointment_time: string }).appointment_time);
    },
    enabled: Boolean(doctorId && date),
  });

  const slots = useMemo(() => {
    if (!doctorId || !date) return [];
    const dow = new Date(`${date}T00:00:00`).getDay();
    const rule = (availabilityQuery.data ?? []).find((a) => a.day_of_week === dow);
    if (!rule) return [];
    return buildSlots(rule.start_time, rule.end_time, rule.slot_minutes);
  }, [availabilityQuery.data, doctorId, date]);

  const taken = new Set(bookedQuery.data ?? []);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = bookingSchema.safeParse({
        doctorId,
        date,
        time,
        reason,
        patientId: isStaffBooking ? patientId : user!.id,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (parsed.data.date < todayISO()) throw new Error("Appointments cannot be booked in the past");

      const { error } = await supabase.from("appointments").insert({
        patient_id: parsed.data.patientId,
        doctor_id: parsed.data.doctorId,
        appointment_date: parsed.data.date,
        appointment_time: parsed.data.time,
        reason: parsed.data.reason || null,
        created_by: user!.id,
      } as never);
      if (error) {
        if (error.code === "23505") throw new Error("That slot has just been taken. Please pick another time.");
        throw new Error(error.message);
      }
      await notify(
        parsed.data.patientId,
        "Appointment confirmed",
        `Your appointment is booked for ${parsed.data.date} at ${formatTime(parsed.data.time)}.`,
        "success",
      );
    },
    onSuccess: () => {
      toast.success("Appointment booked");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void navigate({ to: "/app/appointments" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Book an appointment</h1>
        <p className="mt-1 text-muted-foreground">
          Slots come straight from each doctor's weekly availability — booked times are removed automatically.
        </p>
      </header>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Appointment details</CardTitle>
          <CardDescription>Choose a doctor and an open slot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isStaffBooking ? (
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {(patientsQuery.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} {p.email ? `· ${p.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select
                value={doctorId}
                onValueChange={(value) => {
                  setDoctorId(value);
                  setTime("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {(doctorsQuery.data ?? [])
                    .filter((d) => d.availability_status)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name} — {d.specialization}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime("");
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Available slots</Label>
            {!doctorId ? (
              <p className="text-sm text-muted-foreground">Select a doctor to see open times.</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">This doctor does not consult on the selected day.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => {
                  const isTaken = taken.has(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isTaken}
                      onClick={() => setTime(slot)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        isTaken && "cursor-not-allowed border-dashed text-muted-foreground line-through opacity-60",
                        time === slot
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {formatTime(slot)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for visit</Label>
            <Textarea
              id="reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe your symptoms or reason for the consultation"
            />
          </div>

          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Booking…" : "Confirm appointment"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}