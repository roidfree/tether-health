// Kept small and matched to what both Deepgram STT and ElevenLabs TTS
// support well (see agent/main.py) - not an exhaustive list of every
// language either service technically supports.
// Labels are each language's own endonym (what a speaker of that language
// calls it), not the English name - shown as-is in the picker.
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
