const ONES = [
  "", "ek", "do", "teen", "chaar", "paanch", "chhah", "saat", "aath", "nau",
  "dus", "gyarah", "baarah", "terah", "chaudah", "pandrah", "solah", "satrah", "atharah", "unnees",
];
const TENS = ["", "", "bees", "tees", "chaalis", "pachaas", "saath", "sattar", "assi", "nabbe"];

/** Transliterated Hindi words for whole rupee amounts, used in Soundbox
 * voice announcements (AGENTS.md §P2: 350 -> "teen sau pachaas"). */
export function numberToHindiWords(n: number): string {
  if (n === 0) return "shunya";
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return TENS[tens]! + (ones ? ` ${ONES[ones]}` : "");
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    return `${ONES[hundreds]} sau` + (rest ? ` ${numberToHindiWords(rest)}` : "");
  }
  if (n < 100_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    return `${numberToHindiWords(thousands)} hazaar` + (rest ? ` ${numberToHindiWords(rest)}` : "");
  }
  return String(n);
}
