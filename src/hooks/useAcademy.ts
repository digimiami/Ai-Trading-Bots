import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type LessonType = 'video' | 'guide' | 'quiz';

export interface ModuleLesson {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  type: LessonType;
  content_md: string | null;
  media_url: string | null;
  order_index: number;
}

export interface CourseModule {
  id: string;
  title: string;
  slug: string;
  audience: string | null;
  summary: string | null;
  media_url: string | null;
  duration_minutes: number | null;
  order_index: number;
  lessons: ModuleLesson[];
}

export interface LessonProgress {
  id: string;
  lesson_id: string | null;
  module_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completed_at: string | null;
  quiz_score?: number | null;
}

export interface AcademySummary {
  user_id: string;
  modules_completed: number;
  modules_available: number;
  lessons_completed: number;
  badge_foundation_finisher: boolean;
  current_status: string | null;
}

interface AcademyState {
  modules: CourseModule[];
  loading: boolean;
  error: string | null;
  lessonProgress: LessonProgress[];
  summary: AcademySummary | null;
  refresh: () => Promise<void>;
  recordProgress: (moduleSlug: string, lessonSlug: string | null, status: LessonProgress['status'], quizScore?: number | null) => Promise<void>;
}

const emptyState: AcademyState = {
  modules: [],
  loading: false,
  error: null,
  lessonProgress: [],
  summary: null,
  refresh: async () => {},
  recordProgress: async () => {},
};

export function useAcademy(): AcademyState {
  const { user } = useAuth();
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([]);
  const [summary, setSummary] = useState<AcademySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = async () => {
    const { data, error } = await supabase
      .from('course_modules')
      .select(
        `
          id,
          title,
          slug,
          audience,
          summary,
          media_url,
          duration_minutes,
          order_index,
          module_lessons (
            id,
            module_id,
            title,
            slug,
            type,
            content_md,
            media_url,
            order_index
          )
        `
      )
      .order('order_index', { ascending: true });

    if (error) throw error;

    const formatted: CourseModule[] =
      (data || []).map((module) => ({
        ...module,
        lessons: (module.module_lessons || []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
      })) ?? [];

    setModules(formatted);
  };

  const fetchProgress = async () => {
    if (!user) {
      setLessonProgress([]);
      setSummary(null);
      return;
    }

    const [progressRes, summaryRes] = await Promise.all([
      supabase
        .from('user_course_progress')
        .select('id, module_id, lesson_id, status, completed_at, quiz_score')
        .eq('user_id', user.id),
      supabase
        .from('user_academy_summary')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (progressRes.error) throw progressRes.error;
    if (summaryRes.error && summaryRes.error.code !== 'PGRST116') throw summaryRes.error;

    setLessonProgress(progressRes.data || []);
    setSummary(summaryRes.data || null);
  };

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchModules(), fetchProgress()]);
    } catch (err: any) {
      console.error('Failed to load academy data', err);
      setError(err?.message || 'Failed to load academy content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const recordProgress = async (
    moduleSlug: string,
    lessonSlug: string | null,
    status: LessonProgress['status'],
    quizScore?: number | null
  ) => {
    await supabase.rpc('record_lesson_progress', {
      p_module_slug: moduleSlug,
      p_lesson_slug: lessonSlug,
      p_status: status,
      p_quiz_score: quizScore ?? null,
    });
    await fetchProgress();
  };

  return useMemo(
    () => ({
      modules,
      lessonProgress,
      summary,
      loading,
      error,
      refresh,
      recordProgress,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modules, lessonProgress, summary, loading, error]
  );
}

export function getLessonStatus(
  progress: LessonProgress[],
  moduleId: string,
  lessonId?: string | null
): LessonProgress['status'] {
  if (!progress.length) return 'not_started';
  const match = progress.find((entry) => entry.module_id === moduleId && (lessonId ? entry.lesson_id === lessonId : entry.lesson_id === null));
  return match?.status ?? 'not_started';
}

export function isModuleCompleted(module: CourseModule, progress: LessonProgress[]): boolean {
  if (!module.lessons.length) return false;
  return module.lessons.every((lesson) => {
    const entry = progress.find((p) => p.lesson_id === lesson.id);
    return entry?.status === 'completed';
  });
}
