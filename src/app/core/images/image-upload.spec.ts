import { scaleDimensions } from './image-upload';

const MB = 1024 * 1024;

describe('scaleDimensions', () => {
  it('keeps dimensions for images under the limit', () => {
    expect(scaleDimensions(800, 600, 2 * MB)).toEqual({ width: 800, height: 600 });
  });

  it('shrinks pixel count proportionally to the byte overshoot', () => {
    // 4x over the limit -> sqrt(1/4) = half the dimensions.
    const result = scaleDimensions(2000, 1000, 40 * MB, 10 * MB);
    expect(result).toEqual({ width: 1000, height: 500 });
  });

  it('caps the longest edge at 2560', () => {
    const result = scaleDimensions(10000, 5000, 11 * MB, 10 * MB);
    expect(result.width).toBe(2560);
    expect(result.height).toBe(1280);
  });

  it('preserves aspect ratio', () => {
    const result = scaleDimensions(3000, 2000, 90 * MB, 10 * MB);
    expect(result.width / result.height).toBeCloseTo(1.5, 1);
  });

  it('never returns dimensions below 1', () => {
    expect(scaleDimensions(2, 2, 1000 * MB, 10 * MB).width).toBeGreaterThanOrEqual(1);
  });
});
