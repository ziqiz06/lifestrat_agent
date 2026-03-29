"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAppStore } from "@/store/appStore";
import AuthScreen from "@/components/auth/AuthScreen";
import SignedOutPage from "@/components/auth/SignedOutPage";
import OnboardingSurvey from "@/components/onboarding/OnboardingSurvey";
import Navigation from "@/components/layout/Navigation";
import Dashboard from "@/components/dashboard/Dashboard";
import CalendarView from "@/components/calendar/CalendarView";
import OpportunitiesView from "@/components/opportunities/OpportunitiesView";
import PreferencesView from "@/components/preferences/PreferencesView";
import CharacterView from "@/components/character/CharacterView";
import { UserProfile } from "@/types";
import {
  saveProfile,
  loadProfile,
  loadOpportunityDecisions,
  saveOpportunityDecisions,
  loadCalendarTasks,
  saveCalendarTasks,
  loadGoals,
  saveGoals,
  loadUserEmails,
} from "@/lib/supabaseSync";
import { mockCalendarTasks } from "@/data/mockCalendar";
import { detectConflicts } from "@/lib/conflictDetection";

const MOCK_TASK_IDS = mockCalendarTasks.map((t) => t.id);

type AppPhase = "loading" | "auth" | "signedout" | "onboarding" | "app";

export default function Home() {
  const {
    activeTab,
    completeOnboarding,
    generateAIInsights,
    opportunities,
    calendarTasks,
    goals,
    setGoals,
    resetStore,
    setEmails,
  } = useAppStore();

  const [phase, setPhase] = useState<AppPhase>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pendingGmailImport, setPendingGmailImport] = useState<{ providerToken: string; userId: string } | null>(null);
  const supabase = createClient();

  // Load user session and their data on mount
  useEffect(() => {
    const init = async () => {
      // Hard timeout — never stay on "Loading..." for more than 3 seconds
      const timeout = setTimeout(() => setPhase("auth"), 3000);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          clearTimeout(timeout);
          setPhase("auth");
          return;
        }

        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);

        // Gmail param check handled in onAuthStateChange below (provider_token more reliable there)

        // Transition immediately based on local cache, then sync from Supabase
        const localState = useAppStore.getState();
        if (localState.onboardingComplete && localState.profile.completed) {
          clearTimeout(timeout);
          setPhase("app");
          // Sync from Supabase in background — don't block
          loadUserData(session.user.id);
        } else {
          await loadUserData(session.user.id);
          clearTimeout(timeout);
        }
      } catch (e) {
        console.error("Auth init error:", e);
        clearTimeout(timeout);
        setPhase("auth");
      }
    };

    init();

    // Auth state listener — handles Gmail OAuth callback (provider_token is reliable here)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('gmail') === 'connected') {
          window.history.replaceState({}, '', '/');
          // Buffer the token — dispatch after OpportunitiesView is mounted (phase === 'app')
          setPendingGmailImport({ providerToken: session.provider_token, userId: session.user.id });
        }
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async (uid: string) => {
    // All DB work is best-effort — never block phase transitions
    try {
      const savedProfile = await loadProfile(uid);
      if (!savedProfile) {
        // No DB profile — check local cache, save it if present
        const localState = useAppStore.getState();
        if (localState.onboardingComplete && localState.profile.completed) {
          saveProfile(uid, localState.profile).catch(() => {});
        } else {
          setPhase("onboarding");
        }
        return;
      }

      // Restore profile from Supabase
      completeOnboarding(savedProfile);

      // Load ALL data before transitioning — prevents auto-save overwriting restored state
      const [decisions, calendarData, savedGoals, savedEmails] = await Promise.all([
        loadOpportunityDecisions(uid),
        loadCalendarTasks(uid),
        loadGoals(uid),
        loadUserEmails(uid),
      ]);

      // Restore Gmail-imported emails if present, otherwise reset gmailConnected
      // (prevents one user's localStorage flag from bleeding into another user's session)
      if (savedEmails?.length) {
        setEmails(savedEmails);
      } else {
        useAppStore.setState({ gmailConnected: false, emails: [], opportunities: [] });
      }

      // Apply everything at once
      useAppStore.setState((state) => {
        // Restore opportunity decisions
        const updatedOpps = state.opportunities.map((o) => {
          const d = decisions[o.id];
          return d ? { ...o, interested: d.interested, addedToCalendar: d.addedToCalendar } : o;
        });

        // Rebuild calendar: start from mock, remove deleted, add saved user tasks
        const removedSet = new Set(calendarData.removedIds);
        const existingIds = new Set(state.calendarTasks.map((t) => t.id));
        const merged = [
          ...state.calendarTasks.filter((t) => !removedSet.has(t.id)),
          ...calendarData.added.filter((t) => !existingIds.has(t.id)),
        ];

        return {
          opportunities: updatedOpps,
          calendarTasks: merged,
          conflicts: detectConflicts(merged, useAppStore.getState().profile),
        };
      });

      if (savedGoals) setGoals(savedGoals);

      // Transition AFTER all data is applied — prevents auto-save race condition
      setPhase('app');
    } catch (e) {
      console.warn("Supabase sync error (non-fatal):", e);
      // Fall back to local state
      const localState = useAppStore.getState();
      if (localState.onboardingComplete && localState.profile.completed) {
        setPhase("app");
      } else {
        setPhase("onboarding");
      }
    }
  };

  const handleOnboardingComplete = async (profile: UserProfile) => {
    completeOnboarding(profile);
    generateAIInsights(profile);
    setPhase("app"); // transition immediately — don't block on DB
    if (userId) {
      try {
        await saveProfile(userId, profile);
      } catch (e) {
        console.error("saveProfile failed:", e);
      }
    }
  };

  const handleSignOut = async () => {
    setUserId(null);
    setUserEmail(null);
    resetStore();
    localStorage.removeItem("lifestrat-app-state"); // wipe all persisted state including gmailConnected
    await supabase.auth.signOut();
    setPhase("signedout");
  };

  // Auto-save opportunity decisions when they change
  useEffect(() => {
    if (!userId || phase !== "app") return;
    const decided = opportunities.filter((o) => o.interested !== null);
    if (decided.length > 0) {
      saveOpportunityDecisions(userId, opportunities).catch(console.error);
    }
  }, [opportunities, userId, phase]);

  // Auto-save calendar tasks when they change
  useEffect(() => {
    if (!userId || phase !== "app") return;
    saveCalendarTasks(userId, calendarTasks, MOCK_TASK_IDS).catch(
      console.error,
    );
  }, [calendarTasks, userId, phase]);

  // Auto-save goals when they change
  useEffect(() => {
    if (!userId || phase !== "app") return;
    saveGoals(userId, goals).catch(console.error);
  }, [goals, userId, phase]);

  // Dispatch gmail:connected only after OpportunitiesView is mounted (phase === 'app')
  useEffect(() => {
    if (phase !== 'app' || !pendingGmailImport) return;
    window.dispatchEvent(
      new CustomEvent('gmail:connected', { detail: pendingGmailImport }),
    );
    setPendingGmailImport(null);
  }, [phase, pendingGmailImport]);

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🧭</div>
          <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (phase === "signedout") {
    return <SignedOutPage onSignIn={() => setPhase("auth")} />;
  }

  if (phase === "auth") {
    return (
      <AuthScreen
        onAuthenticated={(user) => {
          // Set user identity immediately — never block on DB
          setUserId(user.id);
          setUserEmail(user.email ?? null);
          // Decide phase from local cache, then sync DB in background
          const localState = useAppStore.getState();
          if (localState.onboardingComplete && localState.profile.completed) {
            setPhase("app");
            loadUserData(user.id); // background sync, no await
          } else {
            setPhase("onboarding");
            loadUserData(user.id); // background sync, may upgrade to 'app' if profile found
          }
        }}
      />
    );
  }

  if (phase === "onboarding") {
    return <OnboardingSurvey onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation userEmail={userEmail} onSignOut={handleSignOut} />
      <main className="pb-8">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "calendar" && <CalendarView />}
        {activeTab === "opportunities" && <OpportunitiesView />}
        {activeTab === "preferences" && <PreferencesView userId={userId} />}
        {activeTab === "character" && <CharacterView />}
      </main>
    </div>
  );
}
