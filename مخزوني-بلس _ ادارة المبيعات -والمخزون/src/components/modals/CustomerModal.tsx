import React, { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { CurrencyCode, Customer } from '../../types';
import { CurrencyInlineSelector } from '../CurrencyInlineSelector';

interface CustomerModalProps {
  open: boolean;
  customer?: Customer | null;
  currency?: string;
  onClose: () => void;
  onSave: (payload: Partial<Customer>, id?: number) => Promise<void>;
}

export function CustomerModal({
  open,
  customer,
  currency = 'ر.س',
  onClose,
  onSave,
}: CustomerModalProps) {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [customerType, setCustomerType] = useState<'business' | 'individual'>('business');
  const [isVip, setIsVip] = useState(false);
  const [custCurrency, setCustCurrency] = useState<CurrencyCode>('ر.س');
  const [creditLimit, setCreditLimit] = useState('50000');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setName(customer.name);
      setCompanyName(customer.company_name || '');
      setPhone(customer.phone || '');
      setTaxId(customer.tax_id || '');
      setCustomerType(customer.customer_type || 'business');
      setIsVip(Boolean(customer.is_vip));
      setCustCurrency(customer.currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
      setCreditLimit(String(customer.credit_limit ?? 50000));
      setNotes(customer.notes || '');
    } else {
      setName('');
      setCompanyName('');
      setPhone('');
      setTaxId('');
      setCustomerType('business');
      setIsVip(false);
      setCustCurrency(currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
      setCreditLimit('50000');
      setNotes('');
    }
    setError('');
  }, [open, customer, currency]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم العميل');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(
        {
          name: name.trim(),
          company_name: companyName.trim(),
          phone: phone.trim(),
          tax_id: taxId.trim(),
          customer_type: customerType,
          is_vip: isVip ? 1 : 0,
          currency: custCurrency,
          credit_limit: Math.max(0, Number(creditLimit || 0)),
          notes: notes.trim(),
        },
        customer?.id
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'تعذر حفظ بيانات العميل');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto no-print">
      <div className="w-full max-w-lg rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2EE59D]/15 text-[#2EE59D] flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {customer ? 'تعديل بيانات العميل' : 'فتح حساب عميل جديد'}
              </h3>
              <p className="text-xs text-slate-400">ربط المشتريات والذمم الآجلة وسجل السداد</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-xs text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">الاسم الكامل / الجهة *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم العميل أو المؤسسة"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">اسم النشاط / الوصف</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="تجارة عامة / فردي"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">رقم الجوال</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم الهاتف"
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white text-right tabular-nums focus:outline-none focus:border-[#A799FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">الرقم الضريبي (اختياري)</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="إن وجد"
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white text-right font-mono focus:outline-none focus:border-[#A799FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">تصنيف الحساب</label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value as 'business' | 'individual')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
              >
                <option value="business">شركة / مؤسسة</option>
                <option value="individual">عميل فردي</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">الحد الائتماني</label>
                <CurrencyInlineSelector value={custCurrency} onChange={setCustCurrency} />
              </div>
              <div className="flex items-center rounded-xl bg-[#11131B] border border-[#252836] focus-within:border-[#A799FF] px-3">
                <input
                  type="number"
                  min="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full py-2.5 bg-transparent text-sm text-white tabular-nums focus:outline-none"
                />
                <span className="text-[11px] font-bold text-slate-400 shrink-0">{custCurrency}</span>
              </div>
            </div>
          </div>

          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#11131B] border border-[#222533] cursor-pointer">
            <div>
              <span className="block text-sm font-semibold text-white">تصنيف عميل مميز (VIP)</span>
              <span className="text-xs text-slate-400">إبراز العميل في قوائم الفواتير والذمم</span>
            </div>
            <input
              type="checkbox"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="w-5 h-5 accent-[#A799FF] rounded"
            />
          </label>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">ملاحظات</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات شروط الدفع أو التوصيل"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-l from-[#5EEAD4] to-[#A799FF] text-[#0D0E12] font-bold text-sm hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : customer ? 'حفظ التعديلات' : 'إضافة العميل'}
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
