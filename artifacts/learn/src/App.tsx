import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppState } from "@/lib/store";
import { loadState, saveState } from "@/lib/store";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Chat from "@/pages/Chat";
import Paths from "@/pages/Paths";
import PathDetail from "@/pages/PathDetail";
import Lesson from "@/pages/Lesson";
import Profile from "@/pages/Profile";
import Challenge from "@/pages/Challenge";
import type { ChallengeMode } from "@/lib/challenges";
import { LayoutDashboard, BookOpen, User, MessageCircle, Terminal } from "lucide-react";

type Route =
  | "dashboard"
  | "chat"
  | "paths"
  | `path/${string}`
  | `lesson/${string}`
  | "profile"
  | "challenge"
  | `challenge/${ChallengeMode}`;

const AVATAR_COLORS: Record<string, string> = {
  nebula: "#7c3aed",
  flame: "#ea580c",
  crystal: "#0ea5e9",
  aurora: "#16a34a",
};
const AVATAR_SYMBOLS: Record<string, string> = {
  nebula: "✦",
  flame: "◈",
  crystal: "◆",
  aurora: "◉",
};

function App() {
  const [appState, setAppState] = useState<AppState>(loadState);
  const [route, setRoute] = useState<Route>("dashboard");
  const [chatContext, setChatContext] = useState<string | undefined>(undefined);

  useEffect(() => {
    saveState(appState);
  }, [appState]);

  const handleStateChange = useCallback((next: AppState) => {
    setAppState(next);
  }, []);

  const navigate = useCallback((to: Route | string) => {
    setRoute(to as Route);
  }, []);

  const handleReset = useCallback(() => {
    const fresh: AppState = {
      profile: null,
      messages: [],
      lessonProgress: {},
      todaysXpEarned: 0,
      weeklyXp: [0, 0, 0, 0, 0, 0, 0],
    };
    setAppState(fresh);
    setRoute("dashboard");
  }, []);

  if (!appState.profile?.onboardingDone) {
    return (
      <>
        <Onboarding
          onComplete={profile => {
            const next: AppState = { ...appState, profile, messages: [] };
            setAppState(next);
            setRoute("dashboard");
          }}
        />
        <Toaster />
      </>
    );
  }

  const profile = appState.profile!;
  const avatarColor = AVATAR_COLORS[profile.avatar.appearance] ?? "#7c3aed";
  const avatarSymbol = AVATAR_SYMBOLS[profile.avatar.appearance] ?? "✦";

  const NAV_ITEMS = [
    { id: "dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Home" },
    { id: "challenge", icon: <Terminal className="w-4 h-4" />, label: "Sandbox" },
    { id: "paths", icon: <BookOpen className="w-4 h-4" />, label: "Learn" },
    { id: "chat", icon: <MessageCircle className="w-4 h-4" />, label: "Tutor" },
    { id: "profile", icon: <User className="w-4 h-4" />, label: "Profile" },
  ] as const;

  const activeTab = route.startsWith("path/") || route.startsWith("lesson/")
    ? "paths"
    : route === "chat" ? "chat"
    : route === "profile" ? "profile"
    : route === "challenge" || route.startsWith("challenge/") ? "challenge"
    : "dashboard";

  const renderContent = () => {
    if (route === "dashboard") return <Dashboard state={appState} onNavigate={navigate} />;
    if (route === "chat") return (
      <Chat
        state={chatContext ? { ...appState, messages: [] } : appState}
        onStateChange={handleStateChange}
        onBack={() => { setChatContext(undefined); setRoute("dashboard"); }}
      />
    );
    if (route === "paths") return <Paths state={appState} onNavigate={navigate} />;
    if (route.startsWith("path/")) {
      return (
        <PathDetail
          pathId={route.slice(5)}
          state={appState}
          onBack={() => navigate("paths")}
          onLesson={id => navigate(`lesson/${id}`)}
        />
      );
    }
    if (route.startsWith("lesson/")) {
      const lessonId = route.slice(7);
      return (
        <Lesson
          lessonId={lessonId}
          state={appState}
          onStateChange={handleStateChange}
          onBack={() => {
            const prevPath = route.startsWith("lesson/") ? appState.profile?.currentPath : null;
            navigate(prevPath ? `path/${prevPath}` : "paths");
          }}
          onChat={ctx => { setChatContext(ctx); navigate("chat"); }}
        />
      );
    }
    if (route === "profile") return <Profile state={appState} onReset={handleReset} />;
    if (route === "challenge" || route.startsWith("challenge/")) {
      const modeFromRoute = route.startsWith("challenge/")
        ? (route.slice(10) as ChallengeMode)
        : "beginner";
      return (
        <Challenge
          state={appState}
          onStateChange={handleStateChange}
          onBack={() => navigate("dashboard")}
          initialMode={modeFromRoute}
        />
      );
    }
    return <Dashboard state={appState} onNavigate={navigate} />;
  };

  const isChallengePage = route === "challenge" || route.startsWith("challenge/");

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        {/* Subtle dot grid background */}
        <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" />

        {/* Top bar */}
        <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                style={{ background: avatarColor, color: "#fff" }}
              >
                {avatarSymbol}
              </div>
              <span className="font-mono text-sm font-bold tracking-tight text-foreground">SRP Learn</span>
              <span className="font-mono text-xs text-muted-foreground hidden sm:inline">/ Web3 Mentor</span>
            </div>

            {/* Right: stats */}
            <div className="flex items-center gap-3">
              {profile.streak > 0 && (
                <span className="font-mono text-xs text-amber-400 font-medium">
                  {profile.streak}d streak
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">{profile.xp.toLocaleString()} XP</span>
            </div>
          </div>
        </header>

        {/* Main content */}
        {isChallengePage ? (
          <main className="fixed inset-0 top-12 bottom-14 overflow-hidden z-10">
            {renderContent()}
          </main>
        ) : (
          <main className="max-w-lg mx-auto px-4 pt-16 pb-20 relative z-10">
            {renderContent()}
          </main>
        )}

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
            {NAV_ITEMS.map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  data-testid={`nav-${item.id}`}
                  onClick={() => { setChatContext(undefined); navigate(item.id); }}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 transition-all duration-150 ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground/60"
                  }`}
                >
                  <div className="relative">
                    {item.icon}
                    {active && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-foreground" />
                    )}
                  </div>
                  <span className="font-mono text-[10px] font-medium tracking-wide uppercase">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
