import type { AppSettings, Invoice } from '../types';

export function formatNumber(value: number, decimals = 0): string {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(value: number, currency = 'ر.س', decimals = 0): string {
  return `${formatNumber(value, decimals)} ${currency}`;
}

export function formatDateArabic(iso: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('ar-SA-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTimeArabic(iso: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('ar-SA-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeArabic(iso: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  return formatDateArabic(iso);
}

export function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(filename, blob);
}

export function exportInvoiceCsv(invoice: Invoice, settings: AppSettings): void {
  const invCur = invoice.currency || settings.currency;
  const statusLabel =
    invoice.status === 'paid'
      ? 'مدفوعة بالكامل'
      : invoice.status === 'partial'
      ? 'مدفوعة جزئياً'
      : invoice.status === 'cancelled'
      ? 'ملغاة'
      : 'آجلة / غير مسددة';

  const rows: (string | number)[][] = [
    ['اسم المتجر', settings.store_name, '', '', ''],
    ['رقم الفاتورة', invoice.invoice_number, 'التاريخ', `${formatDateArabic(invoice.created_at)} ${formatTimeArabic(invoice.created_at)}`, ''],
    ['العميل', invoice.customer_name_snapshot, 'الهاتف', invoice.customer_phone || '-', ''],
    ['الحالة', statusLabel, 'العملة', invCur, ''],
    ['', '', '', '', ''],
    ['الصنف', 'رمز SKU', 'الكمية', `سعر الوحدة (${invCur})`, `الإجمالي (${invCur})`],
    ...(invoice.items || []).map((item) => [
      item.product_name,
      item.sku || '-',
      item.quantity,
      item.unit_price,
      item.line_total,
    ]),
    ['', '', '', '', ''],
    ['المجموع الفرعي', '', '', '', invoice.subtotal],
    [`ضريبة القيمة المضافة (${invoice.vat_rate}%)`, '', '', '', invoice.vat_amount],
    ['الخصم', '', '', '', invoice.discount_amount],
    ['الإجمالي النهائي', '', '', '', invoice.total_amount],
    ['المدفوع', '', '', '', invoice.paid_amount],
    ['المتبقي (آجل)', '', '', '', invoice.remaining_amount],
  ];

  const safeNum = (invoice.invoice_number || 'invoice').replace(/[^\w\-]+/g, '_');
  exportToCsv(`invoice-${safeNum}.csv`, ['البيان', 'التفصيل 1', 'التفصيل 2', 'التفصيل 3', 'المبلغ'], rows);
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportInvoiceHtml(invoice: Invoice, settings: AppSettings): void {
  const invCur = invoice.currency || settings.currency;
  const statusLabel =
    invoice.status === 'paid'
      ? 'مدفوعة بالكامل'
      : invoice.status === 'partial'
      ? 'مدفوعة جزئياً'
      : invoice.status === 'cancelled'
      ? 'ملغاة'
      : 'آجلة / غير مسددة';

  const itemsRows = (invoice.items || [])
    .map(
      (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(item.product_name)}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.unit_price, invCur, 2)}</td>
        <td><strong>${formatCurrency(item.line_total, invCur, 2)}</strong></td>
      </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>فاتورة #${escapeHtml(invoice.invoice_number)} - ${escapeHtml(settings.store_name)}</title>
  <style>
    body { font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif; background: #fff; color: #0f172a; margin: 24px; direction: rtl; }
    .box { max-width: 760px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; color: #312e81; }
    .meta { font-size: 13px; color: #475569; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; background: #f1f5f9; font-size: 12px; font-weight: 700; }
    .cust { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: right; }
    th { background: #f1f5f9; font-weight: 700; }
    .totals { max-width: 320px; margin-right: auto; font-size: 13px; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .grand { border-top: 2px solid #cbd5e1; margin-top: 6px; padding-top: 8px !important; font-size: 16px; font-weight: 800; }
    .footer { text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #64748b; }
    @media print { body { margin: 0; } .box { border: none; } }
  </style>
</head>
<body>
  <div class="box">
    <div class="top">
      <div>
        <h1>${escapeHtml(settings.store_name)}</h1>
        ${settings.tax_number ? `<div class="meta">الرقم الضريبي: ${escapeHtml(settings.tax_number)}</div>` : ''}
        <div class="meta">فاتورة مبيعات (${escapeHtml(invCur)})</div>
      </div>
      <div style="text-align:left">
        <span class="badge">${escapeHtml(statusLabel)}</span>
        <div style="font-weight:800; margin-top:6px;">#${escapeHtml(invoice.invoice_number)}</div>
        <div class="meta">${escapeHtml(formatDateArabic(invoice.created_at))} • ${escapeHtml(formatTimeArabic(invoice.created_at))}</div>
      </div>
    </div>
    <div class="cust">
      <div><strong>العميل:</strong> ${escapeHtml(invoice.customer_name_snapshot)}${invoice.customer_phone ? ` (${escapeHtml(invoice.customer_phone)})` : ''}</div>
      <div><strong>العملة:</strong> ${escapeHtml(invCur)}</div>
    </div>
    <table>
      <thead>
        <tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="totals">
      <div><span>المجموع الفرعي:</span><span>${formatCurrency(invoice.subtotal, invCur, 2)}</span></div>
      <div><span>الضريبة (${invoice.vat_rate}%):</span><span>${formatCurrency(invoice.vat_amount, invCur, 2)}</span></div>
      ${invoice.discount_amount > 0 ? `<div><span>الخصم:</span><span>-${formatCurrency(invoice.discount_amount, invCur, 2)}</span></div>` : ''}
      <div class="grand"><span>الإجمالي النهائي:</span><span>${formatCurrency(invoice.total_amount, invCur, 2)}</span></div>
      <div><span>المدفوع:</span><span>${formatCurrency(invoice.paid_amount, invCur, 2)}</span></div>
      ${invoice.remaining_amount > 0 ? `<div style="color:#dc2626;font-weight:700;"><span>المتبقي (آجل):</span><span>${formatCurrency(invoice.remaining_amount, invCur, 2)}</span></div>` : ''}
    </div>
    ${settings.invoice_footer ? `<div class="footer">${escapeHtml(settings.invoice_footer)}</div>` : ''}
  </div>
</body>
</html>`;

  const safeNum = (invoice.invoice_number || 'invoice').replace(/[^\w\-]+/g, '_');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerBlobDownload(`invoice-${safeNum}.html`, blob);
}

export const GENERAL_CATEGORIES = [
  'عام',
  'مواد غذائية',
  'ملابس وأحذية',
  'مستلزمات منزلية',
  'أدوات مكتبية',
  'مستحضرات وعناية',
  'قطع غيار',
  'أخرى',
];
