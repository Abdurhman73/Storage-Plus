import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, FileSpreadsheet, FileText, MessageCircle, MessageSquare, Phone, Printer, QrCode, Receipt, X } from 'lucide-react';
import type { AppSettings, Customer, Invoice } from '../../types';
import { exportInvoiceCsv, exportInvoiceHtml, formatCurrency, formatDateArabic, formatTimeArabic } from '../../utils/format';

interface InvoicePreviewModalProps {
  open: boolean;
  invoice: Invoice | null;
  settings: AppSettings;
  customers?: Customer[];
  onClose: () => void;
}

function toAsciiDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function normalizePhoneForWhatsApp(rawPhone: string): string {
  const ascii = toAsciiDigits(rawPhone).trim();
  const hasPlus = ascii.startsWith('+');
  let digits = ascii.replace(/\D/g, '');
  if (!digits) return '';
  if (!hasPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('05') && digits.length === 10) {
    return `966${digits.slice(1)}`;
  }
  if (digits.startsWith('7') && digits.length === 9) {
    return `967${digits}`;
  }
  if (digits.startsWith('07') && digits.length === 10) {
    return `967${digits.slice(1)}`;
  }
  return digits;
}

function normalizePhoneForSms(rawPhone: string): string {
  const ascii = toAsciiDigits(rawPhone).trim();
  const cleaned = ascii.replace(/[^\d+]/g, '');
  return cleaned;
}

export function InvoicePreviewModal({
  open,
  invoice,
  settings,
  customers = [],
  onClose,
}: InvoicePreviewModalProps) {
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportedType, setExportedType] = useState<'csv' | 'html' | null>(null);

  const resolvedCustomerPhone = useMemo(() => {
    if (!invoice) return '';
    if (invoice.customer_phone) return invoice.customer_phone;
    if (invoice.customer_id) {
      const found = customers.find((c) => c.id === invoice.customer_id);
      if (found?.phone) return found.phone;
    }
    return '';
  }, [invoice, customers]);

  useEffect(() => {
    if (open && invoice) {
      setRecipientPhone(resolvedCustomerPhone);
      setCopied(false);
    }
  }, [open, invoice?.id, resolvedCustomerPhone]);

  if (!open || !invoice) return null;

  const invCur = invoice.currency || settings.currency;

  const statusText =
    invoice.status === 'paid'
      ? 'مدفوعة بالكامل'
      : invoice.status === 'partial'
      ? 'مدفوعة جزئياً'
      : invoice.status === 'cancelled'
      ? 'ملغاة'
      : 'آجلة / غير مسددة';

  const paymentMethodLabel =
    invoice.payment_method === 'cash'
      ? 'نقدي (كاش)'
      : invoice.payment_method === 'card'
      ? 'بطاقة / شبكة'
      : invoice.payment_method === 'transfer'
      ? 'تحويل بنكي'
      : invoice.payment_method === 'credit'
      ? 'آجل (ذمم)'
      : 'دفع مقسم (جزئي + آجل)';

  const shareLines: string[] = [
    `*${settings.store_name}*`,
    `فاتورة مبيعات #${invoice.invoice_number}`,
    `التاريخ: ${formatDateArabic(invoice.created_at)} - ${formatTimeArabic(invoice.created_at)}`,
    `العميل: ${invoice.customer_name_snapshot}`,
    `الحالة: ${statusText} (${paymentMethodLabel})`,
    '------------------',
    ...(invoice.items || []).map(
      (item, idx) =>
        `${idx + 1}. ${item.product_name} × ${item.quantity} = ${formatCurrency(item.line_total, invCur, 2)}`
    ),
    '------------------',
    `المجموع الفرعي: ${formatCurrency(invoice.subtotal, invCur, 2)}`,
    `الضريبة (${invoice.vat_rate}%): ${formatCurrency(invoice.vat_amount, invCur, 2)}`,
  ];
  if (invoice.discount_amount > 0) {
    shareLines.push(`الخصم: -${formatCurrency(invoice.discount_amount, invCur, 2)}`);
  }
  shareLines.push(`الإجمالي النهائي: ${formatCurrency(invoice.total_amount, invCur, 2)}`);
  shareLines.push(`المدفوع: ${formatCurrency(invoice.paid_amount, invCur, 2)}`);
  if (invoice.remaining_amount > 0) {
    shareLines.push(`المتبقي (آجل): ${formatCurrency(invoice.remaining_amount, invCur, 2)}`);
  }
  if (settings.invoice_footer) {
    shareLines.push('------------------', settings.invoice_footer);
  }

  const shareMessage = shareLines.join('\n');
  const encodedMessage = encodeURIComponent(shareMessage);
  const waPhone = normalizePhoneForWhatsApp(recipientPhone);
  const smsPhone = normalizePhoneForSms(recipientPhone);
  const whatsappHref = waPhone
    ? `https://wa.me/${waPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;
  const smsHref = smsPhone
    ? `sms:${smsPhone}?body=${encodedMessage}`
    : `sms:?body=${encodedMessage}`;

  const handleCopyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore clipboard errors if blocked
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-white print:block">
      <div
        className={`w-full rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden my-auto print:bg-white print:text-black print:border-none print:shadow-none print:rounded-none ${
          printFormat === 'thermal' ? 'max-w-sm print-thermal' : 'max-w-2xl print:max-w-none'
        }`}
      >
        {/* Top Modal Controls (hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-[#252836] no-print">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#11131B] border border-[#252836]">
            <button
              type="button"
              onClick={() => setPrintFormat('a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                printFormat === 'a4' ? 'bg-[#A799FF] text-[#0D0E12]' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>فاتورة A4</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('thermal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                printFormat === 'thermal' ? 'bg-[#A799FF] text-[#0D0E12]' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>حراري 80mm</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                exportInvoiceCsv(invoice, settings);
                setExportedType('csv');
                setTimeout(() => setExportedType(null), 2200);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#11131B] border border-[#252836] text-slate-200 hover:border-[#A799FF]/50 text-xs font-bold"
              title="تصدير تفاصيل الفاتورة بصيغة CSV / Excel"
            >
              {exportedType === 'csv' ? (
                <Check className="w-4 h-4 text-[#2EE59D]" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-[#A799FF]" />
              )}
              <span>{exportedType === 'csv' ? 'تم التصدير' : 'تصدير CSV'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                exportInvoiceHtml(invoice, settings);
                setExportedType('html');
                setTimeout(() => setExportedType(null), 2200);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#11131B] border border-[#252836] text-slate-200 hover:border-[#2EE59D]/50 text-xs font-bold"
              title="تنزيل نسخة فاتورة للطباعة والحفظ"
            >
              {exportedType === 'html' ? (
                <Check className="w-4 h-4 text-[#2EE59D]" />
              ) : (
                <Download className="w-4 h-4 text-[#2EE59D]" />
              )}
              <span>{exportedType === 'html' ? 'تم التنزيل' : 'تنزيل فاتورة'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2EE59D] text-[#0D0E12] text-xs font-extrabold hover:opacity-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الآن</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Share via WhatsApp / SMS Bar (hidden when printing) */}
        <div className="px-5 py-3 bg-[#11131B] border-b border-[#252836] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-1 rounded-xl bg-[#171923] border border-[#252836] focus-within:border-[#A799FF] px-3 py-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="tel"
                dir="ltr"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="رقم جوال العميل للإرسال..."
                className="w-full bg-transparent text-xs text-white font-mono text-right placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#132A22] border border-[#2EE59D]/30 text-[#2EE59D] hover:bg-[#19382D] text-xs font-bold transition-colors"
              title={waPhone ? `إرسال الفاتورة عبر واتساب إلى ${recipientPhone}` : 'مشاركة الفاتورة عبر واتساب'}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>واتساب</span>
            </a>

            <a
              href={smsHref}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#13292D] border border-[#38BDF8]/30 text-[#38BDF8] hover:bg-[#19353B] text-xs font-bold transition-colors"
              title={smsPhone ? `إرسال رسالة نصية إلى ${recipientPhone}` : 'إرسال الفاتورة برسالة نصية'}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>رسالة نصية</span>
            </a>

            <button
              type="button"
              onClick={handleCopyInvoice}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#171923] border border-[#252836] text-slate-200 hover:border-[#A799FF]/40 text-xs font-bold transition-colors"
              title="نسخ تفاصيل الفاتورة"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#2EE59D]" /> : <Copy className="w-3.5 h-3.5 text-[#A799FF]" />}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>
        </div>

        {/* Printable Invoice Content */}
        {printFormat === 'a4' ? (
          <div className="p-6 space-y-5 bg-[#12141C] print:bg-white print:text-slate-900 print:p-2">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#252836] print:border-slate-300 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-[#A799FF] print:text-slate-900">{settings.store_name}</h2>
                {settings.tax_number && (
                  <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                    الرقم الضريبي: <span className="font-mono">{settings.tax_number}</span>
                  </p>
                )}
                <p className="text-xs text-slate-400 print:text-slate-600">فاتورة مبيعات ({invCur})</p>
              </div>
              <div className="text-left">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#A799FF]/15 text-[#A799FF] print:bg-slate-100 print:text-slate-900 mb-1.5">
                  {statusText}
                </span>
                <p className="text-sm font-bold text-white print:text-slate-900 font-mono">#{invoice.invoice_number}</p>
                <p className="text-xs text-slate-400 print:text-slate-600">
                  {formatDateArabic(invoice.created_at)} • {formatTimeArabic(invoice.created_at)}
                </p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-[#171923] border border-[#252836] print:bg-slate-50 print:border-slate-200">
              <div>
                <span className="block text-[11px] text-slate-400 print:text-slate-500">العميل المستفيد</span>
                <span className="text-sm font-bold text-white print:text-slate-900">{invoice.customer_name_snapshot}</span>
                {invoice.customer_phone && (
                  <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5 tabular-nums">{invoice.customer_phone}</p>
                )}
              </div>
              <div className="text-left">
                <span className="block text-[11px] text-slate-400 print:text-slate-500">طريقة السداد / الرقم الضريبي</span>
                <span className="text-xs font-bold text-slate-200 print:text-slate-800 block">{paymentMethodLabel}</span>
                <span className="text-[11px] font-mono text-slate-400 print:text-slate-600">
                  {invoice.customer_tax_id || 'عميل أفراد / غير مسجل ضريبياً'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#252836] print:border-slate-300">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#171923] text-slate-400 print:bg-slate-100 print:text-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold">الصنف</th>
                    <th className="py-3 px-3 font-semibold text-center">الكمية</th>
                    <th className="py-3 px-3 font-semibold text-center">سعر الوحدة</th>
                    <th className="py-3 px-4 font-semibold text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252836] print:divide-slate-200">
                  {(invoice.items || []).map((item, idx) => (
                    <tr key={idx} className="text-slate-200 print:text-slate-800">
                      <td className="py-3 px-4 font-semibold">{item.product_name}</td>
                      <td className="py-3 px-3 text-center tabular-nums">{item.quantity}</td>
                      <td className="py-3 px-3 text-center tabular-nums">
                        {formatCurrency(item.unit_price, invCur, 2)}
                      </td>
                      <td className="py-3 px-4 text-left font-bold tabular-nums">
                        {formatCurrency(item.line_total, invCur, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & QR */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#171923] border border-[#252836] print:bg-slate-50 print:border-slate-200">
                <div className="w-16 h-16 rounded-xl bg-white text-[#0D0E12] flex items-center justify-center shrink-0 print:border print:border-slate-300">
                  <QrCode className="w-12 h-12" />
                </div>
                <div className="text-xs text-slate-400 print:text-slate-600 leading-relaxed">
                  <p className="font-bold text-white print:text-slate-900">رمز التحقق الإلكتروني</p>
                  <p>فاتورة صادرة عبر نظام {settings.store_name}</p>
                </div>
              </div>

              <div className="flex-1 max-w-xs space-y-2 text-xs">
                <div className="flex justify-between text-slate-400 print:text-slate-600">
                  <span>المجموع الفرعي:</span>
                  <span className="tabular-nums font-semibold text-white print:text-slate-900">
                    {formatCurrency(invoice.subtotal, invCur, 2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 print:text-slate-600">
                  <span>ضريبة القيمة المضافة ({invoice.vat_rate}%):</span>
                  <span className="tabular-nums font-semibold text-white print:text-slate-900">
                    {formatCurrency(invoice.vat_amount, invCur, 2)}
                  </span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-[#2EE59D] print:text-emerald-700">
                    <span>خصم ترويجي:</span>
                    <span className="tabular-nums font-semibold">
                      -{formatCurrency(invoice.discount_amount, invCur, 2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-[#252836] print:border-slate-300 text-sm font-extrabold text-white print:text-slate-900">
                  <span>الإجمالي المستحق:</span>
                  <span className="tabular-nums">{formatCurrency(invoice.total_amount, invCur, 2)}</span>
                </div>
                <div className="flex justify-between text-[#2EE59D] print:text-emerald-700">
                  <span>المدفوع:</span>
                  <span className="tabular-nums font-bold">{formatCurrency(invoice.paid_amount, invCur, 2)}</span>
                </div>
                {invoice.remaining_amount > 0 && (
                  <div className="flex justify-between text-[#F87171] print:text-red-600">
                    <span>المتبقي (ذمم آجلة):</span>
                    <span className="tabular-nums font-bold">
                      {formatCurrency(invoice.remaining_amount, invCur, 2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {settings.invoice_footer && (
              <p className="text-center text-[11px] text-slate-500 pt-3 border-t border-[#252836] print:border-slate-200">
                {settings.invoice_footer}
              </p>
            )}
          </div>
        ) : (
          /* 80mm Thermal Receipt Layout */
          <div className="p-5 bg-white text-slate-900 space-y-3 text-xs">
            <div className="text-center border-b border-dashed border-slate-400 pb-3 space-y-1">
              <h2 className="text-base font-extrabold">{settings.store_name}</h2>
              {settings.tax_number && (
                <p className="text-[11px] text-slate-600">الرقم الضريبي: {settings.tax_number}</p>
              )}
              <p className="text-[11px] font-bold">فاتورة مبيعات ({invCur})</p>
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
              <div className="flex justify-between">
                <span>رقم الفاتورة:</span>
                <span className="font-mono font-bold">#{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ:</span>
                <span>{formatDateArabic(invoice.created_at)} {formatTimeArabic(invoice.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>العميل:</span>
                <span className="font-bold">{invoice.customer_name_snapshot}</span>
              </div>
              <div className="flex justify-between">
                <span>السداد:</span>
                <span>{paymentMethodLabel}</span>
              </div>
            </div>

            <table className="w-full text-right text-[11px]">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600">
                  <th className="py-1.5">الصنف</th>
                  <th className="py-1.5 text-center">ك</th>
                  <th className="py-1.5 text-left">المجموع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 font-semibold">{item.product_name}</td>
                    <td className="py-1.5 text-center tabular-nums">{item.quantity}</td>
                    <td className="py-1.5 text-left font-bold tabular-nums">
                      {formatCurrency(item.line_total, invCur, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-slate-400 pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span className="tabular-nums">{formatCurrency(invoice.subtotal, invCur, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>الضريبة ({invoice.vat_rate}%):</span>
                <span className="tabular-nums">{formatCurrency(invoice.vat_amount, invCur, 2)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span>الخصم:</span>
                  <span className="tabular-nums">-{formatCurrency(invoice.discount_amount, invCur, 2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold border-t border-slate-300 pt-1.5">
                <span>الإجمالي النهائي:</span>
                <span className="tabular-nums">{formatCurrency(invoice.total_amount, invCur, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>المدفوع:</span>
                <span className="tabular-nums font-bold">{formatCurrency(invoice.paid_amount, invCur, 2)}</span>
              </div>
              {invoice.remaining_amount > 0 && (
                <div className="flex justify-between font-bold text-red-700">
                  <span>المتبقي آجل:</span>
                  <span className="tabular-nums">{formatCurrency(invoice.remaining_amount, invCur, 2)}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center pt-2 border-t border-dashed border-slate-400 gap-1.5">
              <QrCode className="w-16 h-16 text-slate-900" />
              {settings.invoice_footer && (
                <p className="text-center text-[10px] text-slate-600">{settings.invoice_footer}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
