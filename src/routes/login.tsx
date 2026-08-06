import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, BarChart3, BookOpen, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            toast.error("Please check your email and confirm your account first, then try signing in.", { duration: 6000 });
          } else if (error.message.toLowerCase().includes("invalid login credentials") || error.message.toLowerCase().includes("invalid email or password")) {
            toast.error("Incorrect email or password. Please try again.");
          } else {
            toast.error(error.message || "Sign-in failed. Please try again.");
          }
          return;
        }
        if (data.session) {
          toast.success("Welcome back!");
          navigate({ to: "/" });
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast.error(error.message || "Sign-up failed. Please try again.");
          return;
        }
        if (data.session) {
          toast.success("Account created! You are now signed in.");
          navigate({ to: "/" });
        } else {
          toast.success("Account created! Check your inbox and confirm your email, then sign in.", { duration: 8000 });
          setMode("signin");
        }
      }
    } catch (err) {
      toast.error((err as Error).message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const featureCards = [
    { emoji: "🧾", title: "AI Bill OCR", desc: "Upload invoices and auto-extract all data" },
    { emoji: "📦", title: "Live Inventory", desc: "Lot tracking, expiry dates & stock alerts" },
    { emoji: "🚚", title: "Delivery Challans", desc: "Dispatch management with real-time stock" },
    { emoji: "📊", title: "Vendor Ledger", desc: "Full purchase history & payment tracking" },
  ];

  const userManualSections = [
    {
      title: "1. AI Bill OCR & Purchase Entry",
      content: "Upload vendor invoices in PDF or image format. The system automatically extracts invoice numbers, vendor details, items, quantities, and rates. Review and approve to automatically create purchase bills and update stock."
    },
    {
      title: "2. Live Inventory & Stock Alerts",
      content: "Track stock quantities in real time. Features lot/batch tracking, expiry date monitoring, low stock warnings, and automatic reorder recommendations."
    },
    {
      title: "3. Delivery Challans & Dispatch",
      content: "Create delivery challans for outgoing goods. Stock is automatically reserved and adjusted upon confirmation, maintaining synchronized inventory."
    },
    {
      title: "4. Vendor Ledgers & VAT Registers",
      content: "Generate comprehensive vendor statement ledgers, track payables, and automatically maintain dual AD/BS date-based VAT Purchase and Sales Registers for tax reporting."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Brand panel (Visible on Desktop as left side, visible on mobile as top section) */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-8 lg:p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
              <img src="/bizastra-logo.png" alt="Bizastra Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-bold text-xl tracking-tight text-white">BIZASTRA</p>
              <p className="text-[10px] tracking-wider text-amber-400 font-semibold uppercase">Strategy. Elevation. Growth.</p>
            </div>
          </div>

          {/* User Manual Trigger Button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white gap-2">
                <BookOpen className="h-4 w-4" />
                <span>User Manual</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-primary">
                  <HelpCircle className="h-5 w-5" />
                  Bizastra User Manual
                </SheetTitle>
                <SheetDescription>
                  Welcome to Bizastra! Here is a quick guide to getting started with your business features.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6 text-sm">
                {userManualSections.map((sec) => (
                  <div key={sec.title} className="rounded-lg border p-4 bg-muted/30">
                    <h4 className="font-semibold text-foreground mb-1.5">{sec.title}</h4>
                    <p className="text-muted-foreground leading-relaxed text-xs sm:text-sm">{sec.content}</p>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="relative z-10 my-8 lg:my-0 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Full Business Control</p>
              <p className="text-sm text-white/60">Bills, inventory, vendors & more</p>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {featureCards.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl bg-white/5 p-3 border border-white/10">
                <span className="text-xl">{f.emoji}</span>
                <div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-xs text-white/50">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/30 hidden lg:block">
          © 2026 Bizastra. All rights reserved.
        </p>
      </div>

      {/* Auth panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 lg:py-12 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to continue to Bizastra"
                : "Get started with your Bizastra workspace"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait…</>
              ) : (
                mode === "signin" ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            {mode === "signin" ? (
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-medium text-primary hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-8 lg:hidden">
          © 2026 Bizastra. All rights reserved.
        </p>
      </div>
    </div>
  );
}
