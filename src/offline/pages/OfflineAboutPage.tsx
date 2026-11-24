import React, { useState } from 'react';
import type { OfflineDataset, OfflinePageInstance, OfflineUserProfile } from '../offline.types';
import { OfflineRubyGem } from '../components/OfflineRubyGem';
import { OfflineToolbar } from '../components/OfflineToolbar';

const SUPPORT_WHATSAPP_NUMBER = '967771312997';
const SUPPORT_PHONE_DISPLAY = '+967771312997';

interface OfflineAboutPageProps {
  instance: OfflinePageInstance;
  userProfile: OfflineUserProfile | null;
  activeDataset: OfflineDataset;
  onRefresh: (instanceId: string) => void;
  onConfirmAction: (opts: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) => void;
  onCloseToHome: (instanceId: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OfflineAboutPage: React.FC<OfflineAboutPageProps> = ({
  instance,
  userProfile,
  activeDataset,
  onRefresh,
  onConfirmAction,
  onCloseToHome,
  onToast,
}) => {
  const [reporterName, setReporterName] = useState(userProfile?.displayName || '');
  const [reporterPhone, setReporterPhone] = useState(userProfile?.phone || '');
  const [problemDesc, setProblemDesc] = useState('');
  const [preparedMessage, setPreparedMessage] = useState('');
  const [lastWaUrl, setLastWaUrl] = useState('');

  const handlePrepareProblemReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterName.trim()) {
      onToast('يرجى إدخال اسم المستخدم.', 'error');
      return;
    }
    if (!problemDesc.trim()) {
      onToast('يرجى كتابة وصف المشكلة قبل الإرسال.', 'error');
      return;
    }

    onConfirmAction({
      title: 'تأكيد تجهيز البلاغ الفني',
      message: 'هل أنت متأكد من تجهيز تفاصيل البلاغ؟ يمكنك نسخه محلياً أو إرساله عبر WhatsApp عند توفر الإنترنت.',
      confirmLabel: '✓ نعم، تجهيز البلاغ',
      onConfirm: () => {
        const lines = [
          '🛠️ بلاغ مشكلة فنية - تطبيق بن فيصل لتحليل البيانات الذكي (النسخة المحلية)',
          `👤 اسم المستخدم: ${reporterName.trim()}`,
          `📱 رقم الهاتف: ${reporterPhone.trim() || 'غير محدد'}`,
          `📧 البريد: ${userProfile?.email || 'حساب محلي'}`,
          `📂 الملف النشط: ${activeDataset.name} (${activeDataset.rowsCount} صف × ${activeDataset.colsCount} عمود)`,
          '📝 وصف المشكلة:',
          problemDesc.trim(),
        ];
        const reportText = lines.join('\n');
        setPreparedMessage(reportText);
        setLastWaUrl(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(reportText)}`);
        onToast('تم تجهيز نص البلاغ الفني محلياً بنجاح!');
      },
    });
  };

  const handleCopyReport = async () => {
    if (!preparedMessage) return;
    try {
      await navigator.clipboard.writeText(preparedMessage);
      onToast('تم نسخ نص البلاغ إلى الحافظة!');
    } catch {
      onToast('تعذر النسخ التلقائي — يمكنك التحديد والنسخ يدوياً', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-5 min-h-full">
      <OfflineToolbar instance={instance} onRefresh={onRefresh} onCloseToHome={onCloseToHome} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 space-y-5">
          <div className="bg-emeraldos-900/90 rounded-2xl p-6 border border-platgold-500/30 space-y-3">
            <div className="flex items-center gap-3 border-b border-white/15 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-950/90 to-emeraldos-950 border border-rose-400/45 flex items-center justify-center shadow-[0_0_18px_rgba(244,63,94,0.35)]">
                <OfflineRubyGem size="sm" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">ℹ️ من نحن (النسخة المحلية بدون إنترنت)</h3>
                <p className="text-xs text-platgold-300 font-bold">تطبيق بن فيصل لتحليل البيانات الذكي</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              هذه هي <strong className="text-platgold-300">النسخة المستقلة العاملة بدون إنترنت (Offline Edition)</strong> من تطبيق بن فيصل لتحليل البيانات الذكي؛ تعمل بالكامل على قاعدة بيانات جهازك المحلية (IndexedDB) وخطوط مدمجة ومخططات بيانية فورية دون الحاجة لأي اتصال بالشبكة.
            </p>
          </div>

          <div className="bg-emeraldos-900/90 rounded-2xl p-6 border border-platgold-500/35 space-y-4">
            <div className="flex items-center gap-3 border-b border-white/15 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-emeraldos-950 border border-platgold-400/40 flex items-center justify-center text-xl">
                👨‍💻
              </div>
              <div>
                <h3 className="text-sm font-black text-platgold-300">برمجة وتطوير</h3>
                <p className="text-base font-black text-white">المهندس زكريا فيصل علي قايد العزعزي</p>
                <p className="text-xs font-bold text-emerald-300 mt-0.5">
                  مبرمج ومطور تطبيقات وأنظمة وتقنية معلومات
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black text-platgold-200">📞 للتواصل والاستفسار</h4>
              <div className="bg-emeraldos-950/90 border border-white/10 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-black text-white font-mono" dir="ltr">
                  {SUPPORT_PHONE_DISPLAY}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${SUPPORT_PHONE_DISPLAY}`}
                    className="bg-sky-700 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition"
                  >
                    <span>📞 اتصال</span>
                  </a>
                  <a
                    href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition"
                  >
                    <span>💬 WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handlePrepareProblemReport}
          className="xl:col-span-6 bg-emeraldos-900/90 rounded-2xl p-6 border border-platgold-500/30 space-y-4 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="border-b border-white/15 pb-3">
              <h3 className="text-base font-black text-white">🛠️ الإبلاغ عن مشكلة</h3>
              <p className="text-xs text-platgold-300 font-bold mt-0.5">واجهت مشكلة؟ جهّز التقرير محلياً أو أرسله عبر WhatsApp</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="offRepName" className="block text-xs font-bold text-platgold-300 mb-1">
                  اسم المستخدم
                </label>
                <input
                  id="offRepName"
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="أدخل اسمك"
                  className="w-full bg-emeraldos-950 text-white text-xs sm:text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>

              <div>
                <label htmlFor="offRepPhone" className="block text-xs font-bold text-platgold-300 mb-1">
                  رقم الهاتف
                </label>
                <input
                  id="offRepPhone"
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  placeholder="+967..."
                  dir="ltr"
                  className="w-full bg-emeraldos-950 text-white text-xs sm:text-sm font-bold rounded-xl px-3.5 py-2.5 border border-platgold-500/30 outline-none focus:border-platgold-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="offRepProblem" className="block text-xs font-bold text-platgold-300 mb-1">
                وصف المشكلة
              </label>
              <textarea
                id="offRepProblem"
                rows={5}
                value={problemDesc}
                onChange={(e) => setProblemDesc(e.target.value)}
                placeholder="اشرح تفاصيل المشكلة التي واجهتك..."
                className="w-full bg-emeraldos-950 text-white text-xs sm:text-sm font-medium rounded-xl p-3.5 border border-platgold-500/30 outline-none focus:border-platgold-400 resize-y"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="submit"
              className="w-full platgold-gradient text-emeraldos-950 font-black text-xs sm:text-sm py-3 px-4 rounded-xl cursor-pointer transition"
            >
              📝 تجهيز البلاغ الفني
            </button>

            {preparedMessage && (
              <div className="bg-emeraldos-950/95 border border-emerald-400/40 rounded-xl p-3 space-y-2 text-xs">
                <pre className="text-[11px] text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {preparedMessage}
                </pre>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="bg-sky-700 hover:bg-sky-600 text-white px-3 py-1.5 rounded-lg font-black cursor-pointer"
                  >
                    📋 نسخ نص البلاغ
                  </button>
                  {lastWaUrl && (
                    <a
                      href={lastWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-black"
                    >
                      💬 إرسال عبر WhatsApp (عند توفر نت)
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
