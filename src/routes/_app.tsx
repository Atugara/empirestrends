import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Sparkles,
  ClipboardCheck,
  CalendarClock,
  CheckCircle,
  Settings,
  LogOut,
  Flame,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
  beforeLoad: async () => {
    // Auth check happens client-side in AppLayout for SPA feel; server-side
    // protected data is gated by server functions.
  },
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trends", label: "Trends", icon: Sparkles },
  { to: "/review", label: "Review", icon: ClipboardCheck },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/published", label: "Published", icon: CheckCircle },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.navigate({ to: "/auth" });
    }
  }, [loading, session, router]);

  if (loading) return <Shell />;
  if (!session) return <Shell />;

  return (
    <div className="grain flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-border bg-sidebar px-4 py-6">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="font-display text-2xl tracking-wide text-sidebar-foreground">TrendJester</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: false }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent [&[data-status=active]]:bg-sidebar-primary [&[data-status=active]]:text-sidebar-primary-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-4">
          <div className="mb-3 truncate px-3 text-xs text-sidebar-foreground/70">{session.user.email}</div>
          <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

function Shell() {
  return (
    <div className="grain flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2">
        <Flame className="h-6 w-6 animate-pulse text-primary" />
        <span className="font-display text-2xl text-foreground">TrendJester</span>
      </div>
    </div>
  );
}
