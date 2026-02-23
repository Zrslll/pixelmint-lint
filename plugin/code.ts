import { collectStyles } from '../lib/linter/collectStyles';
import { runLint, getRuleInfos } from '../lib/linter/engine';
import { applyFix, applyFixes } from '../lib/linter/fixes';
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
    const context = collectStyles(settings);
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
  let fixedCount = 0;
  try {
    fixedCount = await applyFixes(message.violations, filterMap[message.fixType]);
  } catch {
    // Partial fixes may have succeeded before the error
  }
  send({ type: 'LINT_FIX_DONE', fixedCount });
  figma.notify(`Fixed ${fixedCount} issue${fixedCount !== 1 ? 's' : ''}`);
}

async function handleLintFixSingle(message: Extract<PluginMessage, { type: 'LINT_FIX_SINGLE' }>) {
  let success = false;
  try {
    success = await applyFix(message.violation);
  } catch {
    // If exception but node was removed/changed, treat as partial success
    const node = figma.getNodeById(message.violation.nodeId);
    success = !node || node.removed;
  }
  send({ type: 'LINT_FIX_DONE', fixedCount: success ? 1 : 0 });
  if (success) {
    figma.notify('Fixed!');
  } else {
    figma.notify('Could not fix this issue', { error: true });
  }
}

function handleNavigate(nodeId: string) {
  const node = figma.getNodeById(nodeId);
  if (node && 'x' in node) {
    figma.currentPage.selection = [node as SceneNode];
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
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
      handleNavigate(message.nodeId);
      break;

    case 'SETTINGS_LOAD':
      await handleSettingsLoad();
      break;

    case 'SETTINGS_SAVE':
      await handleSettingsSave(message.settings);
      break;
  }
};
