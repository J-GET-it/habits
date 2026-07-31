import React, { useMemo } from 'react';
import './QuarterlyHeatmap.css';

/**
 * QuarterlyHeatmap — квартальный трекер привычки в виде цветных микроквадратиков.
 * Дни сгруппированы в двухнедельные (14-дневные) блоки, как на бумаге из тетради.
 *
 * Props:
 *  - days: [{ date: 'YYYY-MM-DD', is_done: bool, is_restored: bool }]
 *  - startDate: 'YYYY-MM-DD' — первый день квартала
 *  - habitStartDate: 'YYYY-MM-DD' | null — дата создания привычки (до неё квадратики серые)
 *  - todayStr: 'YYYY-MM-DD' — сегодняшняя дата
 *  - language: 'ru' | 'en'
 */
const QuarterlyHeatmap = ({ days, startDate, habitStartDate, todayStr, language = 'ru' }) => {
  // Разбиваем дни на двухнедельные блоки (по 14 дней)
  const blocks = useMemo(() => {
    if (!days || days.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < days.length; i += 14) {
      chunks.push(days.slice(i, i + 14));
    }
    return chunks;
  }, [days]);

  if (!days || days.length === 0) return null;

  const getSquareClass = (day) => {
    const isFuture = day.date > todayStr;
    const isBeforeCreation = habitStartDate && day.date < habitStartDate;

    if (isBeforeCreation) return 'heatmap-sq heatmap-sq--before';
    if (isFuture) return 'heatmap-sq heatmap-sq--future';
    if (day.is_done && !day.is_restored) return 'heatmap-sq heatmap-sq--done';
    if (day.is_restored) return 'heatmap-sq heatmap-sq--restored';
    if (day.date === todayStr) return 'heatmap-sq heatmap-sq--today';
    return 'heatmap-sq heatmap-sq--missed';
  };

  // Форматируем метку блока: «1–14 апр», «15–28 апр» и т.д.
  const getBlockLabel = (block) => {
    if (!block.length) return '';
    const first = block[0].date;
    const last = block[block.length - 1].date;
    const [fy, fm, fd] = first.split('-').map(Number);
    const [ly, lm, ld] = last.split('-').map(Number);
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    const firstDate = new Date(Date.UTC(fy, fm - 1, fd));
    const lastDate = new Date(Date.UTC(ly, lm - 1, ld));
    const monthName = firstDate.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '');
    if (fm === lm) {
      return `${fd}–${ld} ${monthName}`;
    }
    const lastMonthName = lastDate.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '');
    return `${fd} ${monthName} – ${ld} ${lastMonthName}`;
  };

  return (
    <div className="quarterly-heatmap" role="img" aria-label="Квартальный трекер">
      <div className="heatmap-blocks">
        {blocks.map((block, bi) => (
          <div key={bi} className="heatmap-block">
            <div className="heatmap-block-label">{getBlockLabel(block)}</div>
            <div className="heatmap-squares">
              {block.map((day) => (
                <div
                  key={day.date}
                  className={getSquareClass(day)}
                  title={day.date}
                  aria-label={`${day.date}: ${day.is_done && !day.is_restored ? 'выполнено' : day.is_restored ? 'восполнено' : 'не выполнено'}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuarterlyHeatmap;
