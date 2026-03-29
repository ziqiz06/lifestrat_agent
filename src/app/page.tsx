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
  } = useAppStore();

  const [phase, setPhase] = useState<AppPhase>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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

    // Auth state listener — only used for token refresh, not login/logout
    // Login is handled by onAuthenticated, logout by handleSignOut
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {});

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
      setPhase("app");

      // Restore decisions, tasks, goals in background
      const decisions = await loadOpportunityDecisions(uid);
      useAppStore.setState((state) => ({
        opportunities: state.opportunities.map((o) => {
          const d = decisions[o.id];
          return d
            ? {
                ...o,
                interested: d.interested,
                addedToCalendar: d.addedToCalendar,
              }
            : o;
        }),
      }));

      const { added, removedIds } = await loadCalendarTasks(uid);
      useAppStore.setState((state) => {
        const removedSet = new Set(removedIds);
        const existingIds = new Set(state.calendarTasks.map((t) => t.id));
        // Remove mock tasks the user deleted, add user-added tasks back
        const merged = [
          ...state.calendarTasks.filter((t) => !removedSet.has(t.id)),
          ...added.filter((t) => !existingIds.has(t.id)),
        ];
        return { calendarTasks: merged, conflicts: detectConflicts(merged) };
      });

      const savedGoals = await loadGoals(uid);
      if (savedGoals) setGoals(savedGoals);
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
    resetStore(); // clear Zustand state
    localStorage.removeItem("lifestrat-app-state"); // clear persisted cache
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
