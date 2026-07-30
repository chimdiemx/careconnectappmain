import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchAvailability, fetchDoctors } from "@/lib/queries";
import { DAY_NAMES, formatTime } from "@/lib/clinic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/doctors")({
  head: () => ({
    meta: [
      { title: "Doctors — CareConnect" },
      { name: "description", content: "Browse CareConnect doctors, specialisations, experience and weekly consulting hours." },
      { property: "og:title", content: "Doctors — CareConnect" },
      { property: "og:description", content: "Doctor directory and clinic availability." },
    ],
  }),
  component: DoctorsPage,
});

function DoctorsPage() {
  const { hasRole } = useAuth();
  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: fetchDoctors });
  const availabilityQuery = useQuery({ queryKey: ["availability", "all"], queryFn: () => fetchAvailability() });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Doctors</h1>
        <p className="mt-1 text-muted-foreground">
          Specialisations, experience and weekly consulting hours.
          {hasRole("admin") ? " Manage doctor records from the Administration page." : ""}
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {(doctorsQuery.data ?? []).map((doctor) => {
          const slots = (availabilityQuery.data ?? []).filter((a) => a.doctor_id === doctor.id);
          return (
            <Card key={doctor.id} className="shadow-card">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{doctor.full_name}</CardTitle>
                    <CardDescription>{doctor.specialization}</CardDescription>
                  </div>
                  <Badge variant={doctor.availability_status ? "default" : "secondary"}>
                    {doctor.availability_status ? "Available" : "Unavailable"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{doctor.bio}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Qualification</p>
                    <p>{doctor.qualification ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Experience</p>
                    <p>{doctor.years_experience} years</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Consultation fee</p>
                    <p>₦{Number(doctor.consultation_fee).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="truncate">{doctor.phone ?? doctor.email ?? "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Consulting hours</p>
                  {slots.length === 0 ? (
                    <p>Not set</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {slots.map((s) => (
                        <li key={s.id}>
                          {DAY_NAMES[s.day_of_week]}: {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}