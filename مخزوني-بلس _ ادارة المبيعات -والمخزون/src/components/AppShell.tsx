import React, { useState } from 'react';
import {
  Archive,
  BarChart3,
  Bell,
  Boxes,
  CloudOff,
  History,
  LayoutGrid,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import type { AppSettings, Customer, Product, TabKey } from '../types';
import { formatCurrency } from '../utils/format';
import { PWAInstallButton } from './PWAInstallButton';

interface AppShellProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onOpenSettings: () => void;
  onOpenStockMovements: () => void;
  onOpenInvoicesArchive: () => void;
  onQuickNewInvoice: () => void;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
  suppressPrintShell?: boolean;
  settings: AppSettings;
  criticalProducts: Product[];
  overdueCustomers: Customer[];
  children: React.ReactNode;
}

const SUBTITLES: Record<TabKey, string> = {
  dashboard: 'Dashboard',
  products: 'Products Inventory',
  invoices: 'Pos Billing',
  customers: 'Customers Debts',
  reports: 'Financial Reports',
};

const NAV_ITEMS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: 'الرئيسية', icon: LayoutGrid },
  { key: 'products', label: 'المنتجات', icon: Boxes },
  { key: 'invoices', label: 'الفواتير', icon: ReceiptText },
  { key: 'customers', label: 'العملاء', icon: Users },
  { key: 'reports', label: 'التقارير', icon: BarChart3 },
];

export function AppShell({
  activeTab,
  onSelectTab,
  onOpenSettings,
  onOpenStockMovements,
  onOpenInvoicesArchive,
  onQuickNewInvoice,
  isOnline,
  pendingSyncCount,
  isSyncing,
  onSyncNow,
  suppressPrintShell = false,
  settings,
  criticalProducts,
  overdueCustomers,
  children,
}: AppShellProps) {
  const [showAlerts, setShowAlerts] = useState(false);
  const alertsCount = criticalProducts.length + overdueCustomers.length;

  return (
    <div className="min-h-screen bg-[#0D0E12] text-[#F1F5F9] flex flex-col lg:flex-row print:min-h-0 print:bg-white print:block">
      {/* Desktop Sidebar (RTL Right) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#12141C] border-l border-[#222533] sticky top-0 h-screen p-4 justify-between no-print">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A799FF] to-[#7C6AF2] flex items-center justify-center shadow-lg shadow-[#A799FF]/20 shrink-0">
              <Archive className="w-5 h-5 text-[#0D0E12]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-[#A799FF] truncate">{settings.store_name}</h1>
              <p className="text-[11px] text-slate-400 font-medium">{SUBTITLES[activeTab]}</p>
            </div>
          </div>

          {/* Primary Nav */}
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectTab(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-[#A799FF]/15 text-[#A799FF] border border-[#A799FF]/30'
                      : 'text-slate-400 hover:text-white hover:bg-[#1A1D29] border border-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Secondary Quick Shortcuts */}
          <div className="pt-4 border-t border-[#222533] space-y-1.5">
            <p className="px-3 text-[11px] font-semibold text-slate-500">أدوات سريعة</p>
            <button
              type="button"
              onClick={onQuickNewInvoice}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-l from-[#A799FF] to-[#8C7AE6] text-[#0D0E12] hover:opacity-95 transition-opacity"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>إنشاء فاتورة جديدة</span>
            </button>
            <button
              type="button"
              onClick={onOpenInvoicesArchive}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#1A1D29] transition-colors"
            >
              <ReceiptText className="w-4 h-4 shrink-0 text-[#38BDF8]" />
              <span>إدارة وسجل الفواتير</span>
            </button>
            <button
              type="button"
              onClick={onOpenStockMovements}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#1A1D29] transition-colors"
            >
              <History className="w-4 h-4 shrink-0 text-[#2EE59D]" />
              <span>سجل حركات المخزون</span>
            </button>
            <PWAInstallButton />
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-3 p-3 rounded-2xl bg-[#171923] border border-[#252836] hover:border-[#A799FF]/40 transition-colors text-right"
        >
          <div className="w-9 h-9 rounded-xl bg-[#A799FF]/15 text-[#A799FF] flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{settings.manager_name}</p>
            <p className="text-[11px] text-slate-400 truncate">إعدادات النظام</p>
          </div>
        </button>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-24 lg:pb-8 print:pb-0">
        {/* Top App Bar */}
        <header className="sticky top-0 z-30 bg-[#0D0E12]/90 backdrop-blur-md border-b border-[#1D202C] px-4 py-3 lg:px-8 no-print">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            {/* Brand Lockup */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="lg:hidden w-10 h-10 rounded-xl bg-gradient-to-br from-[#A799FF] to-[#7C6AF2] flex items-center justify-center shadow-lg shadow-[#A799FF]/20 shrink-0">
                <Archive className="w-5 h-5 text-[#0D0E12]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base lg:text-lg font-extrabold text-[#A799FF] leading-tight truncate">
                  {settings.store_name}
                </h1>
                <p className="text-xs text-slate-400 font-medium leading-tight">{SUBTITLES[activeTab]}</p>
              </div>
            </div>

            {/* Utility Controls */}
            <div className="flex items-center gap-2 relative">
              {(!isOnline || pendingSyncCount > 0 || isSyncing) && (
                <button
                  type="button"
                  onClick={isOnline && pendingSyncCount > 0 ? onSyncNow : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-colors ${
                    !isOnline
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                      : 'bg-[#142922] border-[#2EE59D]/35 text-[#2EE59D]'
                  }`}
                  title={
                    !isOnline
                      ? 'تعمل الآن بدون إنترنت — يتم حفظ التغييرات محلياً'
                      : 'اضغط لمزامنة التغييرات المحفوظة'
                  }
                >
                  {!isOnline ? (
                    <>
                      <CloudOff className="w-3.5 h-3.5" />
                      <span>بدون إنترنت{pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ''}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'جاري المزامنة...' : `مزامنة (${pendingSyncCount})`}</span>
                    </>
                  )}
                </button>
              )}

              <div className="lg:hidden">
                <PWAInstallButton compact />
              </div>

              <button
                type="button"
                onClick={onOpenSettings}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#181A24] border border-[#252836] flex items-center justify-center text-slate-300 hover:text-white hover:border-[#A799FF]/50 transition-colors"
                title="إعدادات النظام"
                aria-label="إعدادات النظام"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowAlerts((v) => !v)}
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#181A24] border border-[#252836] flex items-center justify-center text-slate-200 hover:border-[#A799FF]/50 transition-colors"
                aria-label="التنبيهات"
              >
                <Bell className="w-4 h-4" />
                {alertsCount > 0 && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#2EE59D]" />
                )}
              </button>

              {/* Alerts Popover */}
              {showAlerts && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAlerts(false)} />
                  <div className="absolute left-0 top-12 z-50 w-80 max-w-[90vw] rounded-2xl bg-[#171923] border border-[#2A2E3E] shadow-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#252836] pb-2">
                      <span className="text-xs font-bold text-white">مركز التنبيهات الفوري</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#A799FF]/15 text-[#A799FF] text-[10px] font-bold">
                        {alertsCount} تنبيه
                      </span>
                    </div>
                    {alertsCount === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">لا توجد تنبيهات حرجة حالياً</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {criticalProducts.map((p) => (
                          <button
                            key={`p-${p.id}`}
                            type="button"
                            onClick={() => {
                              setShowAlerts(false);
                              onSelectTab('products');
                            }}
                            className="w-full text-right p-2.5 rounded-xl bg-[#11131B] border border-[#222533] hover:border-[#F87171]/40 transition-colors"
                          >
                            <p className="text-xs font-bold text-white truncate">{p.name}</p>
                            <p className="text-[11px] text-[#F87171]">
                              مخزون حرج: متبقي {p.stock_qty} {p.unit_label} (حد الطلب: {p.min_stock_threshold})
                            </p>
                          </button>
                        ))}
                        {overdueCustomers.map((c) => (
                          <button
                            key={`c-${c.id}`}
                            type="button"
                            onClick={() => {
                              setShowAlerts(false);
                              onSelectTab('customers');
                            }}
                            className="w-full text-right p-2.5 rounded-xl bg-[#11131B] border border-[#222533] hover:border-amber-500/40 transition-colors"
                          >
                            <p className="text-xs font-bold text-white truncate">{c.name}</p>
                            <p className="text-[11px] text-amber-400 tabular-nums">
                              دين متأخر ({c.overdue_days} يوم): {formatCurrency(c.balance_due, c.currency || settings.currency)}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className={`flex-1 w-full max-w-6xl mx-auto px-4 pt-4 lg:px-8 lg:pt-6 ${suppressPrintShell ? 'print:hidden' : ''}`}>
          {children}
        </main>
      </div>

      {/* Fixed Bottom Tab Bar (Mobile / Tablet) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#12141C]/95 backdrop-blur-lg border-t border-[#222533] px-2 py-1.5 no-print">
        <div className="grid grid-cols-5 items-center max-w-lg mx-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-colors min-h-[48px] ${
                  isActive ? 'text-[#A799FF]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
                <span className="text-[11px] font-bold leading-none whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
