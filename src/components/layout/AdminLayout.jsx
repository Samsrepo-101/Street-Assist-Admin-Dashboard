import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NotificationPopper from './NotificationPopper';

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
  const title = pageTitles[location.pathname] || 'StreetAssist Admin';

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
