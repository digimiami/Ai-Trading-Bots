export type LessonType = 'video' | 'guide' | 'quiz';

export interface AcademyLesson {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  type: LessonType;
  content_md: string | null;
  media_url: string | null;
  order_index: number;
}

export interface AcademyModule {
  id: string;
  title: string;
  slug: string;
  audience?: string | null;
  summary?: string | null;
  media_url?: string | null;
  duration_minutes?: number | null;
  order_index: number;
  lessons: AcademyLesson[];
}

export interface ModuleProgress {
  completedLessons: number;
  totalLessons: number;
  status: 'not_started' | 'in_progress' | 'completed';
  lastCompletedAt?: string | null;
}

export interface AcademySummary {
  moduleMap: Record<string, ModuleProgress>;
  completedModules: number;
  totalModules: number;
  unlockedBadge: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizPayload {
  questions: QuizQuestion[];
}

