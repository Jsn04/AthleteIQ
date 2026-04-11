import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const TAG_STYLES = {
  coach: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', label: 'Coach to action' },
  home: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', label: 'Parent to do at home' },
  both: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', label: 'Coach + Parent' },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function WeeklyReport({ athleteName, academyId, onClose, isParentView = false }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [coachNote, setCoachNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [parentPhone, setParentPhone] = useState(null);
  const reportRef = useRef(null);

  useEffect(() => {
    fetchReport();
    if (!isParentView) fetchParentPhone();
  }, []);

  const fetchParentPhone = async () => {
    try {
      const res = await api.get('/athletes', { params: { academy_id: academyId } });
      const athlete = (res.data || []).find(a => a.name === athleteName);
      if (athlete?.parent_phone) setParentPhone(athlete.parent_phone);
    } catch { }
  };

  const fetchReport = async () => {
    setLoading(true);
    setGenerating(false);
    try {
      const res = await api.get(
        `/reports/weekly/${encodeURIComponent(athleteName)}`,
        { params: { academy_id: academyId } }
      );
      setReport(res.data);
      setCoachNote(res.data.coach_note || '');
      if (!res.data.already_existed) setGenerating(false);
    } catch (err) {
      console.error('Report fetch failed:', err);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleSaveNote = async () => {
    if (!report?.report_id) return;
    setSavingNote(true);
    try {
      await api.patch(
        `/reports/weekly/${report.report_id}/note`,
        { coach_note: coachNote }
      );
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (err) {
      console.error('Note save failed:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const buildWhatsAppMessage = () => {
    if (!report) return '';
    const firstName = athleteName.split(' ')[0];
    const academyName = localStorage.getItem('academyName') || 'Academy';
    const weekStart = new Date(report.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const weekEnd = new Date(report.week_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    let msg = `📊 *${athleteName} — Weekly Report*\n`;
    msg += `${academyName} · Week of ${weekStart} – ${weekEnd}\n\n`;

    msg += `*${report.verdict}*\n\n`;

    msg += `⚡ *Energy:* ${Math.round(report.avg_readiness * 10)}/100`;
    const delta = Math.round((report.delta || 0) * 10);
    if (delta !== 0) msg += ` (${delta >= 0 ? '+' : ''}${delta} vs last week)`;
    msg += `\n`;

    msg += `📅 *Attendance:* ${report.sessions_present}/${report.sessions_total} sessions (${report.attendance_pct}%)\n`;

    if (report.acwr > 0) {
      const acwrLabel = report.acwr > 1.5 ? 'Too much — rest needed'
        : report.acwr > 1.3 ? 'Getting high — ease off'
        : report.acwr < 0.8 ? 'Too little — increase load'
        : 'Good balance';
      msg += `🏋️ *Training Load:* ${acwrLabel}\n`;
    }

    const alertCount = (report.flags?.length || 0) + (report.injuries?.length || 0);
    if (alertCount > 0) {
      msg += `\n⚠️ *${alertCount} Alert${alertCount > 1 ? 's' : ''} This Week*\n`;
      report.flags?.forEach(f => {
        msg += `  • Energy drop on ${new Date(f.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}\n`;
      });
      report.injuries?.forEach(inj => {
        msg += `  • ${inj.body_part} ${inj.injury_type} — ${inj.status}\n`;
      });
    }

    if (report.next_steps?.length > 0) {
      msg += `\n📋 *Focus Areas for Next Week:*\n`;
      report.next_steps.forEach((step, i) => {
        msg += `${i + 1}. ${step.title}\n`;
      });
    }

    if (coachNote) {
      msg += `\n✍️ *Coach's Note:*\n${coachNote}\n`;
    }

    msg += `\n🔗 View full report: ${window.location.origin}/login\n`;
    msg += `— ${academyName} via AthleteIQ`;

    return msg;
  };

  const handleSendWhatsApp = () => {
    if (!parentPhone) return;
    const msg = buildWhatsAppMessage();
    const url = `https://wa.me/91${parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const weekLabel = report?.week_start
        ? new Date(report.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Week';
      const filename = `${athleteName.replace(/\s+/g, '_')}_Report_${weekLabel}.pdf`;
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#111827' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(reportRef.current)
        .save();
    } catch (err) {
      console.error('PDF failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  // chart data — map readiness scores to 0-100 scale
  const chartData = (report?.readiness_scores || []).map((r, i) => ({
    day: DAYS[i] || r.date,
    score: Math.round(r.score * 10),
  }));

  // attendance dots — build from week days
  const attendanceByDay = report?.attendance_by_day || {};
  const weekDays = report?.week_start
    ? Array.from({ length: 6 }, (_, i) => {
      const d = new Date(report.week_start);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    })
    : [];

  const acwrColor =
    report?.acwr > 1.5 ? 'text-rose-400' :
      report?.acwr > 1.3 ? 'text-amber-400' :
        report?.acwr < 0.8 ? 'text-amber-400' : 'text-emerald-400';

  const acwrLabel =
    report?.acwr > 1.5 ? 'Too much — rest needed' :
      report?.acwr > 1.3 ? 'Getting high — ease off' :
        report?.acwr < 0.8 ? 'Too little — increase load' :
          report?.acwr === 0 ? 'Not enough data yet' : 'Just right';

  const acwrBarWidth = report?.acwr
    ? Math.min(Math.round((report.acwr / 2) * 100), 100)
    : 0;

  const acwrBarColor =
    report?.acwr > 1.5 ? '#E24B4A' :
      report?.acwr > 1.3 ? '#EF9F27' :
        report?.acwr < 0.8 ? '#EF9F27' : '#1D9E75';

  const deltaColor = (report?.delta || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400';
  const deltaSign = (report?.delta || 0) >= 0 ? '+' : '';

  if (loading || generating) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white font-black text-lg">
            {generating ? `Building ${athleteName}'s report...` : 'Loading report...'}
          </p>
          <p className="text-gray-500 text-xs">
            {generating ? 'Analysing 7 days of data — this takes about 10 seconds' : ''}
          </p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-rose-400 font-black">Could not load report. Please try again.</p>
          <button onClick={onClose} className="text-gray-400 text-sm hover:text-white transition">Close</button>
        </div>
      </div>
    );
  }

  // Mid-week: week not yet complete — show waiting screen
  if (report.week_in_progress) {
    const weekEndDate = new Date(report.week_end);
    // Adjust for timezone offset so date displays correctly
    weekEndDate.setMinutes(weekEndDate.getMinutes() + weekEndDate.getTimezoneOffset());
    const readableDate = weekEndDate.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const weekStartDate = new Date(report.week_start);
    weekStartDate.setMinutes(weekStartDate.getMinutes() + weekStartDate.getTimezoneOffset());
    const weekStartReadable = weekStartDate.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short',
    });
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-sm w-full p-8 text-center space-y-6">
          {/* progress ring */}
          <div className="relative w-20 h-20 mx-auto">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#1f2937" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#4f46e5" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - (7 - report.days_remaining) / 7)}`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">
              {7 - report.days_remaining}/7
            </span>
          </div>

          <div>
            <p className="text-gray-500 text-[11px] uppercase tracking-widest font-bold mb-2">
              Week of {weekStartReadable}
            </p>
            <h3 className="text-white font-black text-xl mb-1">Week in Progress</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              The full report for <span className="text-white font-bold">{athleteName}</span> will
              be generated once the week is complete.
            </p>
          </div>

          <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Check-ins logged</span>
              <span className="text-white font-black text-sm">{report.checkins_so_far}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Sessions logged</span>
              <span className="text-white font-black text-sm">{report.sessions_so_far}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Days remaining</span>
              <span className="text-indigo-400 font-black text-sm">{report.days_remaining}</span>
            </div>
          </div>

          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-3">
            <p className="text-indigo-300 text-xs font-semibold leading-relaxed">
              Come back on <span className="text-indigo-200 font-black">{readableDate}</span> for
              the full report — attendance, training load, injury signals, and next-week plan.
            </p>
          </div>

          <button onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-black transition">
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 overflow-y-auto">
      {/* top action bar */}
      <div className="sticky top-0 z-10 bg-gray-950/95 border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-white font-black text-sm">{athleteName} — Weekly Report</p>
          <p className="text-gray-500 text-[10px]">
            {report.already_existed
              ? `Generated on ${new Date(report.generated_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`
              : 'Just generated'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isParentView && parentPhone && (
            <button
              onClick={handleSendWhatsApp}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-black transition">
              📲 Send to Parent
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-xl text-xs font-black transition">
            {downloading ? '⏳ Generating...' : '⬇ PDF'}
          </button>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-black transition">
            ✕ Close
          </button>
        </div>
      </div>

      {/* report content — this div gets converted to PDF */}
      <div ref={reportRef} className="max-w-2xl mx-auto p-4 md:p-6 space-y-4 pb-16"
        style={{ backgroundColor: '#111827', minHeight: '100vh' }}>

        {/* header */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm">
              {athleteName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-black text-lg leading-tight">{athleteName}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {new Date(report.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(report.week_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className={`text-xs font-black px-4 py-2 rounded-full border ${report.delta >= 1 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              report.delta <= -1 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                'bg-gray-700 border-gray-600 text-gray-300'
            }`}>
            {report.verdict}
          </div>
        </div>

        {/* 4 metric cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Average energy this week</p>
            <p className={`text-3xl font-black ${report.avg_readiness >= 7 ? 'text-emerald-400' : report.avg_readiness >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
              {Math.round(report.avg_readiness * 10)}<span className="text-sm text-gray-500 font-bold">/100</span>
            </p>
            <p className={`text-xs mt-1 font-bold ${deltaColor}`}>
              {deltaSign}{Math.round((report.delta || 0) * 10)} points vs last week
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Sessions attended</p>
            <p className="text-3xl font-black text-white">
              {report.sessions_present}<span className="text-sm text-gray-500 font-bold">/{report.sessions_total}</span>
            </p>
            <p className="text-xs mt-1 font-bold text-gray-400">{report.attendance_pct}% attendance rate</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Training load</p>
            <p className={`text-lg font-black mt-1 ${acwrColor}`}>{acwrLabel}</p>
            <p className="text-gray-600 text-[10px] mt-1">ACWR: {report.acwr}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">Alerts this week</p>
            <p className={`text-3xl font-black ${(report.flags?.length + report.injuries?.length) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {(report.flags?.length || 0) + (report.injuries?.length || 0)}
            </p>
            <p className="text-xs mt-1 font-bold text-gray-400">
              {(report.flags?.length || 0) + (report.injuries?.length || 0) === 0 ? 'All clear' : 'See alerts below'}
            </p>
          </div>
        </div>

        {/* trend graph */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">How energy changed this week</p>
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v === 0 ? 'Low' : v === 50 ? 'Mid' : v === 100 ? 'High' : ''}
                    ticks={[0, 50, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '10px', fontSize: 12 }}
                    formatter={v => [`${v}/100`, 'Energy']} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5}
                    dot={({ cx, cy, payload }) => (
                      <circle key={cx} cx={cx} cy={cy} r={4}
                        fill={payload.score < 50 ? '#E24B4A' : payload.score < 65 ? '#EF9F27' : '#1D9E75'}
                        stroke="none" />
                    )} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-gray-400 text-xs mt-3 leading-relaxed">{report.trend_summary}</p>
            </>
          ) : (
            <p className="text-gray-600 text-xs py-6 text-center">No check-in data for this week yet.</p>
          )}
        </div>

        {/* attendance + ACWR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-3">Attendance this week</p>
            <div className="flex gap-2 flex-wrap">
              {weekDays.map((dayStr, i) => {
                const status = attendanceByDay[dayStr];
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${status === 'present' ? 'bg-emerald-500/20 text-emerald-400' :
                        status === 'absent' ? 'bg-rose-500/20 text-rose-400' :
                          'bg-gray-700 text-gray-600'
                      }`}>
                      {status === 'present' ? '✓' : status === 'absent' ? '✗' : '—'}
                    </div>
                    <span className="text-[9px] text-gray-600">{DAYS[i]}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-gray-500 text-xs mt-3">
              {report.sessions_present} out of {report.sessions_total} sessions attended
            </p>
          </div>

          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-3">Training load check</p>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>This week's effort</span>
              <span className="text-white font-bold">{report.acute_load} units</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-3">
              <span>Monthly average</span>
              <span className="text-white font-bold">{report.chronic_load} units</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${acwrBarWidth}%`, backgroundColor: acwrBarColor }} />
              </div>
              <span className={`text-xs font-black ${acwrColor}`}>{acwrLabel}</span>
            </div>
            <p className="text-gray-600 text-[10px] mt-2">Safe zone: 0.8 – 1.3 ratio</p>
          </div>
        </div>

        {/* alerts */}
        {((report.flags?.length || 0) + (report.injuries?.length || 0)) > 0 && (
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-3">
            <p className="text-gray-500 text-[10px] uppercase font-bold">Things to watch</p>
            {report.flags?.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-sm font-bold">Energy dropped sharply on {new Date(f.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                    Score fell from {f.from} to {f.to} — a drop of {f.drop} points in one day.{' '}
                    {report.flag_descriptions?.[0] || 'Keep an eye on energy levels next week.'}
                  </p>
                </div>
              </div>
            ))}
            {report.injuries?.map((inj, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-sm font-bold">{inj.body_part} {inj.injury_type} — still {inj.status}</p>
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                    {inj.severity.charAt(0).toUpperCase() + inj.severity.slice(1)} severity. Logged on {inj.date_occurred}. Coach is monitoring during sessions.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* next week steps */}
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">What to focus on next week</p>
          <p className="text-gray-500 text-xs mb-4">3 steps to help {athleteName.split(' ')[0]} improve next week</p>
          <div className="space-y-0">
            {(report.next_steps || []).map((step, i) => {
              const tag = TAG_STYLES[step.tag] || TAG_STYLES.both;
              return (
                <div key={i} className={`flex items-start gap-3 py-4 ${i < (report.next_steps.length - 1) ? 'border-b border-gray-700' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-black flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-black text-sm mb-1">{step.title}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{step.description}</p>
                    <span className={`inline-block mt-2 text-[10px] font-black px-3 py-1 rounded-full border ${tag.bg} ${tag.border} ${tag.text}`}>
                      {tag.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* coach note — editable for coaches, read-only for parents */}
        {isParentView ? (
          coachNote && (
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <p className="text-gray-500 text-[10px] uppercase font-bold mb-3">Coach's Note</p>
              <p className="text-gray-200 text-sm leading-relaxed">{coachNote}</p>
            </div>
          )
        ) : (
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
            <p className="text-gray-500 text-[10px] uppercase font-bold mb-3">Coach's personal note (optional)</p>
            <textarea
              rows={3}
              value={coachNote}
              onChange={e => setCoachNote(e.target.value)}
              placeholder={`Add a personal note for ${athleteName.split(' ')[0]}'s parent...`}
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 resize-none placeholder-gray-600 leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-gray-600 text-[10px]">This note will appear at the bottom of the PDF</p>
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-black transition">
                {noteSaved ? '✓ Saved' : savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        )}

        {/* footer */}
        <div className="text-center text-gray-600 text-[10px] pt-2 pb-4 leading-relaxed">
          Generated by AthleteIQ · {new Date(report.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}<br />
          This report is shared with {athleteName}'s parent/guardian.
        </div>
      </div>
    </div>
  );
}

export default WeeklyReport;
