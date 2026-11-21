import React, { useEffect, useState } from 'react';
import { Settings, Trash2, X } from 'lucide-react';
import type { AppSettings } from '../../types';
import { CurrencyInlineSelector } from '../CurrencyInlineSelector';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (updated: Partial<AppSettings>) => Promise<void>;
  onResetAllData: () => void;
}

export function SettingsModal({ open, settings, onClose, onSave, onResetAllData }: SettingsModalProps) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto no-print">
      <div className="w-full max-w-lg rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#A799FF]/15 text-[#A799FF] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">إعدادات النظام والمتجر</h3>
              <p className="text-xs text-slate-400">بيانات المنشأة، الضرائب، والمستهدفات المالية</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">اسم المتجر / المنشأة</label>
              <input
                type="text"
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">اسم المدير / المسؤول</label>
              <input
                type="text"
                value={form.manager_name}
                onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">الرقم الضريبي (اختياري)</label>
              <input
                type="text"
                value={form.tax_number}
                onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
                placeholder="إن وجد"
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white font-mono text-right focus:outline-none focus:border-[#A799FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">الضريبة (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.vat_rate}
                onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white tabular-nums focus:outline-none focus:border-[#A799FF]"
              />
            </div>
          </div>

          {/* Targets with inline currency selector next to the amounts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">المستهدفات المالية والعملة الافتراضية</span>
              <CurrencyInlineSelector
                value={form.currency}
                onChange={(currency) => setForm({ ...form, currency })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  مستهدف المبيعات ({form.currency})
                </label>
                <div className="flex items-center rounded-xl bg-[#11131B] border border-[#252836] focus-within:border-[#A799FF] px-3">
                  <input
                    type="number"
                    min="0"
                    value={form.monthly_sales_target}
                    onChange={(e) => setForm({ ...form, monthly_sales_target: Number(e.target.value) })}
                    className="w-full py-2.5 bg-transparent text-sm text-white tabular-nums focus:outline-none"
                  />
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">{form.currency}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  مستهدف الأرباح ({form.currency})
                </label>
                <div className="flex items-center rounded-xl bg-[#11131B] border border-[#252836] focus-within:border-[#A799FF] px-3">
                  <input
                    type="number"
                    min="0"
                    value={form.quarterly_profit_target}
                    onChange={(e) => setForm({ ...form, quarterly_profit_target: Number(e.target.value) })}
                    className="w-full py-2.5 bg-transparent text-sm text-white tabular-nums focus:outline-none"
                  />
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">{form.currency}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">حد التنبيه الافتراضي للمخزون</label>
            <input
              type="number"
              min="1"
              value={form.low_stock_default_threshold}
              onChange={(e) => setForm({ ...form, low_stock_default_threshold: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white tabular-nums focus:outline-none focus:border-[#A799FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">تذييل الفاتورة المطبوعة</label>
            <textarea
              rows={2}
              value={form.invoice_footer}
              onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
            />
          </div>

          {/* Data Reset Section */}
          <div className="p-3.5 rounded-2xl bg-[#29171B]/50 border border-[#F87171]/25 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#FCA5A5]">حذف كافة البيانات والبدء من الصفر</p>
              <p className="text-[11px] text-slate-400">يمسح جميع المنتجات والعملاء والفواتير والمدفوعات</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onResetAllData();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F87171]/15 border border-[#F87171]/35 text-[#F87171] hover:bg-[#F87171]/25 text-xs font-bold shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح الكل</span>
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-[#A799FF] text-[#0D0E12] font-bold text-sm hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-xl bg-[#1E2130] text-slate-200 font-semibold text-sm"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
