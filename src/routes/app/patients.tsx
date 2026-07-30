import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchAppointments, fetchMedicalRecords, fetchPatients } from "@/lib/queries";
import { formatDate, formatTime, statusLabel, statusTone } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/patients")({
  head: () => ({
    meta: [
      { title: "Patients — CareConnect" },
      { name: "description", content: "Search the patient register and open a full visit and medical history." },
      { property: "og:title", content: "Patients — CareConnect" },
      { property: "og:description", content: "Clinic patient directory for CareConnect staff." },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const { hasRole } = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const patientsQuery = useQuery({ queryKey: ["patients", search], queryFn: () => fetchPatients(search) });
  const historyQuery = useQuery({
    queryKey: ["patient-history", selected],
    queryFn: async () => ({
      appointments: await fetchAppointments({ patientId: selected! }),
      records: await fetchMedicalRecords({ patientId: selected! }),
    }),
    enabled: Boolean(selected),
  });

  if (!hasRole("admin", "doctor", "receptionist")) {
    return <p className="text-sm text-muted-foreground">You do not have access to the patient register.</p>;
  }

  const patient = (patientsQuery.data ?? []).find((p) => p.id === selected);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Patients</h1>
        <p className="mt-1 text-muted-foreground">Search by name, email or phone number.</p>
      </header>

      <Input
        className="max-w-md"
        placeholder="Search patients"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(patientsQuery.data ?? []).map((p) => (
          <Card key={p.id} className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">
                {p.first_name} {p.last_name}
              </CardTitle>
              <CardDescription>{p.email ?? "No email on file"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Phone: {p.phone ?? "—"}</p>
              <p>Date of birth: {p.date_of_birth ? formatDate(p.date_of_birth) : "—"}</p>
              <p>Blood group: {p.blood_group ?? "—"}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelected(p.id)}>
                View history
              </Button>
            </CardContent>
          </Card>
        ))}
        {patientsQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No patients found.</p>
        ) : null}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {patient ? `${patient.first_name} ${patient.last_name}` : "Patient history"}
            </DialogTitle>
            <DialogDescription>Appointments and medical records on file.</DialogDescription>
          </DialogHeader>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Appointments</h3>
            {(historyQuery.data?.appointments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments.</p>
            ) : (
              historyQuery.data?.appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>
                    {formatDate(a.appointment_date)} · {formatTime(a.appointment_time)} · {a.doctors?.full_name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Medical records</h3>
            {(historyQuery.data?.records ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No medical records.</p>
            ) : (
              historyQuery.data?.records.map((r) => (
                <div key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{r.diagnosis}</p>
                  <p className="text-muted-foreground">
                    {formatDate(r.record_date)} · {r.doctors?.full_name}
                  </p>
                  <p>Treatment: {r.treatment}</p>
                  <p>Prescription: {r.prescription}</p>
                </div>
              ))
            )}
          </section>
        </DialogContent>
      </Dialog>
    </div>
  );
}