interface ProgressBarProps {
  completedExercises: number;
  totalExercises: number;
  completedSessions: number;
  totalSessions: number;
}

export function calculateWeeklyExerciseProgress(
  completedExercises: number,
  totalExercises: number,
  completedSessions: number,
  totalSessions: number
): number {
  if (totalExercises > 0) {
    return Math.min(100, Math.max(0, Math.round((completedExercises / totalExercises) * 100)));
  }
  if (totalSessions > 0) {
    return Math.min(100, Math.max(0, Math.round((completedSessions / totalSessions) * 100)));
  }
  return 0;
}

export function ProgressBar({
  completedExercises,
  totalExercises,
  completedSessions,
  totalSessions,
}: ProgressBarProps) {
  const percentage = calculateWeeklyExerciseProgress(
    completedExercises,
    totalExercises,
    completedSessions,
    totalSessions
  );

  let disciplineStatus = 'Sẵn sàng khởi động tuần mới';
  if (percentage === 100) {
    disciplineStatus = 'Hoàn thành xuất sắc mục tiêu Tuần 1';
  } else if (percentage >= 60) {
    disciplineStatus = 'Giữ vững nhịp kỷ luật rất tốt';
  } else if (percentage > 0) {
    disciplineStatus = 'Đang duy trì đà tập luyện';
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800">
            Tiến độ bài tập trong tuần
          </p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{disciplineStatus}</p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-lg font-mono-num font-bold text-teal-700">
            {percentage}%
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Tỷ lệ hoàn thành bài tập trong tuần"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden"
      >
        <div
          className={`h-full w-full origin-left rounded-full transition-transform duration-200 ease-out ${
            percentage === 100 ? 'bg-emerald-600' : 'bg-teal-700'
          }`}
          style={{ transform: `scaleX(${percentage / 100})` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="font-mono-num font-medium text-slate-700">
          {completedExercises}/{totalExercises} bài tập
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-num">
          {completedSessions}/{totalSessions} buổi tập chính
        </span>
      </div>
    </div>
  );
}
