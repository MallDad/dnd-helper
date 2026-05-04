import { describe, expect, it } from "vitest";
import { DEFAULT_CONDITIONS_2024, conditionImageUrl } from "./conditions";

describe("conditions", () => {
  it("contains exactly the 2024 base conditions in the expected spelling and order", () => {
    expect(DEFAULT_CONDITIONS_2024).toEqual([
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
    ]);
  });

  it("maps condition names and Exhaustion levels to condition images", () => {
    expect(conditionImageUrl("Poisoned")).toContain("/conditions/fronts/Poisoned.png");
    expect(conditionImageUrl("Exhaustion 3")).toContain("/conditions/fronts/Exhaustion.png");
    expect(conditionImageUrl("Died of Exhaustion")).toContain("/conditions/fronts/Exhaustion.png");
    expect(conditionImageUrl("Not a condition")).toBeNull();
  });
});
