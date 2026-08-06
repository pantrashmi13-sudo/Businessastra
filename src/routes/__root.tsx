import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bizastra — Strategy. Elevation. Growth." },
      {
        name: "description",
        content:
          "Manage companies, customers, vendors, inventory and fixed assets with Bizastra ERP.",
      },
      { name: "author", content: "Bizastra" },
      { property: "og:title", content: "Bizastra — ERP & Business Management" },
      {
        property: "og:description",
        content:
          "AI-powered bill capture, inventory management, delivery challans, and VAT reporting with Bizastra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/bizastra-logo.png", type: "image/png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
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

function AuthGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const currentPath = router.state.location.pathname;
  const [checkingCompany, setCheckingCompany] = useState(true);

  // Check if user has a company (for onboarding redirect)
  useEffect(() => {
    if (loading || !session) {
      setCheckingCompany(false);
      return;
    }

    // Skip company check for onboarding and login pages
    if (currentPath === "/onboarding" || currentPath === "/login") {
      setCheckingCompany(false);
      return;
    }

    const checkCompany = async () => {
      try {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .limit(1);

        if (!data || data.length === 0) {
          navigate({ to: "/onboarding", replace: true });
        }
      } catch {
        // If check fails, continue normally
      } finally {
        setCheckingCompany(false);
      }
    };

    checkCompany();
  }, [session, loading, currentPath, navigate]);

  useEffect(() => {
    if (loading) return;

    if (!session && currentPath !== "/login") {
      navigate({ to: "/login", replace: true });
    } else if (session && currentPath === "/login") {
      navigate({ to: "/", replace: true });
    }
  }, [session, loading, currentPath, navigate]);

  // Show spinner while checking auth status or company
  if (loading || (session && checkingCompany && currentPath !== "/onboarding" && currentPath !== "/login")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render Login page or Onboarding page standalone without sidebar
  if (currentPath === "/login" || currentPath === "/onboarding" || !session) {
    return (
      <>
        <Outlet />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  // Authenticated ERP Dashboard layout
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-12 items-center gap-2 border-b border-border bg-card px-3">
            <SidebarTrigger />
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <span>BIZASTRA</span>
              <span className="text-[10px] text-muted-foreground/60">• STRATEGY. ELEVATION. GROWTH.</span>
            </div>
          </header>
          <main className="flex-1 overflow-x-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
