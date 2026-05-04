export const DEFAULT_CONDITIONS_2024 = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious"
];

export const CONDITION_IMAGE_URLS: Record<string, string> = {
  Blinded: new URL("../conditions/fronts/Blinded.png", import.meta.url).href,
  Charmed: new URL("../conditions/fronts/Charmed.png", import.meta.url).href,
  Deafened: new URL("../conditions/fronts/Deafened.png", import.meta.url).href,
  Exhaustion: new URL("../conditions/fronts/Exhaustion.png", import.meta.url).href,
  Frightened: new URL("../conditions/fronts/Frightened.png", import.meta.url).href,
  Grappled: new URL("../conditions/fronts/Grappled.png", import.meta.url).href,
  Incapacitated: new URL("../conditions/fronts/Incapacitated.png", import.meta.url).href,
  Invisible: new URL("../conditions/fronts/Invisible.png", import.meta.url).href,
  Paralyzed: new URL("../conditions/fronts/Paralyzed.png", import.meta.url).href,
  Petrified: new URL("../conditions/fronts/Petrified.png", import.meta.url).href,
  Poisoned: new URL("../conditions/fronts/Poisoned.png", import.meta.url).href,
  Prone: new URL("../conditions/fronts/Prone.png", import.meta.url).href,
  Restrained: new URL("../conditions/fronts/Restrained.png", import.meta.url).href,
  Stunned: new URL("../conditions/fronts/Stunned.png", import.meta.url).href,
  Unconscious: new URL("../conditions/fronts/Unconscious.png", import.meta.url).href
};

export function conditionImageUrl(conditionName: string) {
  if (conditionName === "Died of Exhaustion" || conditionName.startsWith("Exhaustion")) {
    return CONDITION_IMAGE_URLS.Exhaustion;
  }

  return CONDITION_IMAGE_URLS[conditionName] ?? null;
}
