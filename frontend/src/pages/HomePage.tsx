import { BrandStory } from '@/components/home/BrandStory'
import { CTASection } from '@/components/home/CTASection'
import { Hero } from '@/components/home/Hero'
import { HowItWorks } from '@/components/home/HowItWorks'
import { SubjectGrid } from '@/components/home/SubjectGrid'
import { WhyTedor } from '@/components/home/WhyTedor'
import { PageShell } from '@/components/layout/PageShell'

export function HomePage() {
  return (
    <PageShell bare>
      <Hero />
      <SubjectGrid />
      <HowItWorks />
      <WhyTedor />
      <BrandStory />
      <CTASection />
    </PageShell>
  )
}
