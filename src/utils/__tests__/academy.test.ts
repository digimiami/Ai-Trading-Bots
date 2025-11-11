import { describe, expect, it } from 'vitest';
import {
  calculateProgressPercentage,
  computeModuleStatus,
  hasCompletedFoundation,
  parseQuizPayload,
  sortLessons,
  sortModules,
} from '../../utils/academy';

describe('academy utils', () => {
  it('sortModules orders by index', () => {
    const modules = sortModules([
      { id: '2', title: '', slug: '', order_index: 2, lessons: [] },
      { id: '1', title: '', slug: '', order_index: 1, lessons: [] },
    ] as any);
    expect(modules[0].id).toBe('1');
  });

  it('sortLessons orders by index', () => {
    const lessons = sortLessons([
      { id: 'b', module_id: '1', title: '', slug: '', type: 'guide', content_md: null, media_url: null, order_index: 5 },
      { id: 'a', module_id: '1', title: '', slug: '', type: 'guide', content_md: null, media_url: null, order_index: 1 },
    ]);
    expect(lessons[0].id).toBe('a');
  });

  it('computeModuleStatus derives status', () => {
    const completed = computeModuleStatus({ completedLessons: 3, totalLessons: 3, status: 'completed' });
    expect(completed.status).toBe('completed');
    const inProgress = computeModuleStatus({ completedLessons: 1, totalLessons: 3, status: 'in_progress' });
    expect(inProgress.status).toBe('in_progress');
    const notStarted = computeModuleStatus({ completedLessons: 0, totalLessons: 3, status: 'not_started' });
    expect(notStarted.status).toBe('not_started');
  });

  it('calculateProgressPercentage returns capped percent', () => {
    expect(calculateProgressPercentage({ completedLessons: 1, totalLessons: 4, status: 'in_progress' })).toBe(25);
    expect(calculateProgressPercentage({ completedLessons: 5, totalLessons: 4, status: 'completed' })).toBe(100);
  });

  it('parseQuizPayload returns null for invalid payloads', () => {
    expect(parseQuizPayload(null)).toBeNull();
    expect(parseQuizPayload('invalid')).toBeNull();
    expect(parseQuizPayload(JSON.stringify({ questions: [] }))).toHaveProperty('questions');
  });

  it('hasCompletedFoundation returns badge status', () => {
    expect(hasCompletedFoundation(2)).toBe(false);
    expect(hasCompletedFoundation(3)).toBe(true);
  });
});

