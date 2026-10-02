import { useQueryClient } from '@tanstack/react-query';
import { ActivityIcon, FolderTreeIcon, InboxIcon, LayoutGridIcon, ListChecksIcon, LogOutIcon, UploadIcon, UsersIcon } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useMe } from './auth';
import { usePendingCount } from './pages/BankPage';

const NAV = [
  { to: '/admin', label: 'نظرة عامة', icon: LayoutGridIcon, end: true },
  { to: '/admin/stats', label: 'الإحصائيات', icon: ActivityIcon },
  { to: '/admin/questions', label: 'الأسئلة', icon: ListChecksIcon },
  { to: '/admin/bank', label: 'بنك الأسئلة', icon: InboxIcon, badge: true },
  { to: '/admin/categories', label: 'الفئات', icon: FolderTreeIcon },
  { to: '/admin/import', label: 'استيراد', icon: UploadIcon },
  { to: '/admin/admins', label: 'المشرفون', icon: UsersIcon },
];

export function AdminLayout() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pending = usePendingCount();

  async function logout() {
    await api.logout();
    queryClient.clear();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-svh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:flex md:h-svh md:flex-col md:border-b-0 md:border-e">
        <div className="flex items-center justify-between gap-2 px-4 py-4 md:block">
          <div className="flex items-center gap-2 text-lg font-black">
            <img src="/icons/icon-192.png" alt="" className="size-9 rounded-xl" />
            <span><span className="text-primary">جاوب</span> أو <span className="text-sky-500">بادل</span></span>
          </div>
          <div className="flex items-center gap-1 md:block">
            <div className="text-xs text-muted-foreground md:mt-0.5">لوحة التحكم</div>
            <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={logout} aria-label="تسجيل الخروج"><LogOutIcon /></Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
          {NAV.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isActive && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                )
              }
            >
              <Icon className="size-4" />
              {label}
              {badge && !!pending.data && (
                <span className="ms-auto rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">{pending.data}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t p-3 md:block">
          <div className="mb-2 truncate text-xs text-muted-foreground" title={me.data?.email}>{me.data?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOutIcon /> تسجيل الخروج
          </Button>
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
