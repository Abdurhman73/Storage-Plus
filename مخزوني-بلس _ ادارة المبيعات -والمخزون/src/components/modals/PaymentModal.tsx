import React, { useEffect, useState } from 'react';
import { Banknote, Building2, CreditCard, Wallet, X } from 'lucide-react';
import type { CurrencyCode, Customer, Invoice, PaidChannel } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CurrencyInlineSelector } from '../CurrencyInlineSelector';

interface PaymentModalProps {
  open: boolean;
  customers: Customer[];
  initialCustomer?: Customer | null;
  initialInvoice?: Invoice | null;
  currency?: string;
  onClose: () => void;
  onConfirm: (payload: {
    customer_id: number | null;
    invoice_id?: number | null;
    currency?: string;
    amount: number;
    method: PaidChannel;
    reference_note?: string;
  }) => Promise<void>;
}

export function PaymentModal({
  open,
  customers,
  initialCustomer,
  initialInvoice,
  currency = 'ر.س',
  onClose,
  onConfirm,
}: PaymentModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>('ر.س');
  const [method, setMethod] = useState<PaidChannel>('cash');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const debtors = customers.filter((c) => c.balance_due > 0);
  const selectableCustomers = debtors.length > 0 ? debtors : customers;

  useEffect(() => {
    if (!open) return;
    if (initialInvoice) {
      setSelectedCustomerId(initialInvoice.customer_id ? String(initialInvoice.customer_id) : '');
      setAmount(String(initialInvoice.remaining_amount));
      setPayCurrency(initialInvoice.currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
      setNote(`سداد فاتورة ${initialInvoice.invoice_number}`);
    } else if (initialCustomer) {
      setSelectedCustomerId(String(initialCustomer.id));
      setAmount(initialCustomer.balance_due > 0 ? String(initialCustomer.balance_due) : '');
      setPayCurrency(initialCustomer.currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
      setNote(`دفعة تحصيل من ${initialCustomer.name}`);
    } else {
      const firstDebtor = debtors[0] || customers[0];
      setSelectedCustomerId(firstDebtor ? String(firstDebtor.id) : '');
      setAmount(firstDebtor && firstDebtor.balance_due > 0 ? String(firstDebtor.balance_due) : '');
      setPayCurrency(firstDebtor?.currency === 'ر.ي' ? 'ر.ي' : currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
      setNote('');
    }
    setMethod('cash');
    setError('');
  }, [open, initialCustomer, initialInvoice, customers, currency]);

  if (!open) return null;

  const activeCustomer = customers.find((c) => String(c.id) === selectedCustomerId) || null;
  const maxBalance = initialInvoice ? initialInvoice.remaining_amount : activeCustomer?.balance_due || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount || 0);
    if (numAmt <= 0) {
      setError('يرجى إدخال مبلغ سداد أكبر من صفر');
      return;
    }
    if (!selectedCustomerId && !initialInvoice?.customer_id) {
      setError('يرجى اختيار العميل');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onConfirm({
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : initialInvoice?.customer_id || null,
        invoice_id: initialInvoice?.id || null,
        currency: payCurrency,
        amount: numAmt,
        method,
        reference_note: note.trim() || 'تحصيل دفعة سداد',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'تعذر تسجيل الدفعة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print">
      <div className="w-full max-w-md rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2EE59D]/15 text-[#2EE59D] flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تسجيل دفعة سداد / تحصيل</h3>
              <p className="text-xs text-slate-400">يُخصم تلقائياً من رصيد مديونية العميل</p>
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">العميل</label>
            <select
              value={selectedCustomerId}
              disabled={Boolean(initialInvoice)}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                const c = customers.find((x) => String(x.id) === e.target.value);
                if (c) {
                  setPayCurrency(c.currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
                  if (c.balance_due > 0) setAmount(String(c.balance_due));
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF] disabled:opacity-70"
            >
              <option value="">اختر العميل...</option>
              {selectableCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — المتبقي: {formatCurrency(c.balance_due, c.currency || currency)}
                </option>
              ))}
            </select>
          </div>

          {activeCustomer && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]">
              <div>
                <span className="block text-[11px] text-slate-400">إجمالي الدين المستحق</span>
                <span className="text-base font-bold text-[#F87171] tabular-nums">
                  {formatCurrency(maxBalance, payCurrency, 2)}
                </span>
              </div>
              {maxBalance > 0 && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(String((maxBalance / 2).toFixed(2)))}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1E2130] text-xs font-semibold text-slate-200 hover:bg-[#2A2F42]"
                  >
                    نصف المبلغ
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(String(maxBalance))}
                    className="px-2.5 py-1.5 rounded-lg bg-[#2EE59D]/15 text-xs font-bold text-[#2EE59D] hover:bg-[#2EE59D]/25"
                  >
                    كامل الدين
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">المبلغ المحصل *</label>
              <CurrencyInlineSelector value={payCurrency} onChange={setPayCurrency} />
            </div>
            <div className="flex items-center rounded-xl bg-[#11131B] border border-[#252836] focus-within:border-[#2EE59D] px-3.5">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full py-3 bg-transparent text-lg font-bold text-[#2EE59D] tabular-nums focus:outline-none"
                required
              />
              <span className="text-xs font-bold text-[#2EE59D] shrink-0">{payCurrency}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">طريقة التحصيل</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cash' as PaidChannel, label: 'نقدي', icon: Banknote },
                { id: 'card' as PaidChannel, label: 'بطاقة / شبكة', icon: CreditCard },
                { id: 'transfer' as PaidChannel, label: 'تحويل بنكي', icon: Building2 },
              ].map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? 'bg-[#A799FF] text-[#0D0E12] border-[#A799FF]'
                        : 'bg-[#11131B] text-slate-300 border-[#252836] hover:border-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">مرجع / ملاحظة السند</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="رقم الحوالة أو ملاحظات إضافية"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-[#2EE59D] text-[#0D0E12] font-bold text-sm hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'جاري التسجيل...' : 'اعتماد سند القبض'}
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
