import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import KnowledgeLibrary from "./pages/KnowledgeLibrary";
import StudyModePage from "./pages/StudyModePage";
import PodcastPage from "./pages/PodcastPage";
import KnowledgeGraphPage from "./pages/KnowledgeGraphPage";
import HighlightsPage from "./pages/HighlightsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import CompareVideosPage from "./pages/CompareVideosPage";
import IdeaGeneratorPage from "./pages/IdeaGeneratorPage";
import BookmarksPage from "./pages/BookmarksPage";
import SlideGeneratorPage from "./pages/SlideGeneratorPage";
import TimelineViewerPage from "./pages/TimelineViewerPage";
import SecondBrainPage from "./pages/SecondBrainPage";
import CreatorModePage from "./pages/CreatorModePage";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PricingSection } from "@/components/landing/PricingSection";

const queryClient = new QueryClient();

function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <PricingSection />
    </div>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/knowledge" element={<KnowledgeLibrary />} />
                <Route path="/study" element={<StudyModePage />} />
                <Route path="/podcasts" element={<PodcastPage />} />
                <Route path="/graph" element={<KnowledgeGraphPage />} />
                <Route path="/highlights" element={<HighlightsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/compare" element={<CompareVideosPage />} />
                <Route path="/ideas" element={<IdeaGeneratorPage />} />
                <Route path="/bookmarks" element={<BookmarksPage />} />
                <Route path="/slides" element={<SlideGeneratorPage />} />
                <Route path="/timeline" element={<TimelineViewerPage />} />
                <Route path="/second-brain" element={<SecondBrainPage />} />
                <Route path="/creator-mode" element={<CreatorModePage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
