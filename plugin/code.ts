import { collectStyles } from '../lib/linter/collectStyles';
import { runLint, getRuleInfos } from '../lib/linter/engine';
import { applyFixes, applyFixWithReason } from '../lib/linter/fixes';
import { PluginMessage, UIMessage, LintSettings, DEFAULT_SETTINGS } from '../lib/types';

// ============================================================
// Plugin Sandbox — runs in Figma, has access to Figma API
// EVAL removed for security (no arbitrary code execution)
// ============================================================

const STORAGE_KEY = 'pixelmint-settings';

figma.showUI(__html__, { width: 380, height: 560 });

function send(msg: UIMessage) {
  figma.ui.postMessage(msg);
}

async function loadSettings(): Promise<LintSettings> {
  const stored = await figma.clientStorage.getAsync(STORAGE_KEY);
  if (stored) {
    return { ...DEFAULT_SETTINGS, ...stored };
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(settings: LintSettings): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE_KEY, settings);
}

// Abort signal for current lint run (#4 — AbortController pattern)
let currentAbortSignal: { aborted: boolean } = { aborted: false };

async function handleLintRun() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    send({ type: 'SELECTION_EMPTY' });
    figma.notify('Select at least one element to lint', { error: true });
    return;
  }

  // Create new abort signal for this run
  currentAbortSignal = { aborted: false };
  const signal = currentAbortSignal;

  try {
    const settings = await loadSettings();
    const context = await collectStyles(settings);
    const result = await runLint(
      selection,
      context,
      (current, total, ruleName) => {
        send({ type: 'LINT_PROGRESS', current, total, ruleName });
      },
      signal
    );
    send({ type: 'LINT_RESULT', result, ruleInfos: getRuleInfos() });
  } catch (e: any) {
    send({ type: 'LINT_ERROR', error: e?.message || 'Unknown error' });
  }
}

async function handleLintFix(message: Extract<PluginMessage, { type: 'LINT_FIX' }>) {
  const filterMap: Record<string, 'critical' | 'warnings' | undefined> = {
    all: undefined,
    critical: 'critical',
    warnings: 'warnings',
  };
  try {
    const result = await applyFixes(message.violations, filterMap[message.fixType]);
    send({ type: 'LINT_FIX_DONE', ...result });
    const suffix =
      result.failedCount > 0 || result.pendingConfirmationCount > 0
        ? `, ${result.failedCount} failed, ${result.pendingConfirmationCount} need confirmation`
        : '';
    figma.notify(`Fixed ${result.fixedCount} issue${result.fixedCount !== 1 ? 's' : ''}${suffix}`);
  } catch (e: any) {
    send({ type: 'LINT_ERROR', error: e?.message || 'Could not apply fixes' });
  }
}

async function handleLintFixSingle(message: Extract<PluginMessage, { type: 'LINT_FIX_SINGLE' }>) {
  const fix = await applyFixWithReason(message.violation, {
    action: message.fixAction,
    confirmed: message.confirmed,
  });
  const result = {
    fixedViolations: fix.status === 'fixed' ? [fix.violation] : [],
    failedFixes:
      fix.status === 'failed'
        ? [
            {
              violation: fix.violation,
              action: fix.action,
              reason: fix.reason || 'Could not apply fix',
            },
          ]
        : [],
    pendingConfirmationFixes:
      fix.status === 'pendingConfirmation'
        ? [
            {
              violation: fix.violation,
              action: fix.action,
              reason: fix.reason || 'Requires explicit confirmation',
            },
          ]
        : [],
    fixedCount: fix.status === 'fixed' ? 1 : 0,
    failedCount: fix.status === 'failed' ? 1 : 0,
    pendingConfirmationCount: fix.status === 'pendingConfirmation' ? 1 : 0,
  };

  send({ type: 'LINT_FIX_DONE', ...result });
  if (fix.status === 'fixed') {
    figma.notify('Fixed!');
  } else if (fix.status === 'pendingConfirmation') {
    figma.notify(fix.reason || 'Requires explicit confirmation', { error: true });
  } else {
    figma.notify(`Could not fix: ${fix.reason || 'Unknown reason'}`, { error: true });
  }
}

async function handleNavigate(nodeId: string) {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node && 'x' in node) {
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
    }
  } catch (e: any) {
    send({ type: 'LINT_ERROR', error: e?.message || 'Could not navigate to node' });
  }
}

async function handleSettingsLoad() {
  const settings = await loadSettings();
  send({ type: 'SETTINGS_DATA', settings, ruleInfos: getRuleInfos() });
}

async function handleSettingsSave(settings: LintSettings) {
  await saveSettings(settings);
  figma.notify('Settings saved');
}

// ============================================================
// Message router (#12 — typed message parameter)
// ============================================================

type IncomingMessage = PluginMessage;

figma.ui.onmessage = async (message: IncomingMessage) => {
  switch (message.type) {
    case 'LINT_RUN':
      await handleLintRun();
      break;

    case 'LINT_CANCEL':
      currentAbortSignal.aborted = true;
      break;

    case 'LINT_FIX':
      await handleLintFix(message);
      break;

    case 'LINT_FIX_SINGLE':
      await handleLintFixSingle(message);
      break;

    case 'LINT_NAVIGATE':
      await handleNavigate(message.nodeId);
      break;

    case 'SETTINGS_LOAD':
      await handleSettingsLoad();
      break;

    case 'SETTINGS_SAVE':
      await handleSettingsSave(message.settings);
      break;
  }
};
