import { execFile } from "node:child_process";

export interface VoiceProvider {
  /** Speaks `text` aloud (Hindi/Hinglish transliteration) through the
   * counter laptop / Bluetooth speaker acting as the Soundbox. */
  speak(text: string): Promise<void>;
}

/**
 * Pluggable Indic TTS/STT provider goes here when a real vendor key is
 * configured (AGENTS.md §3.3). Not implemented in this build — no vendor
 * credentials exist in this environment to integrate or verify against.
 */
export interface IndicVoiceProvider extends VoiceProvider {
  transcribe(audio: Buffer): Promise<string>;
}

/**
 * OS TTS offline fallback (AGENTS.md §3.3: "OS TTS as offline fallback").
 * Uses Windows SAPI via PowerShell — no external API, no network, works
 * on the counter laptop with zero configuration. Fire-and-forget by
 * design: a demo shouldn't block on speech synthesis finishing.
 */
export class OsTtsVoiceProvider implements VoiceProvider {
  async speak(text: string): Promise<void> {
    const sanitized = text.replace(/["'`]/g, "");
    return new Promise((resolve) => {
      execFile(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("${sanitized}")`,
        ],
        { timeout: 10_000 },
        (err) => {
          if (err) console.error("[voice] OS TTS failed (non-Windows host or no audio device?):", err.message);
          resolve();
        },
      );
    });
  }
}

/** No-op provider for non-Windows/CI environments where OS TTS isn't available. */
export class SilentVoiceProvider implements VoiceProvider {
  async speak(): Promise<void> {}
}

export function getVoiceProvider(): VoiceProvider {
  return process.platform === "win32" ? new OsTtsVoiceProvider() : new SilentVoiceProvider();
}
