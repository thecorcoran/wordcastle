export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function setupInstallPrompt(
  onAvailabilityChange: (canInstall: boolean) => void,
): { triggerInstall: () => Promise<boolean> } {
  let deferredPrompt: BeforeInstallPromptEvent | null = null;

  if (typeof window !== 'undefined' && !isStandaloneMode()) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      onAvailabilityChange(true);
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      onAvailabilityChange(false);
    });
  }

  return {
    async triggerInstall(): Promise<boolean> {
      if (!deferredPrompt) return false;
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      onAvailabilityChange(false);
      return choice.outcome === 'accepted';
    },
  };
}
