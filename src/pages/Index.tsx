import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { JoinSection } from "@/components/landing/JoinSection";
import { Stats } from "@/components/landing/Stats";
import { GovernmentStructure } from "@/components/landing/GovernmentStructure";
import { CommunitySection } from "@/components/landing/CommunitySection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <JoinSection />
        <Stats />
        <GovernmentStructure />
        <CommunitySection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
