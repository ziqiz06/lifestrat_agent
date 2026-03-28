'use client';
import { useAppStore } from '@/store/appStore';
import OnboardingSurvey from '@/components/onboarding/OnboardingSurvey';
import Navigation from '@/components/layout/Navigation';
import Dashboard from '@/components/dashboard/Dashboard';
import CalendarView from '@/components/calendar/CalendarView';
import OpportunitiesView from '@/components/opportunities/OpportunitiesView';
import PreferencesView from '@/components/preferences/PreferencesView';
import { UserProfile } from '@/types';

export default function Home() {
  const { onboardingComplete, activeTab, completeOnboarding, generateAIInsights } = useAppStore();

  const handleOnboardingComplete = (profile: UserProfile) => {
    completeOnboarding(profile);
    // Kick off AI insights generation in the background
    generateAIInsights(profile);
  };

  if (!onboardingComplete) {
    return <OnboardingSurvey onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="pb-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'opportunities' && <OpportunitiesView />}
        {activeTab === 'preferences' && <PreferencesView />}
      </main>
    </div>
  );
}
