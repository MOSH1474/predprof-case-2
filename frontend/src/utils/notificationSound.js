let audioContext;
let lastPlayedAt = 0;

export function playNotificationSound() {
  if (typeof window === "undefined") {
    return;
  }
  const now = Date.now();
  if (now - lastPlayedAt < 1200) {
    return;
  }
  lastPlayedAt = now;

  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      return;
    }
    if (!audioContext) {
      audioContext = new Context();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.06;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch {
    // ignore audio errors
  }
}
