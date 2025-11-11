import { describe, expect, it } from 'vitest';
import { getLessonStatus, isModuleCompleted } from '../useAcademy';

const mockModule = {
  id: 'module-1',
  title: 'Test Module',
  slug: 'test-module',
  audience: null,
  summary: null,
  media_url: null,
  duration_minutes: 10,
  order_index: 1,
  lessons: [
    { id: 'lesson-1', module_id: 'module-1', title: 'Lesson 1', slug: 'lesson-1', type: 'guide', content_md: null, media_url: null, order_index: 1 },
    { id: 'lesson-2', module_id: 'module-1', title: 'Lesson 2', slug: 'lesson-2', type: 'guide', content_md: null, media_url: null, order_index: 2 },
  ],
};

describe('useAcademy helpers', () => {
  it('getLessonStatus returns not_started by default', () => {
    expect(getLessonStatus([], 'module-1', 'lesson-1')).toBe('not_started');
  });

  it('getLessonStatus returns existing progress state', () => {
    const progress = [{ id: 'p1', user_id: 'user', module_id: 'module-1', lesson_id: 'lesson-1', status: 'completed', completed_at: null, quiz_score: null }];
    expect(getLessonStatus(progress as any, 'module-1', 'lesson-1')).toBe('completed');
  });

  it('isModuleCompleted requires every lesson to be completed', () => {
    const incompleteProgress = [{ module_id: 'module-1', lesson_id: 'lesson-1', status: 'completed' }];
    expect(isModuleCompleted(mockModule as any, incompleteProgress as any)).toBe(false);

    const completeProgress = [
      { module_id: 'module-1', lesson_id: 'lesson-1', status: 'completed' },
      { module_id: 'module-1', lesson_id: 'lesson-2', status: 'completed' },
    ];
    expect(isModuleCompleted(mockModule as any, completeProgress as any)).toBe(true);
  });
});

