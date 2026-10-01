import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/Field";
import { Logo } from "@/components/site/Logo";
import { homeForRoles, type AppRole } from "@/lib/auth";
import hero from "@/assets/zanzibar.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "signup" ? ("signup" as const) : ("login" as const) }),
  head: () => ({
    meta: [
      { title: "Login or Sign Up — ExploreBongo" },
      { name: "description", content: "Sign in or create your ExploreBongo traveler account." },
      { property: "og:title", content: "Login or Sign Up — ExploreBongo" },
      { property: "og:description", content: "Access your ExploreBongo account." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(6, "Phone is required").max(30),
  country: z.string().trim().min(2, "Country is required").max(60),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

async function goHome(navigate: ReturnType<typeof useNavigate>, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  navigate({ to: homeForRoles((data ?? []).map((r) => r.role as AppRole)), search: { section: "overview" } });
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [forgot, setForgot] = useState(false);

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setLoading(false);
    if (error) return toast.error(error.message);
    await goHome(navigate, data.user.id);
  };

  const onForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return toast.error(error.message);
    toast.success("Check your email for a reset link.");
    setForgot(false);
  };

  const onSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { email, password, ...meta } = parsed.data;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { ...meta, role: "tourist" } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error(r.error.message ?? "Google sign-in failed");
    if (r.redirected) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) await goHome(navigate, data.user.id);
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden md:block">
        <img src={hero} alt="Zanzibar beach with a dhow" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="absolute bottom-10 left-10 right-10">
          <Logo light />
          <p className="mt-4 font-display text-4xl text-on-image">Discover Tanzania. <em className="text-gold">Your way.</em></p>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="md:hidden"><Logo /></div>
          {sent ? (
            <div className="mt-8 text-center">
              <h1 className="text-3xl font-semibold">Check your email</h1>
              <p className="mt-3 text-muted-foreground">We sent you a confirmation link. Click it to activate your account, then log in.</p>
            </div>
          ) : forgot ? (
            <form onSubmit={onForgot} className="mt-8 space-y-4">
              <h1 className="text-3xl font-semibold">Reset password</h1>
              <Field name="email" label="Email" type="email" />
              <Button className="w-full" size="lg">Send reset link</Button>
              <button type="button" className="text-sm text-primary underline" onClick={() => setForgot(false)}>Back to login</button>
            </form>
          ) : (
            <>
              <h1 className="mt-8 text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your traveler account"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "login" ? "New here? " : "Already have an account? "}
                <Link to="/auth" search={{ mode: mode === "login" ? "signup" : "login" }} className="font-semibold text-primary underline">
                  {mode === "login" ? "Sign up" : "Log in"}
                </Link>
              </p>
              <Button variant="outline" className="mt-6 w-full" size="lg" onClick={google}>Continue with Google</Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              {mode === "login" ? (
                <form onSubmit={onLogin} className="space-y-4">
                  <Field name="email" label="Email" type="email" />
                  <Field name="password" label="Password" type="password" />
                  <button type="button" className="text-sm text-primary underline" onClick={() => setForgot(true)}>Forgot password?</button>
                  <Button className="w-full" size="lg" disabled={loading}>{loading ? "Signing in…" : "Log in"}</Button>
                </form>
              ) : (
                <form onSubmit={onSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3"><Field name="first_name" label="First name" /><Field name="last_name" label="Last name" /></div>
                  <Field name="email" label="Email" type="email" />
                  <div className="grid grid-cols-2 gap-3"><Field name="phone" label="Phone" type="tel" /><Field name="country" label="Country" /></div>
                  <Field name="password" label="Password" type="password" />
                  <Button className="w-full" size="lg" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Offering tourism services? <Link to="/provider/register" className="text-primary underline">Register as a provider</Link>
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
