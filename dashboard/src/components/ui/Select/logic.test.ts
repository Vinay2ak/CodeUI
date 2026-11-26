import { describe, it, expect } from 'vitest';
import {
  firstEnabledIndex,
  homeIndex,
  endIndex,
  moveIndex,
  pageIndex,
  typeahead,
  placement,
  type SelectOption,
} from './logic';

describe('Select logic module', () => {
  const optionsWithDisabledFirst: SelectOption[] = [
    { value: '1', label: 'Option 1', disabled: true },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3', disabled: true },
    { value: '4', label: 'Option 4' },
    { value: '5', label: 'Option 5', disabled: true },
  ];

  it('1. firstEnabledIndex finds first enabled option with disabled first option', () => {
    expect(firstEnabledIndex(optionsWithDisabledFirst)).toBe(1);
    expect(firstEnabledIndex([{ value: '1', label: 'Disabled', disabled: true }])).toBe(-1);
    expect(firstEnabledIndex([])).toBe(-1);
  });

  it('2. moveIndex skips disabled options moving downwards and clamps at end', () => {
    // from index 1 (Option 2), moving +1 should skip index 2 (disabled) and land on index 3 (Option 4)
    expect(moveIndex(optionsWithDisabledFirst, 1, 1)).toBe(3);
    // from index 3, moving +1 has no further enabled options, should clamp at 3 (no wrap)
    expect(moveIndex(optionsWithDisabledFirst, 3, 1)).toBe(3);
  });

  it('3. moveIndex skips disabled options moving upwards and clamps at beginning', () => {
    // from index 3 (Option 4), moving -1 should skip index 2 (disabled) and land on index 1 (Option 2)
    expect(moveIndex(optionsWithDisabledFirst, 3, -1)).toBe(1);
    // from index 1, moving -1 has index 0 disabled, clamps at 1 (no wrap)
    expect(moveIndex(optionsWithDisabledFirst, 1, -1)).toBe(1);
  });

  it('4. homeIndex returns first enabled option when first option is disabled', () => {
    expect(homeIndex(optionsWithDisabledFirst)).toBe(1);
  });

  it('5. endIndex returns last enabled option with disabled end option', () => {
    expect(endIndex(optionsWithDisabledFirst)).toBe(3);
  });

  it('6. pageIndex jumps 10 steps down and clamps at last enabled option', () => {
    const list: SelectOption[] = Array.from({ length: 25 }, (_, i) => ({
      value: String(i),
      label: `Item ${i}`,
      disabled: i === 10 || i === 24, // 24 disabled
    }));
    // From 0, jump down 10: 10 is disabled, so lands on 11
    expect(pageIndex(list, 0, 'down')).toBe(11);
    // From 15, jump down 10: clamps at last enabled (23)
    expect(pageIndex(list, 15, 'down')).toBe(23);
  });

  it('7. pageIndex jumps 10 steps up and clamps at first enabled option', () => {
    const list: SelectOption[] = Array.from({ length: 25 }, (_, i) => ({
      value: String(i),
      label: `Item ${i}`,
      disabled: i === 0, // 0 disabled
    }));
    // From 20, jump up 10
    expect(pageIndex(list, 20, 'up')).toBe(10);
    // From 5, jump up 10: clamps at first enabled (1)
    expect(pageIndex(list, 5, 'up')).toBe(1);
  });

  it('8. typeahead matches single letter prefix', () => {
    const fruits: SelectOption[] = [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
      { value: 'cherry', label: 'Cherry' },
    ];
    // From -1, 'b' -> index 1
    expect(typeahead(fruits, -1, 'b')).toBe(1);
    // From 0, 'c' -> index 2
    expect(typeahead(fruits, 0, 'c')).toBe(2);
  });

  it('9. typeahead repeatedly typing same letter cycles through options', () => {
    const items: SelectOption[] = [
      { value: 'b1', label: 'Blueberry' },
      { value: 'b2', label: 'Banana' },
      { value: 'b3', label: 'Blackberry' },
    ];
    // From 0 (Blueberry), typing 'b' cycles to index 1 (Banana)
    const next1 = typeahead(items, 0, 'b');
    expect(next1).toBe(1);
    // From 1, typing 'b' cycles to index 2 (Blackberry)
    const next2 = typeahead(items, 1, 'b');
    expect(next2).toBe(2);
    // From 2, typing 'b' wraps around to index 0 (Blueberry)
    const next3 = typeahead(items, 2, 'b');
    expect(next3).toBe(0);
    // Repeated buffer like 'bb' behaves as cycling
    expect(typeahead(items, 0, 'bb')).toBe(1);
  });

  it('10. typeahead matches multi-letter prefix case-insensitively', () => {
    const options: SelectOption[] = [
      { value: 'cat', label: 'Cat' },
      { value: 'carrot', label: 'Carrot' },
      { value: 'dog', label: 'Dog' },
    ];
    expect(typeahead(options, 0, 'car')).toBe(1);
    expect(typeahead(options, -1, 'DOG')).toBe(2);
  });

  it('11. typeahead returns -1 when no option matches', () => {
    const options: SelectOption[] = [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
    ];
    expect(typeahead(options, 0, 'z')).toBe(-1);
    expect(typeahead(options, 0, 'xyz')).toBe(-1);
  });

  it('12. typeahead skips disabled options with matching prefix', () => {
    const options: SelectOption[] = [
      { value: '1', label: 'Available for Tasks', disabled: true },
      { value: '2', label: 'Always Busy' },
      { value: '3', label: 'Active Developer' },
    ];
    // Index 0 starts with 'A' but is disabled, should skip to index 1
    expect(typeahead(options, -1, 'a')).toBe(1);
  });

  it('13. placement places bottom by default when room below is ample', () => {
    const res = placement({
      triggerRect: { top: 100, bottom: 140 },
      viewportHeight: 800,
      listHeight: 200,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    expect(res.side).toBe('bottom');
    expect(res.maxHeight).toBe(280);
  });

  it('14. placement flips to top when room below is insufficient and room above is larger', () => {
    const res = placement({
      triggerRect: { top: 600, bottom: 640 },
      viewportHeight: 700,
      listHeight: 250,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow = 700 - 640 - 6 = 54px (< 250px needed)
    // roomAbove = 600 - 6 = 594px (> 54px)
    expect(res.side).toBe('top');
    expect(res.maxHeight).toBe(280);
  });

  it('15. placement limits maxHeight to available room minus margin', () => {
    const res = placement({
      triggerRect: { top: 500, bottom: 540 },
      viewportHeight: 650,
      listHeight: 300,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow = 650 - 540 - 6 = 104px
    // roomAbove = 500 - 6 = 494px
    // flips to top: roomAbove - margin = 494 - 12 = 482 (limited to 280)
    expect(res.side).toBe('top');
    expect(res.maxHeight).toBe(280);

    // If placed bottom with tight viewport:
    const tightBottom = placement({
      triggerRect: { top: 50, bottom: 90 },
      viewportHeight: 250,
      listHeight: 200,
      gap: 6,
      margin: 12,
      maxHeight: 280,
    });
    // roomBelow = 250 - 90 - 6 = 154px
    // roomAbove = 50 - 6 = 44px
    // Stays bottom because roomBelow (154) > roomAbove (44)
    // maxHeight = roomBelow - margin = 154 - 12 = 142px
    expect(tightBottom.side).toBe('bottom');
    expect(tightBottom.maxHeight).toBe(142);
  });

  it('16. placement stays bottom when room above equals room below', () => {
    // Symmetrical trigger in middle
    const res = placement({
      triggerRect: { top: 380, bottom: 420 },
      viewportHeight: 800,
      listHeight: 500, // larger than available space on either side (374px)
      gap: 6,
      margin: 12,
      maxHeight: 500,
    });
    // roomBelow = 800 - 420 - 6 = 374
    // roomAbove = 380 - 6 = 374
    // roomAbove is NOT > roomBelow, stays bottom
    expect(res.side).toBe('bottom');
    expect(res.maxHeight).toBe(374 - 12); // 362
  });
});
