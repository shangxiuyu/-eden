/**
 * [INPUT]: 依赖 components/landing 各分区组件
 * [OUTPUT]: 对外提供 LandingPage 页面组件
 * [POS]: pages/ 的营销落地页，组合 10 个分区组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HeroSection } from "@/components/landing/HeroSection";
import { LogoBarSection } from "@/components/landing/LogoBarSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { ContactSection } from "@/components/landing/ContactSection";
import { FinalCTASection } from "@/components/landing/FinalCTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export function LandingPage() {
  return (
    <div className="space-y-0">
      <HeroSection />
      <LogoBarSection />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <ContactSection />
      <FinalCTASection />
      <LandingFooter />
    </div>
  );
}
