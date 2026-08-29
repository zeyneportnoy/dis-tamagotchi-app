import { slotDisplayStatus } from '../tasks';

// Slot hours are fixed: morning 04:00–11:59, evening 18:00–23:59.
// slotDisplayStatus only decides which label to show; it never touches reward logic.

const at = (hour: number, minute = 0): Date => new Date(2026, 7, 27, hour, minute, 0);

describe('slotDisplayStatus', () => {
  it('shows the morning slot as still waiting before it closes at noon', () => {
    expect(slotDisplayStatus('morning', { done: false, statusDate: '2026-08-27' }, at(8))).toBe(
      'waiting',
    );
    expect(slotDisplayStatus('morning', { done: false, statusDate: '2026-08-27' }, at(11, 59))).toBe(
      'waiting',
    );
  });

  it('shows the morning slot as missed once the clock passes noon', () => {
    expect(slotDisplayStatus('morning', { done: false, statusDate: '2026-08-27' }, at(12))).toBe(
      'missed',
    );
    expect(slotDisplayStatus('morning', { done: false, statusDate: '2026-08-27' }, at(13))).toBe(
      'missed',
    );
  });

  it('keeps the evening slot waiting all afternoon and evening on its own day', () => {
    expect(slotDisplayStatus('evening', { done: false, statusDate: '2026-08-27' }, at(13))).toBe(
      'waiting',
    );
    expect(slotDisplayStatus('evening', { done: false, statusDate: '2026-08-27' }, at(19))).toBe(
      'waiting',
    );
    expect(slotDisplayStatus('evening', { done: false, statusDate: '2026-08-27' }, at(23, 30))).toBe(
      'waiting',
    );
  });

  it('marks any unfinished slot from an earlier day as missed', () => {
    expect(slotDisplayStatus('morning', { done: false, statusDate: '2026-08-26' }, at(8))).toBe(
      'missed',
    );
    expect(slotDisplayStatus('evening', { done: false, statusDate: '2026-08-26' }, at(20))).toBe(
      'missed',
    );
  });

  it('always reports a completed slot as done regardless of the hour', () => {
    expect(slotDisplayStatus('morning', { done: true, statusDate: '2026-08-27' }, at(13))).toBe(
      'done',
    );
    expect(slotDisplayStatus('evening', { done: true, statusDate: '2026-08-26' }, at(2))).toBe(
      'done',
    );
  });

  it('does not assume a missed day when no statusDate is supplied', () => {
    expect(slotDisplayStatus('morning', { done: false }, at(8))).toBe('waiting');
    expect(slotDisplayStatus('evening', { done: false }, at(20))).toBe('waiting');
  });
});
