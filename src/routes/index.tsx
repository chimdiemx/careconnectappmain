import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareConnect — Online Clinic Appointment Booking" },
      {
        name: "description",
        content:
          "Book clinic appointments online, manage doctor schedules, keep medical records secure and track clinic performance with CareConnect.",
      },
      { property: "og:title", content: "CareConnect — Online Clinic Appointment Booking" },
      {
        property: "og:description",
        content: "A secure clinic appointment and medical records platform for patients, doctors and administrators.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: CalendarCheck,
    title: "Conflict-free booking",
    body: "Real-time slots from each doctor's weekly availability. Double bookings are blocked at the database level.",
  },
  {
    icon: ClipboardList,
    title: "Medical records",
    body: "Doctors capture diagnosis, treatment, prescriptions and consultation notes against each visit.",
  },
  {
    icon: Users,
    title: "Role-based access",
    body: "Patients, doctors, receptionists and administrators each see exactly what they are permitted to see.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard & reports",
    body: "Daily and monthly appointment volumes, attendance rates and doctor utilisation at a glance.",
  },
  {
    icon: Search,
    title: "Fast search",
    body: "Find patients, doctors and appointments instantly with indexed, filterable search.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "Encrypted passwords, HTTPS transport, row-level security policies and automatic session handling.",
  },
];

function Index() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-hero-gradient text-primary-foreground">
              <Stethoscope className="size-5" />
            </span>
            CareConnect
          </Link>
          <nav className="flex items-center gap-2">
            {session ? (
              <Button asChild>
                <Link to="/app/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth" search={{ mode: "register" }}>
                    Create account
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-hero-gradient text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
                Clinic appointment system
              </p>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                Healthcare scheduling without the paper diary.
              </h1>
              <p className="mt-5 max-w-lg text-base/7 opacity-90">
                CareConnect replaces manual appointment books with online booking, live doctor
                availability, digital medical records and automated reminders — cutting no-shows and
                administrative workload.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth" search={{ mode: "register" }}>
                    Register as a patient
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-transparent text-primary-foreground hover:bg-white/10"
                >
                  <Link to="/auth">Staff sign in</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-6 shadow-lift ring-1 ring-white/20">
              <div className="space-y-3">
                {[
                  { label: "Today's appointments", value: "18" },
                  { label: "Doctors available", value: "5" },
                  { label: "Attendance rate", value: "92%" },
                  { label: "Average booking time", value: "under 1 min" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm"
                  >
                    <span className="opacity-85">{row.label}</span>
                    <span className="font-display text-lg font-semibold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold">Everything the clinic runs on</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Built to the CareConnect software requirements specification — user management,
            appointments, medical records, reporting and search.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="shadow-card">
                <CardHeader>
                  <feature.icon className="size-6 text-primary" />
                  <CardTitle className="mt-2 text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{feature.body}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-soft-gradient">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-3xl font-semibold">Ready when your patients are</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Create an account in seconds and book your first consultation with a CareConnect doctor.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link to="/auth" search={{ mode: "register" }}>
                Get started
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        CareConnect Clinic Appointment System · Secure patient data handling
      </footer>
    </div>
  );
}
