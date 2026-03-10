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
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PricingSection } from "@/components/landing/PricingSection";

const queryClient = new QueryClient();

// Standalone pricing page wrapper
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
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/pricing" element={<PricingPage />} />
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
