import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from '@/lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import AdminLayout from '@/components/layout/AdminLayout';
import Dashboard from '@/pages/Dashboard';
import Reports from '@/pages/Reports';
import Announcements from '@/pages/Announcements';
import Archive from '@/pages/Archive';
import Trash from '@/pages/Trash';
import Notifications from '@/pages/Notification';
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';

function ProtectedRoute() {
  const { isLoadingAuth, currentUser, isAdmin } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/"              element={<Dashboard />} />
                <Route path="/reports"       element={<Reports />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/archive"       element={<Archive />} />
                <Route path="/trash"         element={<Trash />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile"       element={<Profile />} />
              </Route>
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
