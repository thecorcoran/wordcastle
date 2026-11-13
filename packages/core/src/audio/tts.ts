export interface SpeakOptions {
  voiceURI?: string | null;
  rate?: number;
  pitch?: number;
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function listTtsVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en') || true);
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

export function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!isTtsSupported() || !text.trim()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = opts.rate ?? 0.95;
      utter.pitch = opts.pitch ?? 1.0;

      if (opts.voiceURI) {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.voiceURI === opts.voiceURI);
        if (match) utter.voice = match;
      }

      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };

      // Safety timeout in case browser speechSynthesis hangs without firing onend
      const maxWaitMs = Math.max(4000, text.length * 180);
      const timer = setTimeout(done, maxWaitMs);

      utter.onend = done;
      utter.onerror = done;
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}
