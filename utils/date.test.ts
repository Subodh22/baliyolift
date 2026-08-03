// Force a UTC-ahead timezone so we can prove the old UTC bug deterministically.
// (Set before importing the module under test / creating any Date.)
process.env.TZ = "Australia/Sydney";

import { localDateStr, todayStr, offsetDateStr } from "./date";

describe("localDateStr", () => {
  it("keys by the LOCAL calendar day", () => {
    // Built from local components → always the local day, regardless of host TZ.
    const d = new Date(2026, 7, 3, 8, 30, 0); // local Aug 3, 08:30
    expect(localDateStr(d)).toBe("2026-08-03");
  });

  it("zero-pads month and day", () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateStr(new Date(2026, 11, 25))).toBe("2026-12-25");
  });

  it("REGRESSION: does not drift to the UTC day (the meal-plans logging bug)", () => {
    // 08:00 in Sydney (UTC+10/11) is the previous day in UTC. The old code did
    // `new Date().toISOString().split('T')[0]`, which stamped food on the wrong
    // day so it never appeared on today's Fuel view.
    const morning = new Date(2026, 7, 3, 8, 0, 0); // local Sydney Aug 3, 08:00
    expect(localDateStr(morning)).toBe("2026-08-03"); // correct local key
    // The old UTC key would have been the day before — the source of the bug.
    expect(morning.toISOString().split("T")[0]).toBe("2026-08-02");
  });
});

describe("offsetDateStr", () => {
  it("shifts whole days and stays on local calendar days", () => {
    expect(offsetDateStr("2026-08-03", -1)).toBe("2026-08-02");
    expect(offsetDateStr("2026-08-03", 1)).toBe("2026-08-04");
    expect(offsetDateStr("2026-08-03", 0)).toBe("2026-08-03");
  });

  it("crosses month and year boundaries", () => {
    expect(offsetDateStr("2026-08-31", 1)).toBe("2026-09-01");
    expect(offsetDateStr("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("todayStr", () => {
  it("matches localDateStr(now) in format", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
