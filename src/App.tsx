import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Violation,
  LintResult,
  LintSettings,
  RuleInfo,
  DEFAULT_SETTINGS,
  PluginMessage,
  UIMessage,
  Category,
  Severity,
} from '@/lib/types';

// ============================================================
// Helpers
// ============================================================

type Screen = 'main' | 'report' | 'settings';

function sendToPlugin(message: PluginMessage) {
  const msg = { pluginMessage: message, pluginId: '*' };
  parent.postMessage(msg, '*');
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'text-red-700',
  warning: 'text-amber-700',
  info: 'text-gray-500',
};

const SEVERITY_BG: Record<Severity, string> = {
  critical: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-gray-50 border-gray-200',
};

function SeverityIcon({ severity }: { severity: Severity }) {
  const cls = `shrink-0 ${SEVERITY_COLORS[severity]}`;
  if (severity === 'critical')
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5.5 5.5l5 5M10.5 5.5l-5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  if (severity === 'warning')
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
        <path
          d="M8 1.5l7 13H1l7-13z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="12" r="0.75" fill="currentColor" />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.75" r="0.75" fill="currentColor" />
    </svg>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`w-[40px] h-[24px] rounded-full transition-colors relative shrink-0 ${
        enabled ? 'bg-blue-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-[4px] left-[4px] w-[16px] h-[16px] rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-[16px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const CATEGORY_LABELS: Record<Category, string> = {
  style: 'Styles',
  structure: 'Structure',
  naming: 'Naming',
  layout: 'Layout',
  a11y: 'Accessibility',
  cleanup: 'Cleanup',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-red-700';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

// ============================================================
// Main Component
// ============================================================

export default function Plugin() {
  const [screen, setScreen] = useState<Screen>('main');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, ruleName: '' });
  const [result, setResult] = useState<LintResult | null>(null);
  const [ruleInfos, setRuleInfos] = useState<RuleInfo[]>([]);
  const [settings, setSettings] = useState<LintSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [fixedViolations, setFixedViolations] = useState<Violation[]>([]);
  const [reportTab, setReportTab] = useState<'issues' | 'completed'>('issues');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [showLimit, setShowLimit] = useState<Record<string, number>>({});
  const pendingFixRef = useRef<
    { type: 'single'; violation: Violation } | { type: 'bulk'; violations: Violation[] } | null
  >(null);

  const toggleCat = useCallback((cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const ITEMS_PER_PAGE = 20;

  // Listen for messages from plugin sandbox
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as UIMessage;
      if (!msg?.type) return;

      switch (msg.type) {
        case 'LINT_PROGRESS':
          setProgress({
            current: msg.current,
            total: msg.total,
            ruleName: msg.ruleName,
          });
          break;

        case 'LINT_RESULT':
          setLoading(false);
          setResult(msg.result);
          setRuleInfos(msg.ruleInfos);
          setScreen('report');
          break;

        case 'LINT_ERROR':
          setLoading(false);
          setError(msg.error);
          break;

        case 'LINT_FIX_DONE':
          if (msg.fixedCount > 0 && pendingFixRef.current) {
            const pending = pendingFixRef.current;
            if (pending.type === 'single') {
              setFixedViolations((prev) => [...prev, pending.violation]);
              setResult((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  violations: prev.violations.filter(
                    (v) =>
                      !(
                        v.nodeId === pending.violation.nodeId &&
                        v.ruleId === pending.violation.ruleId
                      )
                  ),
                };
              });
            } else {
              const keys = new Set(pending.violations.map((v) => v.nodeId + ':' + v.ruleId));
              setFixedViolations((prev) => [...prev, ...pending.violations]);
              setResult((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  violations: prev.violations.filter((v) => !keys.has(v.nodeId + ':' + v.ruleId)),
                };
              });
            }
            pendingFixRef.current = null;
            setLoading(true);
            setProgress({ current: 0, total: 0, ruleName: '' });
            sendToPlugin({ type: 'LINT_RUN' });
          } else {
            pendingFixRef.current = null;
          }
          break;

        case 'SETTINGS_DATA':
          setSettings(msg.settings);
          setRuleInfos(msg.ruleInfos);
          break;

        case 'SELECTION_EMPTY':
          setLoading(false);
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Load settings on mount
  useEffect(() => {
    sendToPlugin({ type: 'SETTINGS_LOAD' });
  }, []);

  const handleLint = useCallback(() => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 0, ruleName: '' });
    setFixedViolations([]);
    setReportTab('issues');
    sendToPlugin({ type: 'LINT_RUN' });
  }, []);

  const handleCancel = useCallback(() => {
    sendToPlugin({ type: 'LINT_CANCEL' });
    setLoading(false);
  }, []);

  const handleNavigate = useCallback((nodeId: string) => {
    sendToPlugin({ type: 'LINT_NAVIGATE', nodeId });
  }, []);

  const handleFixAll = useCallback(
    (fixType: 'all' | 'critical' | 'warnings') => {
      if (!result) return;
      const toFix = result.violations.filter((v) => {
        if (!v.fixable) return false;
        if (fixType === 'critical') return v.severity === 'critical';
        if (fixType === 'warnings') return v.severity === 'warning';
        return true;
      });
      pendingFixRef.current = { type: 'bulk', violations: toFix };
      sendToPlugin({
        type: 'LINT_FIX',
        fixType,
        violations: result.violations,
      });
    },
    [result]
  );

  const handleFixSingle = useCallback((violation: Violation) => {
    pendingFixRef.current = { type: 'single', violation };
    sendToPlugin({ type: 'LINT_FIX_SINGLE', violation });
  }, []);

  const handleSaveSettings = useCallback((newSettings: LintSettings) => {
    setSettings(newSettings);
    sendToPlugin({ type: 'SETTINGS_SAVE', settings: newSettings });
  }, []);

  // ============================================================
  // Screen: Main
  // ============================================================
  if (screen === 'main') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-semibold text-gray-800">Pixelmint</h1>
          <button
            onClick={() => {
              sendToPlugin({ type: 'SETTINGS_LOAD' });
              setScreen('settings');
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-6 text-center">
          Select elements and lint them against your design system
        </p>

        {error && (
          <div className="w-full max-w-[280px] mb-3 p-2 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-700 hover:text-red-800 mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {!loading ? (
          <>
            <button
              onClick={handleLint}
              className="w-full max-w-[240px] py-3 px-4 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              Lint Selection
            </button>
            {result && (
              <button
                onClick={() => setScreen('report')}
                className="mt-3 text-xs text-blue-600 hover:text-blue-700"
              >
                View last report
              </button>
            )}
          </>
        ) : (
          <div className="w-full max-w-[280px]">
            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{
                  width:
                    progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
                }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center mb-1">
              {progress.current}/{progress.total}
            </p>
            <p className="text-xs text-gray-500 text-center mb-3">{progress.ruleName}</p>
            <button
              onClick={handleCancel}
              className="block mx-auto text-xs text-red-700 hover:text-red-800"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // Screen: Report
  // ============================================================
  if (screen === 'report' && result) {
    const { violations, score, duration, nodeCount } = result;
    // Single-pass counting instead of 4 separate filter passes
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let fixableCount = 0;
    for (const v of violations) {
      if (v.severity === 'critical') criticalCount++;
      else if (v.severity === 'warning') warningCount++;
      else infoCount++;
      if (v.fixable) fixableCount++;
    }

    // Group by category
    const grouped = violations.reduce<Record<string, Violation[]>>((acc, v) => {
      (acc[v.category] = acc[v.category] || []).push(v);
      return acc;
    }, {});

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2 z-10">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setScreen('main')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              &larr; Back
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  sendToPlugin({ type: 'SETTINGS_LOAD' });
                  setScreen('settings');
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
                title="Settings"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Score */}
          <div
            className={`flex items-center justify-between gap-3 p-2 rounded-lg border ${scoreBg(score)}`}
          >
            <span className="text-3xl font-bold">
              <span className={scoreColor(score)}>{score}</span>
              <span className="font-normal text-gray-400">/100</span>
            </span>
            <div className="flex-1 flex gap-2 text-xs">
              {criticalCount > 0 && (
                <span className="text-red-700 font-medium">{criticalCount} critical</span>
              )}
              {warningCount > 0 && (
                <span className="text-amber-700 font-medium">{warningCount} warning</span>
              )}
              {infoCount > 0 && <span className="text-gray-600">{infoCount} info</span>}
            </div>
            <button
              onClick={handleLint}
              className="shrink-0 p-1.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center"
              title="Re-lint selection"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>

          {/* Fix row */}
          {fixableCount > 0 && (
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => handleFixAll('all')}
                className="flex-1 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Fix All ({fixableCount})
              </button>
              {criticalCount > 0 && (
                <button
                  onClick={() => handleFixAll('critical')}
                  className="flex-1 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                >
                  Fix Critical
                </button>
              )}
            </div>
          )}

          <div className="flex gap-1 mt-2 border-b border-gray-100 pb-0">
            <button
              onClick={() => setReportTab('issues')}
              className={`flex-1 py-2 text-xs font-medium rounded-t transition-colors ${
                reportTab === 'issues'
                  ? 'text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Issues{violations.length > 0 ? ` (${violations.length})` : ''}
            </button>
            <button
              onClick={() => setReportTab('completed')}
              className={`flex-1 py-2 text-xs font-medium rounded-t transition-colors ${
                reportTab === 'completed'
                  ? 'text-green-700 border-b-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed ({fixedViolations.length})
            </button>
          </div>
        </div>

        {/* Violations / Completed */}
        <div className="px-3 py-2">
          {reportTab === 'issues' ? (
            violations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-2xl mb-2">&#10003;</p>
                <p className="text-sm font-medium text-green-700">All checks passed!</p>
              </div>
            ) : (
              Object.entries(grouped).map(([cat, items]) => {
                const collapsed = collapsedCats.has(cat);
                const limit = showLimit[cat] || ITEMS_PER_PAGE;
                const visible = collapsed ? [] : items.slice(0, limit);
                const remaining = items.length - limit;
                return (
                  <div key={cat} className="mb-3">
                    <button
                      onClick={() => toggleCat(cat)}
                      className="flex items-center gap-1 w-full text-left mb-1 group"
                    >
                      <span
                        className="text-xs text-gray-500 transition-transform"
                        style={{ transform: collapsed ? 'rotate(-90deg)' : '' }}
                      >
                        &#9660;
                      </span>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide group-hover:text-gray-700">
                        {CATEGORY_LABELS[cat as Category] || cat} ({items.length})
                      </h3>
                    </button>
                    {!collapsed && (
                      <div className="space-y-1">
                        {visible.map((v, i) => (
                          <div
                            key={`${v.nodeId}-${v.ruleId}-${i}`}
                            className={`p-2 rounded border ${SEVERITY_BG[v.severity]}`}
                          >
                            <div className="flex items-start gap-2">
                              <SeverityIcon severity={v.severity} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  {v.nodeId ? (
                                    <button
                                      onClick={() => handleNavigate(v.nodeId)}
                                      className="text-xs font-medium text-blue-600 hover:underline max-w-full text-left"
                                      title="Click to zoom to element"
                                    >
                                      {v.nodeName || v.ruleId}
                                    </button>
                                  ) : (
                                    <span className="text-xs font-medium text-gray-600">
                                      {v.nodeName || 'File-level'}
                                    </span>
                                  )}
                                  {v.isMainComponent && (
                                    <span className="text-xs px-1 py-1 rounded bg-purple-100 text-purple-600 shrink-0">
                                      Main Component
                                    </span>
                                  )}
                                  {v.isInstance && (
                                    <span className="text-xs px-1 py-1 rounded bg-orange-100 text-orange-600 shrink-0">
                                      Edit master component
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mt-1">
                                  {v.message}
                                  {v.ruleId === 'hiddenLayers' && (
                                    <span className="text-xs text-red-700 font-medium">
                                      {' '}
                                      &mdash; layer will be removed
                                    </span>
                                  )}
                                </p>
                                {(v.current || v.expected) && v.ruleId !== 'hiddenLayers' && (
                                  <div className="flex flex-wrap gap-1 mt-1 text-xs min-w-0">
                                    {v.current && (
                                      <span className="text-red-700 bg-red-50 px-1 rounded break-all min-w-0">
                                        {v.current}
                                      </span>
                                    )}
                                    {v.expected && (
                                      <span className="text-green-700 bg-green-50 px-1 rounded break-all min-w-0">
                                        {v.expected}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                {v.suggestedFixData && (
                                  <button
                                    onClick={() => handleFixSingle(v)}
                                    className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    title={`Apply style: ${v.expected || ''}`}
                                  >
                                    Apply
                                  </button>
                                )}
                                {v.suggestedCreateData && (
                                  <button
                                    onClick={() =>
                                      handleFixSingle({
                                        ...v,
                                        suggestedFixData: 'new:' + v.suggestedCreateData,
                                      })
                                    }
                                    className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                                    title={`Create new style: ${v.suggestedCreateData}`}
                                  >
                                    New
                                  </button>
                                )}
                                {v.fixable && !v.suggestedFixData && !v.suggestedCreateData && (
                                  <button
                                    onClick={() => handleFixSingle(v)}
                                    className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  >
                                    Fix
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {remaining > 0 && (
                          <button
                            onClick={() =>
                              setShowLimit((prev) => ({ ...prev, [cat]: limit + ITEMS_PER_PAGE }))
                            }
                            className="w-full py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          >
                            Show {Math.min(remaining, ITEMS_PER_PAGE)} more ({remaining} remaining)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : fixedViolations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No fixes yet</p>
            </div>
          ) : (
            Object.entries(
              fixedViolations.reduce<Record<string, Violation[]>>((acc, v) => {
                (acc[v.category] = acc[v.category] || []).push(v);
                return acc;
              }, {})
            ).map(([cat, items]) => (
              <div key={cat} className="mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {CATEGORY_LABELS[cat as Category] || cat} ({items.length})
                </h3>
                <div className="space-y-1">
                  {items.map((v, i) => (
                    <div
                      key={`${v.nodeId}-${v.ruleId}-${i}`}
                      className="p-2 rounded border bg-green-50 border-green-200"
                    >
                      <div className="flex items-start gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          className="shrink-0 text-green-500"
                        >
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <path
                            d="M5 8l2 2 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-600 block">
                            {v.nodeName}
                          </span>
                          <p className="text-xs text-gray-600 mt-1 line-through">{v.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // Screen: Settings
  // ============================================================
  if (screen === 'settings') {
    const rulesByCategory = ruleInfos.reduce<Record<string, RuleInfo[]>>((acc, r) => {
      (acc[r.category] = acc[r.category] || []).push(r);
      return acc;
    }, {});

    const isRuleEnabled = (rule: RuleInfo) => {
      if (rule.defaultEnabled) {
        return !settings.disabledRules.includes(rule.id);
      }
      return Boolean(settings.enabledRules?.includes(rule.id));
    };

    const toggleRule = (rule: RuleInfo) => {
      const enabled = isRuleEnabled(rule);
      if (rule.defaultEnabled) {
        const disabledRules = enabled
          ? [...settings.disabledRules, rule.id]
          : settings.disabledRules.filter((id) => id !== rule.id);
        handleSaveSettings({ ...settings, disabledRules });
        return;
      }

      const enabledRules = enabled
        ? (settings.enabledRules || []).filter((id) => id !== rule.id)
        : [...(settings.enabledRules || []), rule.id];
      const disabledRules = settings.disabledRules.filter((id) => id !== rule.id);
      handleSaveSettings({ ...settings, disabledRules, enabledRules });
    };

    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setScreen(result ? 'report' : 'main')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              &larr; Back
            </button>
            <h2 className="text-sm font-semibold text-gray-800">Settings</h2>
            <div className="w-8" />
          </div>
        </div>

        <div className="px-3 py-2 space-y-4">
          {/* General */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              General
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Spacing base (px)</label>
                <select
                  value={settings.spacingBase}
                  onChange={(e) =>
                    handleSaveSettings({
                      ...settings,
                      spacingBase: Number(e.target.value),
                    })
                  }
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                >
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Max nesting depth</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.nestingDepthLimit}
                  onChange={(e) =>
                    handleSaveSettings({
                      ...settings,
                      nestingDepthLimit: Number(e.target.value),
                    })
                  }
                  className="w-12 text-xs border border-gray-200 rounded px-2 py-1 text-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Icon sizes</label>
                <input
                  type="text"
                  defaultValue={(settings.iconSizes || [16, 20, 24, 32]).join(', ')}
                  onBlur={(e) => {
                    const parsed = e.target.value
                      .split(',')
                      .map((s) => parseInt(s.trim(), 10))
                      .filter((n) => !isNaN(n) && n > 0);
                    if (parsed.length > 0) {
                      handleSaveSettings({ ...settings, iconSizes: parsed });
                    }
                  }}
                  className="w-28 text-xs border border-gray-200 rounded px-2 py-1 text-right"
                  title="Standard icon sizes, comma-separated"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Min font size (px)</label>
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={settings.minFontSize || 12}
                  onChange={(e) =>
                    handleSaveSettings({
                      ...settings,
                      minFontSize: Number(e.target.value),
                    })
                  }
                  className="w-12 text-xs border border-gray-200 rounded px-2 py-1 text-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Min touch target (px)</label>
                <input
                  type="number"
                  min={24}
                  max={96}
                  value={settings.touchTargetMin || 44}
                  onChange={(e) =>
                    handleSaveSettings({
                      ...settings,
                      touchTargetMin: Number(e.target.value),
                    })
                  }
                  className="w-12 text-xs border border-gray-200 rounded px-2 py-1 text-center"
                />
              </div>
            </div>
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rules</h3>
              <button
                onClick={() => handleSaveSettings({ ...DEFAULT_SETTINGS })}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Reset to defaults
              </button>
            </div>
            {Object.entries(rulesByCategory).map(([cat, rules]) => (
              <div key={cat} className="mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                  {CATEGORY_LABELS[cat as Category] || cat}
                </p>
                <div className="space-y-2">
                  {rules.map((rule) => {
                    const enabled = isRuleEnabled(rule);
                    return (
                      <div key={rule.id} className="flex items-center justify-between py-1">
                        <div className="flex-1 min-w-0 mr-2 flex items-start gap-2">
                          <SeverityIcon severity={rule.severity} />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-700">{rule.name}</p>
                            <p className="text-xs text-gray-500">{rule.description}</p>
                          </div>
                        </div>
                        <Toggle enabled={enabled} onToggle={() => toggleRule(rule)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <button onClick={() => setScreen('main')} className="text-blue-600 text-sm">
        Back to main
      </button>
    </div>
  );
}
