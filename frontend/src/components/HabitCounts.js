import React from 'react';

export default function HabitCounts({ weeklyCount, weeklyAward, habit, isLastQuantityLess1, currentWeekDate }) {
  const daysInCurrentMonth = (() => {
    if (!currentWeekDate) return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const [year, month, day] = currentWeekDate.split('-').map(Number);
    const sunday = new Date(Date.UTC(year, month - 1, day));
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return new Date(sunday.getUTCFullYear(), sunday.getUTCMonth() + 1, 0).getDate();
  })();

  const completionTargetVal = habit.completion_target === 0 ? daysInCurrentMonth : (habit.completion_target || 0);

  const isCompletionTargetMet = habit.use_target && completionTargetVal > 0 && (habit.monthly_total >= completionTargetVal);
  const isQuantityTargetMet = habit.use_target && habit.quantity_target > 0 && (habit.monthly_overflow >= habit.quantity_target);

  const completionPercent = completionTargetVal ? Math.min(100, ((habit.monthly_total || 0) / completionTargetVal) * 100) : 0;
  const quantityPercent = habit.quantity_target ? Math.min(100, ((habit.monthly_overflow || 0) / habit.quantity_target) * 100) : 0;

  const displayCompletion = `${habit.monthly_total || 0}:${completionTargetVal}${isCompletionTargetMet ? '🎯' : ''}`;
  const displayQuantity = `${habit.monthly_overflow || 0}:${habit.quantity_target || 0}${isQuantityTargetMet ? '🎯' : ''}`;

  return (
    <div className="habit-counts-wrapper" aria-label={`Счетчики для привычки ${habit.name}`}>
      <div className="habit-count-container">
        <div className="habit-count-row">
          <div 
            className={`habit-count weekly ${weeklyCount >= 3 ? 'active' : ''} ${weeklyCount === 3 ? 'has-single-lightning' : ''} ${weeklyCount === 4 ? 'has-double-lightning' : ''} ${weeklyCount === 5 ? 'has-single-star' : ''} ${weeklyCount === 6 ? 'has-double-star' : ''}`}
            role="status"
            aria-label={`Выполнено на этой неделе: ${weeklyCount}`}
          >
            {((weeklyCount === 4 && weeklyAward.includes('⚡')) || (weeklyCount === 6 && weeklyAward.includes('⭐'))) && (
              <span className="award-side award-left" aria-hidden="true">{weeklyCount === 4 ? '⚡' : '⭐'}</span>
            )}

            <span className={`habit-count-number ${weeklyAward ? 'with-awards' : ''}`}>
              {weeklyCount}
            </span>
            {weeklyAward && weeklyAward !== '👑' && (
              <span className="award-side award-right" aria-hidden="true">
                {weeklyCount === 4 ? '⚡' : weeklyCount === 6 ? '⭐' : weeklyAward}
              </span>
            )}
            {weeklyAward === '👑' && (
              <span className="crown-right" aria-hidden="true">👑</span>
            )}
          </div>
          {habit.use_target ? (
            <div 
              className="habit-count monthly progress-bar green" 
              style={{ '--progress-percent': `${completionPercent}%` }}
              role="progressbar"
              aria-valuenow={habit.monthly_total || 0}
              aria-valuemin="0"
              aria-valuemax={completionTargetVal}
              aria-label={`Прогресс выполнения за месяц: ${displayCompletion}`}
            >
              <span className="progress-text-under">{displayCompletion}</span>
              <div className="progress-fill" style={{ width: `${completionPercent}%` }}>
                <span className="progress-text-over">{displayCompletion}</span>
              </div>
            </div>
          ) : (
            <div 
              className="habit-count monthly"
              role="status"
              aria-label={`Выполнено за месяц: ${habit.monthly_total || 0}`}
            >
              {habit.monthly_total || 0}
            </div>
          )}
        </div>
        {(!isLastQuantityLess1 || habit.use_target) && (
          <div className="habit-count-row">
            <div 
              className="habit-count-overflow weekly"
              role="status"
              aria-label={`Перевыполнение за неделю: ${habit.weekly_overflow || 0}`}
            >
              {habit.weekly_overflow || 0}
            </div>
            {habit.use_target && habit.quantity_target > 0 ? (
              <div 
                className="habit-count-overflow monthly progress-bar purple" 
                style={{ '--progress-percent': `${quantityPercent}%` }}
                role="progressbar"
                aria-valuenow={habit.monthly_overflow || 0}
                aria-valuemin="0"
                aria-valuemax={habit.quantity_target || 0}
                aria-label={`Прогресс количества за месяц: ${displayQuantity}`}
              >
                <span className="progress-text-under">{displayQuantity}</span>
                <div className="progress-fill" style={{ width: `${quantityPercent}%` }}>
                  <span className="progress-text-over">{displayQuantity}</span>
                </div>
              </div>
            ) : (
              <div 
                className="habit-count-overflow monthly"
                role="status"
                aria-label={`Перевыполнение за месяц: ${habit.monthly_overflow || 0}`}
              >
                {habit.monthly_overflow || 0}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
