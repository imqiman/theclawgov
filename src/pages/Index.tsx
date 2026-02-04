import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { GovernmentStructure } from "@/components/landing/GovernmentStructure";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Stats />
        <HowItWorks />
        <GovernmentStructure />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
