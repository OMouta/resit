import { describe, expect, it } from "vitest";

import { byteRange } from "../../apps/desktop/src/main/media-protocol";

describe("byte ranges for audio and video", () => {
  it("reads the ranges a media element asks for", () => {
    expect(byteRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(byteRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(byteRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("refuses what the file does not hold", () => {
    expect(byteRange("bytes=1000-", 1000)).toBeNull();
    expect(byteRange("bytes=5-2", 1000)).toBeNull();
    expect(byteRange("items=0-1", 1000)).toBeNull();
  });
});
