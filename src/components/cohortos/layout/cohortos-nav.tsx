'use client';

import {
  BarChart3,
  Bell,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/cohortos/dashboard', icon: LayoutDashboard },
  { label: 'Students', href: '/cohortos/students', icon: Users },
  { label: 'Surveys', href: '/cohortos/surveys', icon: ClipboardList },
  { label: 'Reports', href: '/cohortos/reports', icon: BarChart3 },
  { label: 'Settings', href: '/cohortos/settings', icon: Settings },
];

export function CohortosNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/cohortos/dashboard') {
      return pathname === '/cohortos/dashboard' || pathname === '/cohortos';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left side: Logo + University */}
          <div className="flex items-center gap-4">
            <Link href="/cohortos/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="font-semibold text-slate-900 hidden sm:inline">CohortOS</span>
            </Link>
            <div className="hidden md:flex items-center">
              <span className="text-slate-300 mx-3">|</span>
              <span className="text-sm text-slate-600">Pepperdine Graziadio</span>
            </div>
          </div>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side: Notifications + User */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-medium bg-red-500 text-white rounded-full px-1">
                3
              </span>
            </button>

            {/* User Menu (non-functional for demo) */}
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-slate-600">KM</span>
              </div>
              <span className="hidden sm:inline font-medium">Kazah Mims</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3 flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
