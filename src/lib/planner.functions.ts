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

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a Tanzania travel planner for ExploreBongo. Build realistic day-by-day itineraries. Only reference service ids from the provided catalog; if none fit a day, leave service_ids empty and give general advice. Respect the budget." },
          { role: "user", content: `Trip: ${data.days} days, ${data.travelers} traveler(s), budget USD ${data.budget}. Interests: ${data.interests || "general"}.\nCatalog: ${JSON.stringify(catalog)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_plan",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" }, overview: { type: "string" }, estimated_total_usd: { type: "number" },
                days: { type: "array", items: { type: "object", properties: { day: { type: "integer" }, title: { type: "string" }, summary: { type: "string" }, service_ids: { type: "array", items: { type: "string" } } }, required: ["day", "title", "summary", "service_ids"] } },
              },
              required: ["title", "overview", "days", "estimated_total_usd"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_plan" } },
      }),
    });
    if (res.status === 429) throw new Error("The planner is busy right now. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Please contact ExploreBongo.");
    if (!res.ok) throw new Error("Could not generate a plan. Please try again.");
    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Could not generate a plan. Please try again.");
    const plan = JSON.parse(args) as Plan;
    const valid = new Set(catalog.map((c) => c.id));
    plan.days = plan.days.map((d) => ({ ...d, service_ids: (d.service_ids ?? []).filter((id) => valid.has(id)) }));
    return { plan, services: catalog.filter((c) => plan.days.some((d) => d.service_ids.includes(c.id))) };
  });
