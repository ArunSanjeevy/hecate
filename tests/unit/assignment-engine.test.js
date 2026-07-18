'use strict';

const { buildHashInput, getBucket, assignVariant } = require('../../lib/helpers/assignment-engine');

describe('Assignment engine', () => {
  const experiment = {
    key: 'landing_page_tagline',
    status: 'active',
    variants: [
      { key: 'control', allocation: 50 },
      { key: 'treatment', allocation: 50 }
    ]
  };

  it('builds hash input with explicit separators', () => {
    expect(buildHashInput('ab', 'c')).toBe('ab:c');
    expect(buildHashInput('a', 'bc')).toBe('a:bc');
  });

  it('returns a stable bucket in the expected range', () => {
    const bucket = getBucket(buildHashInput('exp', 'visitor_123'));
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(10000);
    expect(bucket).toBe(getBucket(buildHashInput('exp', 'visitor_123')));
  });

  it('assigns the same visitor stickily', () => {
    const firstAssignment = assignVariant('visitor_123', experiment);
    const secondAssignment = assignVariant('visitor_123', experiment);

    expect(secondAssignment).toBe(firstAssignment);
  });

  it('approximately distributes a 50/50 split over a larger sample', () => {
    const counts = { control: 0, treatment: 0 };

    for (let i = 0; i < 1000; i++) {
      const assignment = assignVariant(`visitor_${i}`, experiment);
      counts[assignment] += 1;
    }

    expect(counts.control).toBeGreaterThan(430);
    expect(counts.control).toBeLessThan(570);
    expect(counts.treatment).toBeGreaterThan(430);
    expect(counts.treatment).toBeLessThan(570);
  });
});
