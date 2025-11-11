import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Navigation from '../../components/feature/Navigation';
import Header from '../../components/feature/Header';
import { useAcademy, isModuleCompleted } from '../../hooks/useAcademy';
import { useAuth } from '../../hooks/useAuth';

export default function AcademyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules, summary, lessonProgress, loading, error } = useAcademy();

  const modulesWithProgress = useMemo(
    () =>
      modules.map((module) => {
        const total = module.lessons.length || 1;
        const completedLessons = module.lessons.filter((lesson) =>
          lessonProgress.find((p) => p.lesson_id === lesson.id && p.status === 'completed')
        ).length;
        const percent = Math.round((completedLessons / total) * 100);
        const completed = isModuleCompleted(module, lessonProgress);
        return { module, completedLessons, total, percent, completed };
      }),
    [modules, lessonProgress]
  );

  const modulesCompleted = summary?.modules_completed ?? 0;
  const modulesAvailable = summary?.modules_available ?? modules.length;
  const badgeEarned = summary?.badge_foundation_finisher ?? false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <Header
        title="Pablo Academy"
        subtitle="Master automation fundamentals with curated learning paths."
        rightAction={
          <Button variant="secondary" size="sm" onClick={() => navigate(summary?.badge_foundation_finisher ? '/dashboard' : '/academy/orientation-setup')}>
            {modulesCompleted > 0 ? 'Continue Learning' : 'Start Orientation'}
          </Button>
        }
      />

      <main className="px-4 pt-24 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-6">
            {error && (
              <Card className="border border-red-200 bg-red-50 p-5 text-red-700">
                <p>We couldn&apos;t load Academy modules right now. Please try again shortly.</p>
              </Card>
            )}

            {loading && !modules.length ? (
              <Card className="p-6 text-center text-gray-500 dark:text-gray-300">
                <p>Loading Pablo Academy...</p>
              </Card>
            ) : (
              modulesWithProgress.map(({ module, completed, percent, completedLessons, total }) => (
                <Card
                  key={module.id}
                  className="group overflow-hidden border border-gray-200/70 bg-white/90 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900/90"
                >
                  <div className="flex flex-col gap-4 p-6 md:flex-row md:gap-6">
                    <div className="flex w-full flex-col gap-3 md:w-[220px]">
                      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
                        {module.media_url ? (
                          <video src={module.media_url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <div className="flex h-full items-center justify-center text-gray-400">
                            <i className="ri-play-circle-line text-3xl" />
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.3em] text-blue-600 dark:bg-blue-900/30 dark:text-blue-200/90">
                        Module {module.order_index ?? modules.indexOf(module) + 1}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{module.title}</h2>
                          {completed && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                              <i className="ri-checkbox-circle-fill mr-1" />
                              Completed
                            </span>
                          )}
                        </div>
                        {module.summary && <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">{module.summary}</p>}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-400 dark:text-gray-400">
                        {module.audience && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                            <i className="ri-user-star-line text-base" />
                            {module.audience}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                          <i className="ri-time-line text-base" />
                          {module.duration_minutes || 0} minutes
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                          <i className="ri-play-list-2-line text-base" />
                          {total} lessons
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
                          <span>{completedLessons} of {total} lessons</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => navigate(`/academy/${module.slug}`)} size="sm">
                          {completed ? 'Review Module' : modulesCompleted > 0 ? 'Continue Module' : 'Start Module'}
                        </Button>
                        {!completed && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/academy/${module.slug}`)}
                            className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            View Lessons
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <aside className="w-full max-w-xs space-y-6 lg:w-80">
            <Card className="space-y-4 border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm dark:border-blue-900/40 dark:from-gray-900 dark:to-blue-950/40">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Your Progress</h3>
              <div className="text-3xl font-semibold text-blue-600 dark:text-blue-300">
                {loading ? '--' : modulesCompleted}
                <span className="text-base font-medium text-gray-500 dark:text-gray-300">
                  {' '}
                  / {modulesAvailable || modules.length} modules
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Track your progress as you unlock Pablo’s capabilities. Complete the first three modules to earn your foundation badge.
              </p>
              <Button onClick={() => navigate('/academy/orientation-setup')} size="sm">
                {modulesCompleted > 0 ? 'Resume Learning' : 'Start Now'}
              </Button>
            </Card>

            {badgeEarned && (
              <Card className="space-y-3 border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-200">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-200">
                    <i className="ri-award-fill text-xl" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Foundation Finisher</p>
                    <p className="text-xs opacity-80">You completed the orientation trilogy. Keep going!</p>
                  </div>
                </div>
              </Card>
            )}

            {!user && (
              <Card className="space-y-3 border border-gray-200 bg-white p-5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                <p>
                  Create a Pablo account to save progress, unlock badges, and sync Academy outcomes to your automation workspace.
                </p>
                <Button variant="secondary" onClick={() => navigate('/auth')} size="sm">
                  Sign In
                </Button>
              </Card>
            )}
          </aside>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
