import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchAppointments, fetchDoctors, fetchPatients } from "@/lib/queries";
import { APPOINTMENT_STATUSES, formatDate, statusLabel, todayISO } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/admin")({
  head: () => ({
    meta: [
      { title: "Administration — CareConnect" },
      { name: "description", content: "Clinic utilisation reports: appointment volume, status mix and doctor workload." },
      { property: "og:title", content: "Administration — CareConnect" },
      { property: "og:description", content: "Reporting and oversight for CareConnect administrators." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { hasRole } = useAuth();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayISO());

  const appointmentsQuery = useQuery({ queryKey: ["appointments", "admin"], queryFn: () => fetchAppointments() });
  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: fetchDoctors });
  const patientsQuery = useQuery({ queryKey: ["patients", ""], queryFn: () => fetchPatients() });

  const inRange = useMemo(
    () =>
      (appointmentsQuery.data ?? []).filter(
        (a) => a.appointment_date >= from && a.appointment_date <= to,
      ),
    [appointmentsQuery.data, from, to],
  );

  if (!hasRole("admin")) {
    return <p className="text-sm text-muted-foreground">Administrator access required.</p>;
  }

  const byStatus = APPOINTMENT_STATUSES.map((status) => ({
    status,
    count: inRange.filter((a) => a.status === status).length,
  }));
  const completed = byStatus.find((s) => s.status === "completed")?.count ?? 0;
  const cancelled = byStatus.find((s) => s.status === "cancelled")?.count ?? 0;
  const noShow = byStatus.find((s) => s.status === "no_show")?.count ?? 0;
  const total = inRange.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const workload = (doctorsQuery.data ?? [])
    .map((d) => ({
      doctor: d,
      count: inRange.filter((a) => a.doctor_id === d.id).length,
      revenue: inRange.filter((a) => a.doctor_id === d.id && a.status === "completed").length * Number(d.consultation_fee),
    }))
    .sort((a, b) => b.count - a.count);

  const busiest = Object.entries(
    inRange.reduce<Record<string, number>>((acc, a) => {
      acc[a.appointment_date] = (acc[a.appointment_date] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxWorkload = Math.max(1, ...workload.map((w) => w.count));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Administration</h1>
        <p className="mt-1 text-muted-foreground">Clinic utilisation and performance reporting.</p>
      </header>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Appointments", value: total, hint: "in selected range" },
          { label: "Completion rate", value: `${pct(completed)}%`, hint: `${completed} completed` },
          { label: "Cancellation rate", value: `${pct(cancelled)}%`, hint: `${cancelled} cancelled` },
          { label: "No-show rate", value: `${pct(noShow)}%`, hint: `${noShow} no shows` },
        ].map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{s.hint}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Doctor workload</CardTitle>
            <CardDescription>Appointments handled and completed-consultation revenue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workload.map((w) => (
              <div key={w.doctor.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{w.doctor.full_name}</span>
                  <span className="text-muted-foreground">
                    {w.count} · ₦{w.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(w.count / maxWorkload) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {workload.length === 0 ? <p className="text-sm text-muted-foreground">No doctors yet.</p> : null}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
            <CardDescription>Distribution of appointment outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {byStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <span>{statusLabel[s.status]}</span>
                <span className="text-muted-foreground">
                  {s.count} ({pct(s.count)}%)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Busiest days</CardTitle>
            <CardDescription>Top five dates by appointment volume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {busiest.map(([date, count]) => (
              <div key={date} className="flex items-center justify-between">
                <span>{formatDate(date)}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
            ))}
            {busiest.length === 0 ? <p className="text-muted-foreground">No data in range.</p> : null}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Clinic register</CardTitle>
            <CardDescription>Overall totals across the system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Registered patients</span>
              <span className="text-muted-foreground">{patientsQuery.data?.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Doctors</span>
              <span className="text-muted-foreground">{doctorsQuery.data?.length ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Available doctors</span>
              <span className="text-muted-foreground">
                {(doctorsQuery.data ?? []).filter((d) => d.availability_status).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>All-time appointments</span>
              <span className="text-muted-foreground">{appointmentsQuery.data?.length ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}