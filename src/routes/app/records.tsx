import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchAppointments, fetchMedicalRecords, fetchProfilesByIds } from "@/lib/queries";
import { formatDate, formatTime, fullName } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/app/records")({
  head: () => ({
    meta: [
      { title: "Medical records — CareConnect" },
      { name: "description", content: "Diagnoses, treatments, prescriptions and consultation notes for each visit." },
      { property: "og:title", content: "Medical records — CareConnect" },
      { property: "og:description", content: "Secure digital medical history for CareConnect patients." },
    ],
  }),
  component: RecordsPage,
});

const recordSchema = z.object({
  appointment_id: z.string().uuid("Select the appointment this record belongs to"),
  diagnosis: z.string().trim().min(1, "Diagnosis is required").max(255),
  treatment: z.string().trim().min(1, "Treatment is required").max(255),
  prescription: z.string().trim().min(1, "Prescription is required").max(150),
  consultation_notes: z.string().trim().max(2000).optional(),
});

function RecordsPage() {
  const { user, doctorId, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = Boolean(doctorId) || hasRole("admin");
  const isPatientOnly = !hasRole("admin", "doctor", "receptionist");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    appointment_id: "",
    diagnosis: "",
    treatment: "",
    prescription: "",
    consultation_notes: "",
  });
  const [search, setSearch] = useState("");

  const recordsQuery = useQuery({
    queryKey: ["records", user?.id, doctorId, isPatientOnly],
    queryFn: () =>
      fetchMedicalRecords(
        isPatientOnly ? { patientId: user!.id } : doctorId && !hasRole("admin") ? { doctorId } : {},
      ),
    enabled: Boolean(user),
  });

  const eligibleQuery = useQuery({
    queryKey: ["appointments", "for-records", doctorId],
    queryFn: () => fetchAppointments(doctorId ? { doctorId } : {}),
    enabled: canWrite,
  });

  const records = (recordsQuery.data ?? []).filter((r) =>
    !search.trim()
      ? true
      : `${r.diagnosis} ${r.treatment} ${r.prescription}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const profilesQuery = useQuery({
    queryKey: ["profiles", "records", records.map((r) => r.patient_id).join(",")],
    queryFn: () => fetchProfilesByIds(records.map((r) => r.patient_id)),
    enabled: !isPatientOnly && records.length > 0,
  });

  const recordedAppointments = new Set((recordsQuery.data ?? []).map((r) => r.appointment_id));
  const eligible = (eligibleQuery.data ?? []).filter(
    (a) => !recordedAppointments.has(a.id) && a.status !== "cancelled",
  );

  const appointmentPatients = useQuery({
    queryKey: ["profiles", "eligible", eligible.map((a) => a.patient_id).join(",")],
    queryFn: () => fetchProfilesByIds(eligible.map((a) => a.patient_id)),
    enabled: canWrite && eligible.length > 0,
  });

  const createRecord = useMutation({
    mutationFn: async () => {
      const parsed = recordSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const appointment = eligible.find((a) => a.id === parsed.data.appointment_id);
      if (!appointment) throw new Error("Appointment not found");

      const { error } = await supabase.from("medical_records").insert({
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        diagnosis: parsed.data.diagnosis,
        treatment: parsed.data.treatment,
        prescription: parsed.data.prescription,
        consultation_notes: parsed.data.consultation_notes || null,
      } as never);
      if (error) throw new Error(error.message);

      await supabase.from("appointments").update({ status: "completed" } as never).eq("id", appointment.id);
    },
    onSuccess: () => {
      toast.success("Medical record saved");
      setOpen(false);
      setForm({ appointment_id: "", diagnosis: "", treatment: "", prescription: "", consultation_notes: "" });
      void queryClient.invalidateQueries({ queryKey: ["records"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Medical records</h1>
          <p className="mt-1 text-muted-foreground">
            {isPatientOnly ? "Your consultation history" : "Diagnoses, treatments and prescriptions per visit"}
          </p>
        </div>
        {canWrite ? <Button onClick={() => setOpen(true)}>New record</Button> : null}
      </header>

      <Input
        placeholder="Search diagnosis, treatment or prescription"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <div className="space-y-4">
        {recordsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading records…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medical records yet.</p>
        ) : (
          records.map((r) => (
            <Card key={r.id} className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{r.diagnosis}</CardTitle>
                <CardDescription>
                  {formatDate(r.record_date)} · {r.doctors?.full_name}
                  {!isPatientOnly ? ` · ${fullName(profilesQuery.data?.[r.patient_id])}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-medium text-muted-foreground">Treatment</p>
                  <p>{r.treatment}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Prescription</p>
                  <p>{r.prescription}</p>
                </div>
                {r.consultation_notes ? (
                  <div className="sm:col-span-2">
                    <p className="font-medium text-muted-foreground">Consultation notes</p>
                    <p className="whitespace-pre-line">{r.consultation_notes}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New medical record</DialogTitle>
            <DialogDescription>Records are attached to a single appointment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Appointment</Label>
              <Select
                value={form.appointment_id}
                onValueChange={(value) => setForm((f) => ({ ...f, appointment_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an appointment" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatDate(a.appointment_date)} {formatTime(a.appointment_time)} ·{" "}
                      {fullName(appointmentPatients.data?.[a.patient_id])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Input
                id="diagnosis"
                maxLength={255}
                value={form.diagnosis}
                onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment">Treatment</Label>
              <Input
                id="treatment"
                maxLength={255}
                value={form.treatment}
                onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prescription">Prescription</Label>
              <Input
                id="prescription"
                maxLength={150}
                value={form.prescription}
                onChange={(e) => setForm((f) => ({ ...f, prescription: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Consultation notes</Label>
              <Textarea
                id="notes"
                maxLength={2000}
                value={form.consultation_notes}
                onChange={(e) => setForm((f) => ({ ...f, consultation_notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createRecord.mutate()} disabled={createRecord.isPending}>
              Save record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}