import { describe, expect, it } from "vitest";
import {
  endIndex,
  firstEnabledIndex,
  homeIndex,
  moveIndex,
  pageIndex,
  placement,
  type SelectOption,
  typeahead,
} from "./logic";

describe("Select pure logic", () => {
  const options: SelectOption[] = [
    { value: "opt0", label: "Alpha", disabled: true },
    { value: "opt1", label: "Bravo" },
    { value: "opt2", label: "Charlie", disabled: true },
    { value: "opt3", label: "Delta" },
    { value: "opt4", label: "Echo" },
    { value: "opt5", label: "Foxtrot", disabled: true },
    { value: "opt6", label: "Golf" },
    { value: "opt7", label: "Hotel" },
    { value: "opt8", label: "India" },
    { value: "opt9", label: "Juliet" },
    { value: "opt10", label: "Kilo" },
    { value: "opt11", label: "Lima" },
    { value: "opt12", label: "Mike", disabled: true },
  ];

  it("1. first enabled with a disabled first option returns first non-disabled index", () => {
    expect(firstEnabledIndex(options)).toBe(1);
    expect(firstEnabledIndex([{ value: "1", label: "One", disabled: true }])).toBe(-1);
  });

  it("2. moveIndex forward skips disabled and advances to next enabled", () => {
    expect(moveIndex(options, 1, 1)).toBe(3); // skips opt2 (disabled)
    expect(moveIndex(options, 4, 1)).toBe(6); // skips opt5 (disabled)
  });

  it("3. moveIndex forward clamps at end without wrapping", () => {
    expect(moveIndex(options, 11, 1)).toBe(11); // opt12 is disabled, clamps at 11
  });

  it("4. moveIndex backward skips disabled and moves to previous enabled", () => {
    expect(moveIndex(options, 3, -1)).toBe(1); // skips opt2
    expect(moveIndex(options, 6, -1)).toBe(4); // skips opt5
  });

  it("5. moveIndex backward clamps at beginning without wrapping", () => {
    expect(moveIndex(options, 1, -1)).toBe(1); // opt0 is disabled, clamps at 1
  });

  it("6. homeIndex returns first enabled index with disabled first option", () => {
    expect(homeIndex(options)).toBe(1);
  });

  it("7. endIndex returns last enabled index with disabled last option", () => {
    expect(endIndex(options)).toBe(11); // opt12 is disabled, last enabled is 11
  });

  it("8. pageIndex forward jumps 10 steps and clamps", () => {
    expect(pageIndex(options, 1, 1)).toBe(11);
    expect(pageIndex(options, 9, 1)).toBe(11); // clamped to 11 (12 is disabled)
  });

  it("9. pageIndex backward jumps 10 steps and clamps", () => {
    expect(pageIndex(options, 11, -1)).toBe(1);
    expect(pageIndex(options, 3, -1)).toBe(1); // clamped to 1 (0 is disabled)
  });

  it("10. pageIndex skips disabled target landing", () => {
    // opt5 is disabled. If jumping from index 15 in a 20-item list to a disabled item:
    const listWithDisabledAt10: SelectOption[] = Array.from({ length: 20 }, (_, i) => ({
      value: `val-${i}`,
      label: `Label ${i}`,
      disabled: i === 10,
    }));
    // From 0 jumping down +10 targets 10, but 10 is disabled -> should pick 11
    expect(pageIndex(listWithDisabledAt10, 0, 1)).toBe(11);
  });

  it("11. typeahead matches single letter case-insensitively", () => {
    const fruits: SelectOption[] = [
      { value: "a1", label: "Apple" },
      { value: "b1", label: "Banana" },
      { value: "c1", label: "Cherry" },
    ];
    expect(typeahead(fruits, -1, "b")).toBe(1);
    expect(typeahead(fruits, 0, "C")).toBe(2);
  });

  it("12. typeahead repeated letter cycles through matching options", () => {
    const list: SelectOption[] = [
      { value: "c1", label: "California" },
      { value: "c2", label: "Canada" },
      { value: "c3", label: "Colorado" },
      { value: "d1", label: "Denmark" },
    ];
    // First 'c' from -1 gives California (0)
    expect(typeahead(list, -1, "c")).toBe(0);
    // Next 'c' from 0 gives Canada (1)
    expect(typeahead(list, 0, "c")).toBe(1);
    // Next 'c' from 1 gives Colorado (2)
    expect(typeahead(list, 1, "c")).toBe(2);
    // Next 'c' from 2 wraps back to California (0)
    expect(typeahead(list, 2, "c")).toBe(0);
    // Repeated buffer "ccc" also cycles
    expect(typeahead(list, 1, "cc")).toBe(2);
  });

  it("13. typeahead matches multi-letter prefix", () => {
    const list: SelectOption[] = [
      { value: "c1", label: "California" },
      { value: "c2", label: "Canada" },
      { value: "c3", label: "Colorado" },
    ];
    expect(typeahead(list, 0, "col")).toBe(2);
    expect(typeahead(list, 0, "can")).toBe(1);
    expect(typeahead(list, 0, "cal")).toBe(0);
  });

  it("14. typeahead returns -1 when nothing matches", () => {
    const list: SelectOption[] = [
      { value: "a", label: "Apple" },
      { value: "b", label: "Banana" },
    ];
    expect(typeahead(list, 0, "z")).toBe(-1);
    expect(typeahead(list, 0, "xyz")).toBe(-1);
  });

  it("15. typeahead skips disabled options", () => {
    const list: SelectOption[] = [
      { value: "a1", label: "Apple", disabled: true },
      { value: "a2", label: "Apricot" },
      { value: "a3", label: "Avocado", disabled: true },
    ];
    expect(typeahead(list, -1, "a")).toBe(1); // skips Apple, lands on Apricot
    expect(typeahead(list, 1, "a")).toBe(1); // wraps around, Apple is disabled, Avocado disabled, lands on Apricot
  });

  it("16. placement defaults to bottom when room below is ample", () => {
    const res = placement({
      triggerRect: { top: 100, bottom: 140 },
      viewportHeight: 800,
      listHeight: 200,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow: 800 - 140 - 6 = 654 >= 200
    expect(res.side).toBe("bottom");
    expect(res.maxHeight).toBe(280);
  });

  it("17. placement flips to top when room below is small and room above is larger", () => {
    const res = placement({
      triggerRect: { top: 600, bottom: 640 },
      viewportHeight: 700,
      listHeight: 200,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow: 700 - 640 - 6 = 54 < 200
    // roomAbove: 600 - 6 = 594 > 54
    expect(res.side).toBe("top");
    expect(res.maxHeight).toBe(280);
  });

  it("18. placement maxHeight is limited by room on chosen side minus margin", () => {
    const res = placement({
      triggerRect: { top: 600, bottom: 640 },
      viewportHeight: 800,
      listHeight: 300,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow: 800 - 640 - 6 = 154 < 280
    // roomAbove: 600 - 6 = 594 > 154 -> flips to top
    expect(res.side).toBe("top");
    expect(res.maxHeight).toBe(280);

    // Now test when room on top is small:
    const res2 = placement({
      triggerRect: { top: 120, bottom: 160 },
      viewportHeight: 220,
      listHeight: 200,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow: 220 - 160 - 6 = 54
    // roomAbove: 120 - 6 = 114 > 54 -> flips to top
    // maxHeight: 114 - 12 = 102
    expect(res2.side).toBe("top");
    expect(res2.maxHeight).toBe(102);
  });

  it("19. placement stays bottom when room below and room above are equal", () => {
    const res = placement({
      triggerRect: { top: 100, bottom: 140 },
      viewportHeight: 240,
      listHeight: 200,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow: 240 - 140 - 6 = 94
    // roomAbove: 100 - 6 = 94
    // roomAbove > roomBelow is false -> stays bottom
    expect(res.side).toBe("bottom");
    expect(res.maxHeight).toBe(94 - 12);
  });
});
