import { describe, expect, it, vi } from "vitest";

vi.mock("../apps/desktop/src/main/settings", () => ({}));

import { modelOptions } from "../apps/desktop/src/main/providers/claude";

describe("Claude Code's model list", () => {
  it("names models whose description does not start with their name", () => {
    expect(
      modelOptions([
        {
          value: "default",
          resolvedModel: "claude-opus-5-5",
          displayName: "Default (recommended)",
          description: "Opus 5.5 · Best for everyday, complex tasks",
        },
        {
          value: "opus",
          resolvedModel: "claude-opus-5-5",
          displayName: "Opus 5.5",
          description: "For complex work and everyday tasks",
        },
        {
          value: "sonnet",
          resolvedModel: "claude-sonnet-5-5",
          displayName: "Sonnet 5.5",
          description: "Most efficient for simpler tasks",
        },
      ]),
    ).toEqual([
      {
        id: "opus",
        name: "Opus 5.5",
        description: "For complex work and everyday tasks",
        isDefault: true,
      },
      {
        id: "sonnet",
        name: "Sonnet 5.5",
        description: "Most efficient for simpler tasks",
        isDefault: false,
      },
    ]);
  });

  it("takes the name from the description when it starts with one", () => {
    expect(
      modelOptions([
        {
          value: "sonnet",
          displayName: "Sonnet",
          description: "Sonnet 5 · Efficient for routine tasks",
        },
      ]),
    ).toEqual([
      {
        id: "sonnet",
        name: "Sonnet 5",
        description: "Efficient for routine tasks",
        isDefault: false,
      },
    ]);
  });
});
