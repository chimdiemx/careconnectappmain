import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, roleLabel } from "@/lib/auth";
import { fullName } from "@/lib/clinic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { to: "/app/appointments", label: "Appointments", icon: CalendarDays, roles: null },
  { to: "/app/book", label: "Book appointment", icon: CalendarPlus, roles: ["patient", "receptionist", "admin"] },
  { to: "/app/records", label: "Medical records", icon: ClipboardList, roles: null },
  { to: "/app/doctors", label: "Doctors", icon: Stethoscope, roles: null },
  { to: "/app/patients", label: "Patients", icon: Users, roles: ["doctor", "receptionist", "admin"] },
  { to: "/app/search", label: "Search", icon: Search, roles: null },
  { to: "/app/admin", label: "Administration", icon: Settings, roles: ["admin"] },
  { to: "/app/profile", label: "My profile", icon: UserRound, roles: null },
] as const;

function AppLayout() {
  const { session, loading, profile, roles, hasRole, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your clinic workspace…
      </div>
    );
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const visible = NAV.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 font-display text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Stethoscope className="size-5" />
          </span>
          CareConnect
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease-standard)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]",
                "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-primary before:transition-transform before:duration-[var(--dur-base)] before:ease-[var(--ease-emphasized)]",
                pathname === item.to
                  ? "bg-sidebar-accent text-sidebar-accent-foreground before:scale-y-100"
                  : "before:scale-y-0",
              )}
            >
              <item.icon className="size-4 transition-transform duration-[var(--dur-base)] ease-[var(--ease-spring)] group-hover:scale-110" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <p className="font-medium">{fullName(profile)}</p>
          <p className="text-xs opacity-70">{roles.map((r) => roleLabel[r]).join(" · ") || "Patient"}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="interactive mt-3 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-3 md:hidden">
          <span className="font-display font-semibold">CareConnect</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
          </Button>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease-standard)] active:scale-95",
                pathname === item.to ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main key={pathname} className="rise-in flex-1 px-5 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}