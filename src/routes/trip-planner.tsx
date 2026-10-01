import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicLayout, PageIntro } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/trip-planner")({
  head: () => ({
    meta: [
      { title: "AI Trip Planner — ExploreBongo" },
      { name: "description", content: "Plan your Tanzania trip with AI — coming soon to ExploreBongo." },
      { property: "og:title", content: "AI Trip Planner — ExploreBongo" },
      { property: "og:description", content: "AI-assisted Tanzania itineraries, coming soon." },
    ],
  }),
  component: () => (
    <PublicLayout>
      <PageIntro eyebrow="AI Trip Planner" title="Your Tanzania itinerary, planned in minutes">
        Tell us your dates, budget and interests — we'll suggest a trip built from real local providers.
      </PageIntro>
      <section className="mx-auto max-w-xl px-5 py-16 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-gold" />
        <p className="mt-4 text-muted-foreground">The AI Trip Planner is coming in a later phase. Create an account to be first to try it.</p>
        <Button asChild variant="gold" size="lg" className="mt-6"><Link to="/auth" search={{ mode: "signup" }}>Create account</Link></Button>
      </section>
    </PublicLayout>
  ),
});
