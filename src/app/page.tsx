'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppStore } from '@/store/appStore';
import AuthScreen from '@/components/auth/AuthScreen';
import OnboardingSurvey from '@/components/onboarding/OnboardingSurvey';
import Navigation from '@/components/layout/Navigation';
import Dashboard from '@/components/dashboard/Dashboard';
import CalendarView from '@/components/calendar/CalendarView';
import OpportunitiesView from '@/components/opportunities/OpportunitiesView';
import PreferencesView from '@/components/preferences/PreferencesView';
import { UserProfile } from '@/types';
import {
  saveProfile, loadProfile,
  loadOpportunityDecisions, saveOpportunityDecisions,
  loadCalendarTasks, saveCalendarTasks,
  loadGoals, saveGoals,
} from '@/lib/supabaseSync';

type AppPhase = 'loading' | 'auth' | 'onboarding' | 'app';

export default function Home() {
  const {
    activeTab, completeOnboarding, generateAIInsights,
    opportunities, setOpportunityInterest, calendarTasks,
    goals, setGoals,
  } = useAppStore();

  const [phase, setPhase] = useState<AppPhase>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createClient();

  // Load user session and their data on mount
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setPhase('auth');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);
      await loadUserData(user.id);
    };

    init();

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
        await loadUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setPhase('auth');
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async (uid: string) => {
    // Load saved profile
    const savedProfile = await loadProfile(uid);

    if (!savedProfile) {
      setPhase('onboarding');
      return;
    }

    // Restore profile
    completeOnboarding(savedProfile);

    // Restore opportunity decisions
    const decisions = await loadOpportunityDecisions(uid);
    const store = useAppStore.getState();
    for (const [oppId, decision] of Object.entries(decisions)) {
      const opp = store.opportunities.find((o) => o.id === oppId);
      if (opp) {
        setOpportunityInterest(oppId, decision.interested);
      }
    }

    // Restore user-added calendar tasks
    const savedTasks = await loadCalendarTasks(uid);
    // These are already in the store via addOpportunityToCalendar, but restore if missing
    const currentTaskIds = new Set(useAppStore.getState().calendarTasks.map((t) => t.id));
    for (const task of savedTasks) {
      if (!currentTaskIds.has(task.id)) {
        useAppStore.setState((state) => ({
          calendarTasks: [...state.calendarTasks, task],
        }));
      }
    }

    // Restore goals
    const savedGoals = await loadGoals(uid);
    if (savedGoals) setGoals(savedGoals);

    setPhase('app');
  };

  const handleOnboardingComplete = async (profile: UserProfile) => {
    completeOnboarding(profile);
    generateAIInsights(profile);
    if (userId) {
      await saveProfile(userId, profile);
    }
    setPhase('app');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPhase('auth');
  };

  // Auto-save opportunity decisions when they change
  useEffect(() => {
    if (!userId || phase !== 'app') return;
    const decided = opportunities.filter((o) => o.interested !== null);
    if (decided.length > 0) {
      saveOpportunityDecisions(userId, opportunities);
    }
  }, [opportunities, userId, phase]);

  // Auto-save calendar tasks when they change
  useEffect(() => {
    if (!userId || phase !== 'app') return;
    saveCalendarTasks(userId, calendarTasks);
  }, [calendarTasks, userId, phase]);

  // Auto-save goals when they change
  useEffect(() => {
    if (!userId || phase !== 'app') return;
    saveGoals(userId, goals);
  }, [goals, userId, phase]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🧭</div>
          <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (phase === 'auth') {
    return <AuthScreen onAuthenticated={() => {}} />;
  }

  if (phase === 'onboarding') {
    return <OnboardingSurvey onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation userEmail={userEmail} onSignOut={handleSignOut} />
      <main className="pb-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'opportunities' && <OpportunitiesView />}
        {activeTab === 'preferences' && <PreferencesView userId={userId} />}
      </main>
    </div>
  );
}
