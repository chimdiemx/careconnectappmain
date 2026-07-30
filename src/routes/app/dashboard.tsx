import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarClock, Stethoscope, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchAppointments, fetchDoctors, fetchProfilesByIds } from "@/lib/queries";
import { formatDate, formatTime, fullName, statusLabel, statusTone, todayISO } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CareConnect" },
      { name: "description", content: "Today's appointments, available doctors and upcoming visits at a glance." },
      { property: "og:title", content: "Dashboard — CareConnect" },
      { property: "og:description", content: "Clinic activity overview for CareConnect users." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, user, doctorId, hasRole } = useAuth();
  const isPatientOnly = !hasRole("admin", "doctor", "receptionist");

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "dashboard", user?.id, doctorId, isPatientOnly],
    queryFn: () =>
      fetchAppointments(
        isPatientOnly ? { patientId: user!.id } : doctorId && !hasRole("admin", "receptionist") ? { doctorId } : {},
      ),
    enabled: Boolean(user),
  });

  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: fetchDoctors });

  const appointments = appointmentsQuery.data ?? [];
  const today = todayISO();
  const todays = appointments.filter((a) => a.appointment_date === today);
  const upcoming = appointments
    .filter((a) => a.appointment_date >= today && ["scheduled", "confirmed"].includes(a.status))
    .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time))
    .slice(0, 6);

  const patientIds = upcoming.map((a) => a.patient_id).concat(todays.map((a) => a.patient_id));
  const patientsQuery = useQuery({
    queryKey: ["profiles", patientIds.join(",")],
    queryFn: () => fetchProfilesByIds(patientIds),
    enabled: !isPatientOnly && patientIds.length > 0,
  });

  const availableDoctors = (doctorsQuery.data ?? []).filter((d) => d.availability_status);
  const completed = appointments.filter((a) => a.status === "completed").length;
  const attendance = appointments.length ? Math.round((completed / appointments.length) * 100) : 0;

  const stats = [
    { label: "Today's appointments", value: todays.length, icon: CalendarCheck },
    { label: "Upcoming", value: upcoming.length, icon: CalendarClock },
    { label: "Doctors available", value: availableDoctors.length, icon: Stethoscope },
    { label: "Attendance rate", value: `${attendance}%`, icon: Users },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Welcome, {profile?.first_name || "there"}</h1>
          <p className="mt-1 text-muted-foreground">{formatDate(today)}</p>
        </div>
        {isPatientOnly ? (
          <Button asChild>
            <Link to="/app/book">Book an appointment</Link>
          </Button>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardHeader className="pb-2">
              <stat.icon className="size-5 text-primary" />
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Today's schedule</CardTitle>
            <CardDescription>Appointments booked for {formatDate(today)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {todays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments today.</p>
            ) : (
              todays.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {formatTime(a.appointment_time)} · {a.doctors?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isPatientOnly
                        ? (a.reason ?? "Consultation")
                        : fullName(patientsQuery.data?.[a.patient_id])}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Upcoming appointments</CardTitle>
            <CardDescription>Next scheduled and confirmed visits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing upcoming.</p>
            ) : (
              upcoming.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{a.doctors?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(a.appointment_date)} at {formatTime(a.appointment_time)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Available doctors</CardTitle>
          <CardDescription>Currently accepting appointments</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableDoctors.map((d) => (
            <div key={d.id} className="rounded-lg border border-border p-3">
              <p className="font-medium">{d.full_name}</p>
              <p className="text-xs text-muted-foreground">{d.specialization}</p>
            </div>
          ))}
          {availableDoctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doctors are marked available.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}