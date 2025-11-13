import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Navigation from '../../components/feature/Navigation';
import Header from '../../components/feature/Header';
import { useAcademy, getLessonStatus, LessonProgress } from '../../hooks/useAcademy';
import { parseQuizPayload } from '../../utils/academy';
import type { QuizPayload } from '../../types/academy';

interface QuizQuestion {
  id: string;
  prompt: string;
  options: { label: string; value: string }[];
  correct: string;
}

// Convert database quiz format to component format
function convertQuizToQuestions(quizPayload: QuizPayload | null): QuizQuestion[] {
  if (!quizPayload || !Array.isArray(quizPayload.questions)) {
    return [];
  }

  return quizPayload.questions.map((q, index) => {
    const optionValues = ['a', 'b', 'c', 'd', 'e', 'f'];
    return {
      id: `q${index + 1}`,
      prompt: q.question,
      options: q.options.map((opt, optIndex) => ({
        label: opt,
        value: optionValues[optIndex] || String(optIndex),
      })),
      correct: optionValues[q.correctIndex] || String(q.correctIndex),
    };
  });
}

const lessonTypeIcon: Record<string, string> = {
  video: 'ri-play-circle-fill',
  guide: 'ri-file-text-line',
  quiz: 'ri-question-answer-fill',
};

const answerKey = (lessonId: string, questionId: string) => `${lessonId}:${questionId}`;

export default function AcademyModulePage() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const navigate = useNavigate();
  const { modules, lessonProgress, loading, error, recordProgress, refresh } = useAcademy();

  const module = useMemo(() => modules.find((item) => item.slug === moduleSlug) ?? null, [modules, moduleSlug]);

  const [activeLessonId, setActiveLessonId] = useState<string | null>(() => module?.lessons?.[0]?.id ?? null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizMeta, setQuizMeta] = useState<Record<string, { score: number; submitted: boolean }>>({});

  useEffect(() => {
    if (!module) return;
    if (!activeLessonId || !module.lessons.some((lesson) => lesson.id === activeLessonId)) {
      setActiveLessonId(module.lessons[0]?.id ?? null);
    }
  }, [module, activeLessonId]);

  const activeLesson = useMemo(
    () => module?.lessons.find((lesson) => lesson.id === activeLessonId) ?? null,
    [module, activeLessonId]
  );

  useEffect(() => {
    if (!module || !activeLesson) return;
    const status = getLessonStatus(lessonProgress, module.id, activeLesson.id);
    if (status === 'not_started') {
      void recordProgress(module.slug, activeLesson.slug, 'in_progress');
    }
  }, [module, activeLesson, lessonProgress, recordProgress]);

  const completedLessons = useMemo(() => {
    if (!module) return 0;
    return module.lessons.filter((lesson) =>
      lessonProgress.some(
        (entry) => entry.module_id === module.id && entry.lesson_id === lesson.id && entry.status === 'completed'
      )
    ).length;
  }, [module, lessonProgress]);

  const totalLessons = module?.lessons.length ?? 0;
  const completionPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const lessonStatus = activeLesson && module ? getLessonStatus(lessonProgress, module.id, activeLesson.id) : 'not_started';
  const activeQuizMeta = activeLesson ? quizMeta[activeLesson.id] : undefined;

  const handleLessonAction = async (status: LessonProgress['status']) => {
    if (!module || !activeLesson) return;
    await recordProgress(module.slug, activeLesson.slug, status);
  };

  const handleModuleComplete = async () => {
    if (!module) return;
    try {
      await recordProgress(module.slug, null, 'completed');
      // Refresh progress to update UI
      await refresh();
    } catch (error) {
      console.error('Failed to mark module as complete:', error);
    }
  };

  const handleQuizAnswerChange = (questionId: string, value: string) => {
    if (!activeLesson || activeQuizMeta?.submitted) return;
    setQuizAnswers((prev) => ({
      ...prev,
      [answerKey(activeLesson.id, questionId)]: value,
    }));
  };

  const handleQuizSubmit = async () => {
    if (!module || !activeLesson || activeQuizMeta?.submitted) return;
    const quizPayload = parseQuizPayload(activeLesson.content_md);
    const quizQuestions = convertQuizToQuestions(quizPayload);
    
    if (quizQuestions.length === 0) return;
    
    const correctCount = quizQuestions.reduce(
      (acc, question) =>
        quizAnswers[answerKey(activeLesson.id, question.id)] === question.correct ? acc + 1 : acc,
      0
    );
    const score = Math.round((correctCount / quizQuestions.length) * 100);
    setQuizMeta((prev) => ({
      ...prev,
      [activeLesson.id]: { score, submitted: true },
    }));
    await recordProgress(module.slug, activeLesson.slug, 'completed', score);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
        <span className="text-sm">Loading module...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          <h2 className="text-lg font-semibold">Academy module unavailable</h2>
          <p className="mt-2 text-sm">{error}</p>
          <Button className="mt-4" onClick={() => navigate('/academy')}>
            Back to Academy
          </Button>
        </Card>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md border border-gray-200 bg-white p-6 text-center text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <h2 className="text-lg font-semibold">Module not found</h2>
          <p className="mt-2 text-sm">The module you&apos;re looking for is unavailable.</p>
          <Button className="mt-4" onClick={() => navigate('/academy')}>
            Back to Academy
          </Button>
        </Card>
      </div>
    );
  }

  const renderLessonContent = () => {
    if (!activeLesson) return null;

    if (activeLesson.type === 'quiz') {
      const submitted = activeQuizMeta?.submitted ?? false;
      const score = activeQuizMeta?.score ?? null;
      const quizPayload = parseQuizPayload(activeLesson.content_md);
      const quizQuestions = convertQuizToQuestions(quizPayload);

      if (quizQuestions.length === 0) {
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Quiz content is not available. Please check back later.
            </p>
          </div>
        );
      }

  return (
    <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Quick knowledge check. Select the best answer for each prompt to lock in your score.
          </p>
          {quizQuestions.map((question) => {
            const selected = quizAnswers[answerKey(activeLesson.id, question.id)] ?? '';
            return (
              <div
                key={question.id}
                className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <p className="font-medium text-gray-800 dark:text-gray-100">{question.prompt}</p>
                <div className="space-y-2 text-sm">
                  {question.options.map((option) => {
                    const isChecked = selected === option.value;
                    const isCorrect = submitted && option.value === question.correct;
                    const isIncorrect = submitted && isChecked && option.value !== question.correct;
              return (
                <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition ${
                          isCorrect
                            ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                            : isIncorrect
                            ? 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-200'
                            : isChecked
                            ? 'border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-200'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50/70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <input
                    type="radio"
                          name={answerKey(activeLesson.id, question.id)}
                          value={option.value}
                          checked={isChecked}
                          disabled={submitted}
                          onChange={() => handleQuizAnswerChange(question.id, option.value)}
                          className="h-4 w-4"
                        />
                        <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={handleQuizSubmit} disabled={submitted}>
              {submitted ? 'Quiz Submitted' : 'Submit Quiz'}
        </Button>
            {submitted && score !== null && (
              <span className="text-sm font-semibold text-emerald-500">
                Score saved: {score}%
          </span>
        )}
      </div>
    </div>
  );
    }

    if (activeLesson.type === 'guide' && activeLesson.content_md) {
      const sections = activeLesson.content_md.split(/\n{2,}/);
    return (
        <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          {sections.map((paragraph, idx) => (
            <p key={idx} className="whitespace-pre-wrap">
              {paragraph.trim()}
            </p>
          ))}
      </div>
    );
  }

    if (activeLesson.type === 'video' && activeLesson.media_url) {
    return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
          <video src={activeLesson.media_url} controls className="w-full bg-black" />
      </div>
    );
  }

    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Lesson content coming soon. Check back shortly or mark the lesson once you&apos;ve reviewed external material.
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Header
        title={module.title}
        subtitle="Deepen your mastery with immersive lessons, walkthroughs, and quick knowledge checks."
        rightAction={
          <Button variant="secondary" size="sm" onClick={() => navigate('/academy')}>
            Back to Academy
          </Button>
        }
      />

      <main className="px-4 pt-24 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
          <aside className="w-full max-w-sm space-y-4 lg:w-72">
            <Card className="space-y-3 border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 dark:border-blue-900/40 dark:from-gray-900 dark:to-blue-950/40">
              <div className="text-xs uppercase tracking-[0.3em] text-blue-400">Module Progress</div>
              <div className="text-3xl font-semibold text-blue-600 dark:text-blue-300">{completionPercent}%</div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {completedLessons} of {totalLessons} lessons completed.
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <Button variant="secondary" size="sm" onClick={handleModuleComplete}>
                Mark Module Complete
                  </Button>
            </Card>

            <Card className="space-y-3 border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <p>
                Lessons automatically mark as in progress when opened. Use the controls below each lesson to record completion or retake the quiz at any time.
              </p>
          </Card>

            <div className="space-y-3">
              {module.lessons.map((lesson) => {
                const status = getLessonStatus(lessonProgress, module.id, lesson.id);
                const isActive = lesson.id === activeLesson?.id;
  return (
                <button
                  key={lesson.id}
                    onClick={() => setActiveLessonId(lesson.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-100'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em]">
                      <span className="flex items-center gap-2">
                        <i className={`${lessonTypeIcon[lesson.type]} text-lg`} />
                        {lesson.title}
                      </span>
                      <span
                        className={`flex items-center gap-1 ${
                          status === 'completed'
                            ? 'text-emerald-500'
                            : status === 'in_progress'
                            ? 'text-blue-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {status === 'completed' && <i className="ri-checkbox-circle-fill" />}
                        {status === 'in_progress' && <i className="ri-time-line" />}
                        {status === 'not_started' && <i className="ri-circle-line" />}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 capitalize">{lesson.type}</p>
                  </button>
                );
              })}
                  </div>
          </aside>

          <section className="flex-1 space-y-6">
            {activeLesson ? (
              <Card className="space-y-6 border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
                    <i className={`${lessonTypeIcon[activeLesson.type]} text-lg`} />
                    {activeLesson.type}
                  </div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{activeLesson.title}</h1>
                </div>

                {renderLessonContent()}

                {activeLesson.type !== 'quiz' && (
                  <div className="flex flex-wrap gap-3">
                    <Button size="sm" variant="secondary" onClick={() => handleLessonAction('in_progress')}>
                      Mark In Progress
                    </Button>
                    <Button size="sm" onClick={() => handleLessonAction('completed')}>
                      Mark Completed
                    </Button>
                  </div>
                )}

                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Status: {lessonStatus.replace('_', ' ')}</span>
                  <Button variant="ghost" size="sm" onClick={handleModuleComplete}>
                    Complete Module
                      </Button>
                </div>
              </Card>
            ) : (
              <Card className="border border-gray-200 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                <p>Select a lesson to get started.</p>
              </Card>
            )}
          </section>
        </div>
      </main>

      <Navigation />
    </div>
  );
}


