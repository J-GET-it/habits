import React, { useMemo, useRef, useEffect } from 'react';
import './QuarterlyHeatmap.css';

/**
 * QuarterlyHeatmap — квартальный трекер привычки в виде цветных микроквадратиков.
 * Дни сгруппированы по месяцам квартала (по 2 блока на каждый месяц: 1–14 и 15–конец месяца),
 * чтобы месяцы (например, август) отображались чётко и понятно.
 *
 * Props:
 *  - days: [{ date: 'YYYY-MM-DD', is_done: bool, is_restored: bool }]
 *  - startDate: 'YYYY-MM-DD' — первый день квартала
 *  - habitStartDate: 'YYYY-MM-DD' | null — дата создания привычки (до неё квадратики серые)
 *  - todayStr: 'YYYY-MM-DD' — сегодняшняя дата
 *  - activeDate: 'YYYY-MM-DD' — выбранная дата (для центрирования нужного месяца/блока)
 *  - language: 'ru' | 'en'
 */
const QuarterlyHeatmap = ({ days, startDate, habitStartDate, todayStr, activeDate, language = 'ru' }) => {
  const containerRef = useRef(null);
  const activeBlockRef = useRef(null);

  const targetDate = activeDate || todayStr;

  // Разбиваем дни по календарным месяцам, а каждый месяц — на 2 блока (1–14 и 15–конец)
  const blocks = useMemo(() => {
    if (!days || days.length === 0) return [];

    // Группируем дни по месяцам (YYYY-MM)
    const monthMap = new Map();
    days.forEach(day => {
      const ym = day.date.slice(0, 7);
      if (!monthMap.has(ym)) {
        monthMap.set(ym, []);
      }
      monthMap.get(ym).push(day);
    });

    const resultBlocks = [];

    monthMap.forEach((mDays) => {
      // Блок 1: дни 1–14 месяца
      const firstHalf = mDays.filter(d => {
        const dayNum = parseInt(d.date.slice(8, 10), 10);
        return dayNum <= 14;
      });
      // Блок 2: дни 15 и далее до конца месяца
      const secondHalf = mDays.filter(d => {
        const dayNum = parseInt(d.date.slice(8, 10), 10);
        return dayNum > 14;
      });

      if (firstHalf.length > 0) {
        resultBlocks.push(firstHalf);
      }
      if (secondHalf.length > 0) {
        resultBlocks.push(secondHalf);
      }
    });

    return resultBlocks;
  }, [days]);

  // Автоматическая прокрутка к блоку, содержащему целевую дату (например, август)
  useEffect(() => {
    if (activeBlockRef.current) {
      activeBlockRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    }
  }, [blocks, targetDate]);

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

  // Форматируем метку блока: «1–14 авг», «15–31 авг» и т.д.
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
    <div className="quarterly-heatmap" role="img" aria-label="Квартальный трекер" ref={containerRef}>
      <div className="heatmap-blocks">
        {blocks.map((block, bi) => {
          const containsTarget = block.some(d => d.date === targetDate);
          return (
            <div
              key={bi}
              className={`heatmap-block ${containsTarget ? 'heatmap-block--active' : ''}`}
              ref={containsTarget ? activeBlockRef : null}
            >
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
          );
        })}
      </div>
    </div>
  );
};

export default QuarterlyHeatmap;
