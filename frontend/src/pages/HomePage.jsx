import React from 'react';
import PublicLayout from '../components/public/PublicLayout';
import HeroSection from '../components/home/HeroSection';
import BannerSection from '../components/home/BannerSection';
import NewsIntegrationSection from '../components/home/NewsIntegrationSection';
import FeaturesSection from '../components/home/FeaturesSection';
import GallerySection from '../components/home/GallerySection';
import StatisticsSection from '../components/home/StatisticsSection';

export default function HomePage() {
  return (
    <PublicLayout>
      <HeroSection />
      <NewsIntegrationSection />
      <BannerSection />
      <FeaturesSection />
      <GallerySection />
      <StatisticsSection />
    </PublicLayout>
  );
}
