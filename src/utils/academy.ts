import type { AcademyLesson, AcademyModule, ModuleProgress, QuizPayload } from '../types/academy';

export const sortModules = (modules: AcademyModule[]): AcademyModule[] =>
  [...modules].sort((a, b) => a.order_index - b.order_index);

export const sortLessons = (lessons: AcademyLesson[]): AcademyLesson[] =>
  [...lessons].sort((a, b) => a.order_index - b.order_index);

export const computeModuleStatus = (progress?: ModuleProgress): ModuleProgress => {
  if (!progress) {
    return {
      completedLessons: 0,
      totalLessons: 0,
      status: 'not_started',
    };
  }

  if (progress.totalLessons === 0) {
    return { ...progress, status: 'not_started' };
  }

  if (progress.completedLessons >= progress.totalLessons) {
    return { ...progress, status: 'completed' };
  }

  if (progress.completedLessons > 0) {
    return { ...progress, status: 'in_progress' };
  }

  return { ...progress, status: 'not_started' };
};

export const parseQuizPayload = (content?: string | null): QuizPayload | null => {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as QuizPayload;
    if (!Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const calculateProgressPercentage = (progress: ModuleProgress): number => {
  if (!progress.totalLessons || progress.totalLessons === 0) return 0;
  return Math.min(100, Math.round((progress.completedLessons / progress.totalLessons) * 100));
};

export const hasCompletedFoundation = (completedModules: number): boolean => completedModules >= 3;

