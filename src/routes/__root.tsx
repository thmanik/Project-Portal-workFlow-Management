import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { PortalDataProvider, usePortal } from "@/lib/portal-data";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Project Management Portal" },
      { name: "description", content: "Workflow-driven project management portal for CCR, ECM, PMO, TMS and HML document listing." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ActorHeader() {
  const { state, currentActor, setCurrentActorId } = usePortal();
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-base font-semibold text-card-foreground">{state.settings.portalName}</h2>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="actor-selector">
          Acting as
        </label>
        <select
          id="actor-selector"
          value={currentActor.id}
          onChange={(e) => setCurrentActorId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {state.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function RootComponent() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <PortalDataProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:flex">
          <AppSidebar />
        </div>

        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-card-foreground shadow-sm md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 cursor-pointer bg-background/80 backdrop-blur-sm"
              aria-label="Close navigation menu"
              onClick={() => setMobileSidebarOpen(false)}
            />

            <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] shadow-xl">
              <AppSidebar
                forceExpanded
                disableCollapse
                onNavigate={() => setMobileSidebarOpen(false)}
                className="w-72 max-w-[85vw]"
              />
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-card-foreground shadow-sm"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <main className="flex-1 overflow-y-auto p-4 pt-16 md:p-6 lg:p-8">
          <ActorHeader />
          <Outlet />
        </main>
        <Toaster position="bottom-right" />
      </div>
    </PortalDataProvider>
  );
}
