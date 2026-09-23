import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Navbar from "./components/Navbar.jsx";
import FeedPage from "./pages/FeedPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PostDetailPage from "./pages/PostDetailPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";
import ProfilePage from "./pages/profile/ProfilePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import BookmarksPage from "./pages/BookmarksPage.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import { SubscriptionProvider } from "./context/SubscriptionContext.jsx";

function AppShell() {
  useAuth();

  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/post/:slug" element={<PostDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/editor" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
          <Route path="/editor/:id" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
          <Route path="/profile/:username" element={<ProfilePage />} />
          <Route path="*" element={<PlaceholderPage />} />
        </Routes>
      </main>
      <footer className="site-footer"><span>hashnode/lab</span><span>A quiet place for useful ideas.</span></footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider><AppShell /></SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App
