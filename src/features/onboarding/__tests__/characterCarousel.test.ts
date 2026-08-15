import { carouselIndexFromOffset, carouselIndexFromWheel } from '../characterCarousel';

describe('character carousel snapping', () => {
  it('reaches and centers all eight character indexes', () => {
    expect(
      Array.from({ length: 8 }, (_, index) => carouselIndexFromOffset(index * 320, 320, 8)),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('maps vertical mouse wheel and horizontal trackpad gestures one character at a time', () => {
    expect(carouselIndexFromWheel(3, 0, 40, 8)).toBe(4);
    expect(carouselIndexFromWheel(3, 0, -40, 8)).toBe(2);
    expect(carouselIndexFromWheel(3, 40, 0, 8)).toBe(4);
    expect(carouselIndexFromWheel(3, -40, 0, 8)).toBe(2);
    expect(carouselIndexFromWheel(3, 2, 3, 8)).toBe(3);
  });

  it('snaps fast partial movement to the nearest character and clamps edges', () => {
    expect(carouselIndexFromOffset(320 * 3.6, 320, 8)).toBe(4);
    expect(carouselIndexFromOffset(-800, 320, 8)).toBe(0);
    expect(carouselIndexFromOffset(9000, 320, 8)).toBe(7);
  });
});
