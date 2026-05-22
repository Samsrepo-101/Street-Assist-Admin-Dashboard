import React, { useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NotificationPopper from './NotificationPopper';
import { useAuth } from '../../lib/AuthContext';
import { isMissingAnimalsAdminRole } from '../../lib/adminRoles.js';

const pageTitles = {
  '/':              'Dashboard',
  '/reports':       'Reports Management',
  '/announcements': 'Announcements',
  '/trash':         'Trash',
  '/notifications': 'Notifications',
  '/profile':       'My Profile',
};

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { adminRole } = useAuth();
  const title = pageTitles[location.pathname] || 'StreetAssist Admin';
  const isMissingAnimalsAdmin = isMissingAnimalsAdminRole(adminRole);

  if (isMissingAnimalsAdmin && !['/reports', '/profile'].includes(location.pathname)) {
    return <Navigate to="/reports" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Real-time notification pop-ups — renders nothing visually */}
      <NotificationPopper />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
        />
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
