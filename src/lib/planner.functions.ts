import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  days: z.number().int().min(1).max(21),
  budget: z.number().min(0).max(1_000_000),
  travelers: z.number().int().min(1).max(50),
  interests: z.string().max(500),
});

export type PlanDay = { day: number; title: string; summary: string; service_ids: string[] };
export type Plan = { title: string; overview: string; days: PlanDay[]; estimated_total_usd: number };

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: services } = await context.supabase
      .from("services")
      .select("id,title,description,price,currency,duration_minutes,destinations(name),categories(name)")
      .eq("is_published", true)
      .limit(80);
    const catalog = (services ?? []).map((s) => ({
      id: s.id, title: s.title, price: `${s.currency} ${s.price}`, hours: s.duration_minutes ? s.duration_minutes / 60 : null,
      destination: s.destinations?.name ?? null, category: s.categories?.name ?? null, about: (s.description ?? "").slice(0, 200),
    }));

    const schema = {
      type: "object", additionalProperties: false,
      required: ["title", "overview", "days", "estimated_total_usd"],
      properties: {
        title: { type: "string" }, overview: { type: "string" }, estimated_total_usd: { type: "number" },
        days: { type: "array", items: { type: "object", additionalProperties: false, required: ["day", "title", "summary", "service_ids"],
          properties: { day: { type: "integer" }, title: { type: "string" }, summary: { type: "string" }, service_ids: { type: "array", items: { type: "string" } } } } },
      },
    };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"]!, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        store: false,
        stream: true,
        text: { format: { type: "json_schema", name: "trip_plan", strict: true, schema } },
        input: [
          { role: "system", content: "You are a Tanzania travel planner for ExploreBongo. Build realistic day-by-day itineraries. Only reference service ids from the provided catalog; if none fit a day, leave service_ids empty and give general advice. Respect the budget. Keep each summary under 60 words." },
          { role: "user", content: `Trip: ${data.days} days, ${data.travelers} traveler(s), budget USD ${data.budget}. Interests: ${data.interests || "general"}.\nCatalog: ${JSON.stringify(catalog)}` },
        ],
      }),
    });
    if (res.status === 429) throw new Error("The planner is busy right now. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Please contact ExploreBongo.");
    if (!res.ok || !res.body) throw new Error("Could not generate a plan. Please try again.");
    let args = "", buf = "";
    const reader = res.body.getReader(); const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try { const ev = JSON.parse(l.slice(5).trim()); if (ev.type === "response.output_text.delta") args += ev.delta; } catch { /* ignore */ }
      }
    }
    if (!args) throw new Error("Could not generate a plan. Please try again.");
    const plan = JSON.parse(args) as Plan;
    const valid = new Set(catalog.map((c) => c.id));
    plan.days = plan.days.map((d) => ({ ...d, service_ids: (d.service_ids ?? []).filter((id) => valid.has(id)) }));
    return { plan, services: catalog.filter((c) => plan.days.some((d) => d.service_ids.includes(c.id))) };
  });
