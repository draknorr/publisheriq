import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { FeaturesSection } from "./FeaturesSection";
import { WaitlistCTA } from "./WaitlistCTA";
import { LandingFooter } from "./LandingFooter";

export function LandingPage() {
  return (
    <div
      id="main-content"
      className="min-h-screen bg-surface text-text-primary"
    >
      <LandingNav />

      <main>
        <HeroSection />
        <FeaturesSection />
        <WaitlistCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
