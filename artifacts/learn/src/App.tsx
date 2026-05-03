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
import { LayoutDashboard, BookOpen, User, MessageCircle } from "lucide-react";

type Route =
  | "dashboard"
  | "chat"
  | "paths"
  | `path/${string}`
  | `lesson/${string}`
  | "profile";

const AVATAR_APPEARANCES = [
  { id: "nebula" as const, colors: "from-violet-500 to-indigo-600", symbol: "✦" },
  { id: "flame" as const, colors: "from-orange-500 to-red-600", symbol: "◈" },
  { id: "crystal" as const, colors: "from-cyan-400 to-blue-600", symbol: "◆" },
  { id: "aurora" as const, colors: "from-green-400 to-teal-500", symbol: "◉" },
];

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

  // If onboarding not done
  if (!appState.profile?.onboardingDone) {
    return (
      <>
        <Onboarding
          onComplete={profile => {
            const next: AppState = {
              ...appState,
              profile,
              messages: [],
            };
            setAppState(next);
            setRoute("dashboard");
          }}
        />
        <Toaster />
      </>
    );
  }

  const profile = appState.profile!;
  const avatarApp = AVATAR_APPEARANCES.find(a => a.id === profile.avatar.appearance)!;

  const NAV_ITEMS = [
    { id: "dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "Home" },
    { id: "paths", icon: <BookOpen className="w-5 h-5" />, label: "Learn" },
    { id: "chat", icon: <MessageCircle className="w-5 h-5" />, label: "Tutor" },
    { id: "profile", icon: <User className="w-5 h-5" />, label: "Profile" },
  ] as const;

  const activeTab = route.startsWith("path/") || route.startsWith("lesson/")
    ? "paths"
    : route === "chat"
    ? "chat"
    : route === "profile"
    ? "profile"
    : "dashboard";

  const renderContent = () => {
    if (route === "dashboard") {
      return <Dashboard state={appState} onNavigate={navigate} />;
    }
    if (route === "chat") {
      return (
        <Chat
          state={chatContext ? { ...appState, messages: [] } : appState}
          onStateChange={handleStateChange}
          onBack={() => {
            setChatContext(undefined);
            setRoute("dashboard");
          }}
        />
      );
    }
    if (route === "paths") {
      return <Paths state={appState} onNavigate={navigate} />;
    }
    if (route.startsWith("path/")) {
      const pathId = route.slice(5);
      return (
        <PathDetail
          pathId={pathId}
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
          onBack={() => window.history.back()}
          onChat={ctx => {
            setChatContext(ctx);
            navigate("chat");
          }}
        />
      );
    }
    if (route === "profile") {
      return <Profile state={appState} onReset={handleReset} />;
    }
    return <Dashboard state={appState} onNavigate={navigate} />;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        {/* Stars bg */}
        <div className="fixed inset-0 stars-bg pointer-events-none opacity-30" />

        {/* Ambient glows */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
        </div>

        {/* Top bar */}
        <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarApp.colors} flex items-center justify-center text-sm`}>
                {avatarApp.symbol}
              </div>
              <span className="font-serif font-bold text-foreground">SRP</span>
              <span className="text-xs text-muted-foreground hidden sm:block">Learn</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs">{profile.avatar.name} ·</span>
              <span className="text-primary font-bold">{profile.xp.toLocaleString()} XP</span>
              {profile.streak > 0 && (
                <span className="flex items-center gap-0.5 text-orange-400 text-xs font-semibold">
                  🔥{profile.streak}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-lg mx-auto px-4 pt-20 pb-24 relative z-10">
          {renderContent()}
        </main>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border">
          <div className="max-w-lg mx-auto px-2 h-16 flex items-center">
            {NAV_ITEMS.map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  data-testid={`nav-${item.id}`}
                  onClick={() => {
                    setChatContext(undefined);
                    navigate(item.id);
                  }}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all duration-200 ${
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium">{item.label}</span>
                  {active && <div className="w-1 h-1 rounded-full bg-primary absolute bottom-1" />}
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
