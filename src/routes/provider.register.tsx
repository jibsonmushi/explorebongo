import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Field } from "@/components/site/Field";
import { useAuthState } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/provider/register")({
  head: () => ({
    meta: [
      { title: "Register as a Provider — ExploreBongo" },
      { name: "description", content: "Create your ExploreBongo provider account and business profile in three steps." },
      { property: "og:title", content: "Register as a Provider — ExploreBongo" },
      { property: "og:description", content: "Create your provider account and business profile." },
    ],
  }),
  component: Register,
});

export const PROVIDER_TYPES = [
  ["transport", "Transport"], ["activity", "Activity"], ["guide", "Guide"], ["restaurant", "Restaurant/Food"],
  ["accommodation", "Accommodation"], ["experience_host", "Experience Host"], ["other", "Other"],
] as const;

const accountSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(6, "Phone is required").max(30),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});
const businessSchema = z.object({
  business_name: z.string().trim().min(2, "Business name is required").max(150),
  description: z.string().trim().min(10, "Add a short description (10+ characters)").max(2000),
  provider_type: z.enum(["transport", "activity", "guide", "restaurant", "accommodation", "experience_host", "other"]),
  business_country: z.string().trim().min(2).max(60),
  region: z.string().trim().min(2, "Region is required").max(80),
  city: z.string().trim().min(2, "City is required").max(80),
  address: z.string().trim().min(2, "Address is required").max(200),
  business_phone: z.string().trim().min(6, "Business phone is required").max(30),
  business_email: z.string().trim().email("Invalid business email").max(255),
});

const steps = ["Account", "Business", "Verification"];

function Register() {
  const { user } = useAuthState();
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState<z.infer<typeof accountSchema> | null>(null);
  const [business, setBusiness] = useState<z.infer<typeof businessSchema> | null>(null);
  const [ptype, setPtype] = useState<string>("activity");
  const [docs, setDocs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const step1 = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = accountSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!r.success) return toast.error(r.error.issues[0].message);
    setAccount(r.data); setStep(1);
  };
  const step2 = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = businessSchema.safeParse({ ...Object.fromEntries(new FormData(e.currentTarget)), provider_type: ptype });
    if (!r.success) return toast.error(r.error.issues[0].message);
    setBusiness(r.data); setStep(2);
  };
  const submit = async () => {
    if (!account || !business) return;
    setLoading(true);
    const { email, password, ...a } = account;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/provider`,
        data: { ...a, country: business.business_country, role: "provider", ...business, documents_pending: docs },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-5 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-earth">Provider registration</p>
        <h1 className="mt-2 text-4xl font-semibold">Register your business</h1>

        {user && !done ? (
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <p>You're signed in already. Provider accounts are registered separately — sign out first to create a provider account with a different email.</p>
          </div>
        ) : done ? (
          <div className="mt-8 rounded-2xl border bg-card p-8 text-center shadow-card">
            <Check className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 text-2xl font-semibold">Application received</h2>
            <p className="mt-2 text-muted-foreground">Confirm your email using the link we sent, then log in to your provider dashboard. Your verification status is <strong>PENDING</strong>.</p>
            <Button asChild className="mt-6"><Link to="/auth" search={{ mode: "login" }}>Go to login</Link></Button>
          </div>
        ) : (
          <>
            <ol className="mt-8 flex gap-2">
              {steps.map((s, i) => (
                <li key={s} className="flex-1">
                  <div className={cn("h-1.5 rounded-full", i <= step ? "bg-gold" : "bg-border")} />
                  <p className={cn("mt-2 text-xs font-semibold", i === step ? "text-foreground" : "text-muted-foreground")}>Step {i + 1} · {s}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-2xl border bg-card p-6 shadow-card md:p-8">
              {step === 0 && (
                <form onSubmit={step1} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2"><Field name="first_name" label="First name" defaultValue={account?.first_name} /><Field name="last_name" label="Last name" defaultValue={account?.last_name} /></div>
                  <Field name="email" label="Email" type="email" defaultValue={account?.email} />
                  <Field name="phone" label="Phone" type="tel" defaultValue={account?.phone} />
                  <Field name="password" label="Password" type="password" />
                  <Button className="w-full" size="lg">Continue</Button>
                </form>
              )}
              {step === 1 && (
                <form onSubmit={step2} className="space-y-4">
                  <Field name="business_name" label="Business name" defaultValue={business?.business_name} />
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" rows={4} defaultValue={business?.description} required className="bg-card" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Provider type</Label>
                    <Select value={ptype} onValueChange={setPtype}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>{PROVIDER_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field name="business_country" label="Country" defaultValue={business?.business_country ?? "Tanzania"} />
                    <Field name="region" label="Region" defaultValue={business?.region} />
                    <Field name="city" label="City" defaultValue={business?.city} />
                    <Field name="address" label="Address" defaultValue={business?.address} />
                    <Field name="business_phone" label="Business phone" type="tel" defaultValue={business?.business_phone ?? account?.phone} />
                    <Field name="business_email" label="Business email" type="email" defaultValue={business?.business_email ?? account?.email} />
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" size="lg" onClick={() => setStep(0)}>Back</Button>
                    <Button className="flex-1" size="lg">Continue</Button>
                  </div>
                </form>
              )}
              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="text-xl font-semibold">Verification</h2>
                  <p className="text-sm text-muted-foreground">
                    To protect travelers, every provider is reviewed before services go live. You'll be asked for documents such as a business license and TALA/tourism permit from your dashboard.
                  </p>
                  <label className="flex items-start gap-3 rounded-xl border p-4">
                    <Checkbox checked={docs} onCheckedChange={(v) => setDocs(v === true)} />
                    <span className="text-sm">I will submit verification documents (business registration, licenses) after registering.</span>
                  </label>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>Back</Button>
                    <Button className="flex-1" size="lg" variant="gold" disabled={loading} onClick={submit}>{loading ? "Submitting…" : "Create provider account"}</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
