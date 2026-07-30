import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchAppointments, fetchDoctors, fetchPatients, fetchProfilesByIds } from "@/lib/queries";
import { formatDate, formatTime, fullName, statusLabel, statusTone } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/search")({
  head: () => ({
    meta: [
      { title: "Search — CareConnect" },
      { name: "description", content: "Search appointments, doctors and patients across the CareConnect clinic." },
      { property: "og:title", content: "Search — CareConnect" },
      { property: "og:description", content: "Fast clinic-wide search for appointments and people." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { user, doctorId, hasRole } = useAuth();
  const [term, setTerm] = useState("");
  const isStaff = hasRole("admin", "doctor", "receptionist");
  const isPatientOnly = !isStaff;

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "search", user?.id, doctorId, isPatientOnly],
    queryFn: () =>
      fetchAppointments(
        isPatientOnly ? { patientId: user!.id } : hasRole("doctor") && !hasRole("admin", "receptionist") && doctorId
          ? { doctorId }
          : {},
      ),
    enabled: Boolean(user),
  });
  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: fetchDoctors });
  const patientsQuery = useQuery({
    queryKey: ["patients", "search", term],
    queryFn: () => fetchPatients(term),
    enabled: isStaff && term.trim().length > 1,
  });

  const query = term.trim().toLowerCase();
  const appointments = (appointmentsQuery.data ?? []).filter((a) =>
    !query
      ? false
      : `${a.appointment_date} ${a.reason ?? ""} ${a.doctors?.full_name ?? ""} ${a.status}`
          .toLowerCase()
          .includes(query),
  );
  const profilesQuery = useQuery({
    queryKey: ["profiles", "search", appointments.map((a) => a.patient_id).join(",")],
    queryFn: () => fetchProfilesByIds(appointments.map((a) => a.patient_id)),
    enabled: isStaff && appointments.length > 0,
  });
  const doctors = (doctorsQuery.data ?? []).filter((d) =>
    !query ? false : `${d.full_name} ${d.specialization} ${d.qualification ?? ""}`.toLowerCase().includes(query),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Search</h1>
        <p className="mt-1 text-muted-foreground">
          Look up appointments{isStaff ? ", patients" : ""} and doctors in one place.
        </p>
      </header>

      <div className="relative max-w-xl">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, date, specialisation or status"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {!query ? (
        <p className="text-sm text-muted-foreground">Start typing to search.</p>
      ) : (
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Appointments</CardTitle>
              <CardDescription>{appointments.length} match(es)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>
                    {formatDate(a.appointment_date)} · {formatTime(a.appointment_time)} · {a.doctors?.full_name}
                    {isStaff ? ` · ${fullName(profilesQuery.data?.[a.patient_id])}` : ""}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </div>
              ))}
              {appointments.length === 0 ? <p className="text-sm text-muted-foreground">No appointments.</p> : null}
            </CardContent>
          </Card>

          {isStaff ? (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Patients</CardTitle>
                <CardDescription>{patientsQuery.data?.length ?? 0} match(es)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(patientsQuery.data ?? []).map((p) => (
                  <div key={p.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    {p.first_name} {p.last_name} · {p.email ?? "no email"} · {p.phone ?? "no phone"}
                  </div>
                ))}
                {(patientsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No patients.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Doctors</CardTitle>
              <CardDescription>{doctors.length} match(es)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {doctors.map((d) => (
                <div key={d.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  {d.full_name} · {d.specialization} · {d.years_experience} yrs
                </div>
              ))}
              {doctors.length === 0 ? <p className="text-sm text-muted-foreground">No doctors.</p> : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}