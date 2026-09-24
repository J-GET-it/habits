import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Rectangle } from 'recharts';
import './Charts.css';
import './Analytics.css';
import storageService from '../storageService';

const getWeekNumber = (dateInput) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const generatePeriodLabel = (period, referenceDate, t, language) => {
    const today = new Date(referenceDate);
    const months = ['janFull', 'febFull', 'marFull', 'aprFull', 'mayFull', 'junFull', 'julFull', 'augFull', 'sepFull', 'octFull', 'novFull', 'decFull'];
    const daysFull = {
        ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
        en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    };

    if (period === 'day') {
        const dayNum = today.getDate();
        const monthKey = months[today.getMonth()];
        const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const shortDay = t(dayKeys[today.getDay()]).toLowerCase();
        const monthName = t(monthKey);
        return { title: `${shortDay}, ${dayNum} ${monthName}`, subtitle: `${today.getFullYear()}` };
    } else if (period === 'week') {
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const monday = new Date(today);
        monday.setDate(diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${day}.${month}`;
        };

        const weekNum = getWeekNumber(today);
        const monthKey = months[today.getMonth()];
        const monthName = t(monthKey);
        const year = today.getFullYear();
        return { 
            title: (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.2' }}>
                    <span>{language === 'ru' ? 'Неделя' : t('week')} №{weekNum}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '0.9em', fontWeight: 'normal' }}>{formatDate(monday)} - {formatDate(sunday)}</span>
                        <span style={{ fontSize: '0.8em', opacity: 0.7, fontWeight: 'normal' }}>{monthName} {year}</span>
                    </span>
                </span>
            ), 
            subtitle: null 
        };
    } else if (period === 'month') {
        const monthKey = months[today.getMonth()];
        const monthName = t(monthKey);
        return { title: `${monthName} ${today.getFullYear()}`, subtitle: '' };
    } else if (period === 'year') {
        return { title: `${today.getFullYear()}`, subtitle: '' };
    }
    return { title: '', subtitle: '' };
};

const getNumericDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
};

const CustomXAxisTick = ({ x, y, payload, period, isMobile, isDark, chartData, t, language }) => {
    if (!payload || payload.value === undefined || payload.value === null) return null;

    // Use payload.index if available (represents the actual 0-based array index in Recharts)
    const dataIndex = payload.index !== undefined ? payload.index : payload.value;
    const dataItem = chartData[dataIndex];
    
    if (!dataItem || dataItem.isDummy) return null;

    let displayValue = '';
    if (period === 'day') {
        displayValue = dataItem.dayNumber;
    } else {
        displayValue = dataItem.label;
    }
    
    if (isMobile && displayValue.length > 6) {
        displayValue = `${displayValue.slice(0, 6)}..`;
    }

    const fontSize = period === 'year' ? (isMobile ? 8 : 9) : (isMobile ? 8 : 10);
    const weekNumFontSize = isMobile ? 7 : 9;
    
    const isToday = dataItem?.isToday;
    const isCurrentWeek = dataItem?.isCurrentWeek;
    const isCurrentMonth = dataItem?.isCurrentMonth;
    const isCurrentYear = dataItem?.isCurrentYear;
    const isHighlighted = isToday || isCurrentWeek || isCurrentMonth || isCurrentYear;
    const fontWeight = isHighlighted ? 700 : (period === 'week' ? 600 : 500);
    const fill = isHighlighted ? '#22c55e' : (isDark ? "#E0E0E0" : "#666");

    const weekNumber = dataItem?.weekNumber;
    const showWeekNum = period === 'week' && weekNumber != null;
    const weekFill = isHighlighted ? '#22c55e' : (isDark ? '#aaa' : '#999');

    // Получаем месяц для отображения третьей строки
    let monthName = '';
    if (period === 'week' && dataItem.date) {
        const parsedDate = new Date(dataItem.date);
        const months = ['janFull', 'febFull', 'marFull', 'aprFull', 'mayFull', 'junFull', 'julFull', 'augFull', 'sepFull', 'octFull', 'novFull', 'decFull'];
        const monthKey = months[parsedDate.getMonth()];
        monthName = t ? t(monthKey) : '';
        if (language === 'ru' && monthName) {
            monthName = monthName.toLowerCase();
        }
    }
    const showMonthName = period === 'week' && monthName;

    // Геометрия подложки
    // Первая строка: dy=16, вторая: dy=30, третья: dy=42
    const padding = 5;
    const line1CenterY = 16;
    const line2CenterY = 30;
    const line3CenterY = 42;

    const rectTop = line1CenterY - fontSize - padding;
    const rectBottom = showMonthName
        ? line3CenterY + weekNumFontSize * 0.6 + padding
        : (showWeekNum
            ? line2CenterY + weekNumFontSize * 0.6 + padding
            : line1CenterY + fontSize * 0.6 + padding);
    const rectHeight = rectBottom - rectTop;

    // Ширина — по самой широкой строке
    const line1Width = displayValue.length * fontSize * 0.65 + padding * 2;
    const weekNumText = language === 'ru' ? `нед ${weekNumber}` : `wk ${weekNumber}`;
    const line2Width = showWeekNum ? weekNumText.length * weekNumFontSize * 0.65 + padding * 2 : 0;
    const line3Width = showMonthName ? monthName.length * weekNumFontSize * 0.65 + padding * 2 : 0;
    const rectWidth = Math.max(line1Width, line2Width, line3Width, 28);

    return (
        <g transform={`translate(${x},${y})`}>
            {isHighlighted && (
                <rect
                    x={-rectWidth / 2}
                    y={rectTop}
                    width={rectWidth}
                    height={rectHeight}
                    fill="#22c55e"
                    rx={5}
                    opacity={0.2}
                />
            )}
            <text x={0} y={0} dy={16} textAnchor="middle" fill={fill} fontSize={fontSize} fontWeight={fontWeight}>
                {displayValue}
            </text>
            {showWeekNum && (
                <text x={0} y={0} dy={30} textAnchor="middle" fill={weekFill} fontSize={weekNumFontSize} fontWeight={isHighlighted ? 700 : 500}>
                    {language === 'ru' ? `нед ${weekNumber}` : `wk ${weekNumber}`}
                </text>
            )}
            {showMonthName && (
                <text x={0} y={0} dy={42} textAnchor="middle" fill={weekFill} fontSize={weekNumFontSize} fontWeight={isHighlighted ? 700 : 500}>
                    {monthName}
                </text>
            )}
        </g>
    );
};


const CustomBarLabel = ({ x, y, width, height, value, color, baseSize = 14, suffix = '' }) => {
    if (!value || value <= 0) return null;

    // For horizontal bars, width is the bar length, height is the bar thickness
    const fontSize = width < 25 ? Math.max(8, baseSize - 4) : baseSize;

    return (
        <text
            x={x + width / 2}
            y={y + height / 2}
            fill={color}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight={800}
            style={{ pointerEvents: 'none' }}
        >
            {value}{suffix}
        </text>
    );
};

const CustomBarShape = (props) => {
    const { payload, dataKey, radius } = props;

    const keys = ['countCapped', 'countRestored'];
    const currentIndex = keys.indexOf(dataKey);

    let isTop = true;
    if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < keys.length; i++) {
            if (payload[keys[i]] > 0) {
                isTop = false;
                break;
            }
        }
    }

    const finalRadius = isTop ? radius : [0, 0, 0, 0];
    return <Rectangle {...props} radius={finalRadius} />;
};

const PercentageBadge = ({ x, y, width, height, value, badgeW, badgeH, fSize, period }) => {
    if (!value || (value === '0%' && period !== 'day')) return null;
    const fs = fSize || 16;
    // For horizontal bars, place to the right of the bar
    const cx = x + width + 15;
    const cy = y + height / 2;
    return (
        <text
            x={cx}
            y={cy}
            fill="#22c55e"
            textAnchor="start"
            dominantBaseline="middle"
            fontSize={fs}
            fontWeight={800}
            style={{ pointerEvents: 'none' }}
        >
            {value}
        </text>
    );
};

const PercentageBadgeVertical = ({ x, y, width, height, value, badgeW, badgeH, fSize, period, color }) => {
    if (!value || value === '0/0') return null;
    const fs = fSize || 16;
    const cx = x + width / 2;
    // place fraction label slightly above bar top
    const cy = y - 12;
    return (
        <text
            x={cx}
            y={cy}
            fill={color || "#22c55e"}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fs}
            fontWeight={800}
            style={{ pointerEvents: 'none' }}
        >
            {value}
        </text>
    );
};

const HabitsComparisonChart = ({ period, viewType, currentWeekDate, selectedCategory, selectedHabitId, theme, t, language, chartData: mainChartData, storageMode }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);
    const indicatorRef = useRef(null);
    const isMobile = window.innerWidth <= 480;
    const isDark = theme === 'dark';

    const periodLabel = useMemo(() => {
        if (!currentWeekDate) return { title: '', subtitle: '' };
        const date = new Date(currentWeekDate);
        return generatePeriodLabel(period, date, t, language);
    }, [currentWeekDate, period, language, t]);

    useEffect(() => {
        const fetchHabitComparison = async () => {
            if (!currentWeekDate) return;
            setLoading(true);
            try {
                const apiDate = new Date(currentWeekDate);
                const dateStr = apiDate.toISOString().split('T')[0];
                
                const result = await storageService.getComparison(storageMode, {
                    period,
                    date: dateStr,
                    category: selectedCategory || 'Все',
                    habit_id: selectedHabitId
                }, {
                    headers: { 'Accept-Language': language },
                    credentials: 'include'
                });
                
                const mappedData = (result.habits || result.data || []).map(item => ({
                    ...item,
                    streakDays: item.streak_days || 0,
                    streakPercentage: item.streak_percentage || 0,
                    countExtra: item.extra_quantity || item.count_extra || 0,
                    count_capped: item.completed_days || 0,
                    shortName: item.name.length > 12 ? item.name.substring(0, 10) + '..' : item.name,
                    total_days: item.total_days || 0,
                    award_count: item.award_count || 0
                }));
                setData(mappedData);
            } catch (error) {
                console.error('Error fetching comparison data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHabitComparison();
    }, [period, currentWeekDate, selectedCategory, selectedHabitId, language, storageMode]);

    const filteredData = useMemo(() => data, [data]);
    const chartHeight = useMemo(() => Math.max(200, filteredData.length * 45), [filteredData.length]);



    const handleScroll = (e) => {
        if (indicatorRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = e.target;
            const scrollPercent = (scrollLeft / (scrollWidth - clientWidth)) * 100;
            indicatorRef.current.style.left = `${scrollPercent}%`;
        }
    };

    const maxValue = filteredData.reduce((m, d) => Math.max(m, d.count_capped || 0, d.countExtra || 0), 0);
    const effectiveMax = useMemo(() => Math.max(1, maxValue), [maxValue]);

    const CustomStreakLabel = (props) => {
        const { x, y, width, value, index, isQuantity } = props;
        const item = filteredData[index];
        if (!item || !value || value <= 0) return null;
        const labelText = value > 0 ? `${value}${isQuantity ? '' : ` ${t('daysShort') || 'д.'}`}` : '';
        if (!labelText) return null;
        return (
            <text x={x + width + 5} y={y + 16} fill={isDark ? "#E0E0E0" : "#666"} fontSize={11} fontWeight="600">
                {labelText}
            </text>
        );
    };

    if (loading) return <div className="comparison-chart-loading"><div className="mini-spinner"></div><p>{t('loadingStats')}</p></div>;

    if (data.length === 0) return (
        <div className="habits-comparison-section">
            <div className="comparison-header"><h3>{t('habitProgress')}</h3></div>
            <div className="comparison-footer"><div className="comparison-footer-label">{periodLabel.title}</div></div>
            <div className="comparison-no-data"><p>📊 {t('noData')}</p></div>
        </div>
    );

    // Форматирует дату старта для отображения
    const formatStartDate = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
    };

    return (
        <div className="habits-comparison-section">
            <div className="comparison-header"><h3>{t('habitProgress')}</h3></div>
            <div className="comparison-footer"><div className="comparison-footer-label">{periodLabel.title}</div></div>
            <div className="comparison-chart-layout horizontal">
                <div className="comparison-scroll-wrapper" onScroll={handleScroll} ref={scrollRef}>
                    <div className="comparison-chart-inner">
                        <ResponsiveContainer width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
                            <BarChart layout="vertical" data={filteredData} margin={{ top: 5, right: 100, left: 10, bottom: 5 }} barSize={isMobile ? 22 : 26}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                                <XAxis type="number" hide domain={[0, effectiveMax]} />
                                <YAxis dataKey="name" type="category" width={isMobile ? 90 : 130} tick={{ fill: isDark ? "#E0E0E0" : "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Bar dataKey="count_capped" fill="#059669" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                                    <LabelList dataKey="count_capped" content={(props) => <CustomStreakLabel {...props} isQuantity={false} />} />
                                </Bar>
                                <Bar dataKey="countExtra" fill="#8B5CF6" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                                    <LabelList dataKey="countExtra" content={(props) => <CustomStreakLabel {...props} isQuantity={true} />} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            {filteredData.length > 5 && (
                <div className="scroll-indicator-container">
                    <div className="scroll-indicator-bar" ref={indicatorRef}></div>
                </div>
            )}

            {/* ── Статистика за всё время по каждой привычке ── */}
            <div className="habit-alltime-stats-list">
                {filteredData.map((habit) => {
                    const startDateFmt = formatStartDate(habit.start_date);
                    const daysDone = habit.alltime_days_done ?? 0;
                    const daysTotal = habit.alltime_days_total ?? 0;
                    const lightning = habit.alltime_lightning ?? 0;
                    const doubleLightning = habit.alltime_double_lightning ?? 0;
                    const star = habit.alltime_star ?? 0;
                    const doubleStar = habit.alltime_double_star ?? 0;
                    const crown = habit.alltime_crown ?? 0;
                    const hasAwards = lightning > 0 || doubleLightning > 0 || star > 0 || doubleStar > 0 || crown > 0;

                    // Цель: масштабируем completion_target по числу месяцев с начала
                    const hasGoal = habit.use_target && habit.completion_target > 0 && daysTotal > 0;
                    const monthsTotal = daysTotal > 0 ? Math.max(1, Math.round(daysTotal / 30)) : 1;
                    const goalTotal = hasGoal ? habit.completion_target * monthsTotal : 0;

                    return (
                        <div key={habit.id} className={`habit-alltime-row${isDark ? ' dark' : ''}`}>
                            <div className="habit-alltime-name">{habit.name}</div>
                            <div className="habit-alltime-badges">
                                {startDateFmt && (
                                    <div className="hat-badge hat-badge--start">
                                        <span className="hat-badge-label">Дата старта</span>
                                        <span className="hat-badge-value">{startDateFmt}</span>
                                    </div>
                                )}
                                {daysTotal > 0 && (
                                    <div className="hat-badge hat-badge--days">
                                        <span className="hat-badge-value">{daysDone}/{daysTotal}</span>
                                    </div>
                                )}
                                {hasAwards && (
                                    <div className="hat-badge hat-badge--awards">
                                        {lightning > 0 && <span className="hat-award">⚡<span className="hat-award-count">×{lightning}</span></span>}
                                        {doubleLightning > 0 && <span className="hat-award">⚡⚡<span className="hat-award-count">×{doubleLightning}</span></span>}
                                        {star > 0 && <span className="hat-award">⭐<span className="hat-award-count">×{star}</span></span>}
                                        {doubleStar > 0 && <span className="hat-award">⭐⭐<span className="hat-award-count">×{doubleStar}</span></span>}
                                        {crown > 0 && <span className="hat-award">👑<span className="hat-award-count">×{crown}</span></span>}
                                    </div>
                                )}
                                {hasGoal && (
                                    <div className="hat-badge hat-badge--goal">
                                        <span className="hat-badge-label">Цель</span>
                                        <span className="hat-badge-value">{daysDone}/{goalTotal}{daysDone >= goalTotal ? '🎯' : ''}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const getScaledTarget = (habit, type, period, dateStr) => {
    const isUseTarget = habit.use_target;
    if (!isUseTarget) return 0;

    const dateObj = new Date(dateStr);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let rawTarget = type === 'quantity' ? habit.quantity_target : habit.completion_target;
    if (type === 'completion' && rawTarget === 0) {
        rawTarget = daysInMonth;
    }

    if (!rawTarget) return 0;

    if (period === 'day') {
        if (type === 'completion') return 1;
        return Math.max(1, Math.round(rawTarget / daysInMonth));
    }
    if (period === 'week') {
        const scaled = Math.round((rawTarget * 7) / daysInMonth);
        if (type === 'completion') {
            return Math.min(7, Math.max(1, scaled));
        }
        return Math.max(1, scaled);
    }
    if (period === 'month') {
        return rawTarget;
    }
    if (period === 'year') {
        return rawTarget * 12;
    }
    return rawTarget;
};

const getDaysInPeriod = (period, dateStr) => {
    if (period === 'day') return 1;
    if (period === 'week') return 7;
    if (period === 'month') {
        const dateObj = new Date(dateStr);
        return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
    }
    if (period === 'year') {
        const dateObj = new Date(dateStr);
        const year = dateObj.getFullYear();
        return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
    }
    return 7;
};

const CategoryComparisonTable = ({ period, currentWeekDate, theme, t, language, storageMode, sortedCategories }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const isDark = theme === 'dark' || (theme === 'auto' && document.body.classList.contains('dark-theme'));

    const fetchAllData = useCallback(async () => {
        if (period === 'week') {
            const habitMap = new Map();
            // currentWeekDate — это понедельник; endDate = воскресенье (Monday + 6)
            const startDate = new Date(currentWeekDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);

            const promises = [];
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                // Используем локальную дату, чтобы избежать UTC-сдвига
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dayStr = `${y}-${m}-${day}`;
                promises.push(
                    storageService.getComparison(storageMode, {
                        period: 'day',
                        date: dayStr,
                        category: 'Все'
                    }, { credentials: 'include' })
                );
            }

            try {
                const results = await Promise.all(promises);
                results.forEach(result => {
                    if (result.habits) {
                        result.habits.forEach(item => {
                            if (!habitMap.has(item.id)) {
                                habitMap.set(item.id, {
                                    ...item,
                                    countCapped: 0,
                                    countRestored: 0,
                                    countExtra: 0
                                });
                            }
                            const habit = habitMap.get(item.id);
                            habit.countCapped += (item.completed_days || 0);
                            habit.countRestored += (item.restored_days || 0);
                            habit.countExtra += (item.extra_quantity || 0);
                        });
                    }
                });
                setData(Array.from(habitMap.values()));
            } catch (error) {
                console.error('Error fetching category comparison data:', error);
            } finally {
                setLoading(false);
            }
            return;
        }

        const apiDate = new Date(currentWeekDate);
        if (period === 'month') apiDate.setDate(1);
        else if (period === 'year') apiDate.setMonth(0, 1);
        // Используем локальную дату, чтобы избежать смещения UTC (timezone bug)
        const year = apiDate.getFullYear();
        const month = String(apiDate.getMonth() + 1).padStart(2, '0');
        const day = String(apiDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        try {
            const result = await storageService.getComparison(storageMode, {
                period,
                date: dateStr,
                category: 'Все'
            }, { credentials: 'include' });
            setData(result.habits.map(h => ({
                ...h,
                countCapped: h.completed_days,
                countRestored: h.restored_days,
                countExtra: h.extra_quantity
            })));
        } catch (error) {
            console.error('Error fetching category comparison data:', error);
        } finally {
            setLoading(false);
        }
    }, [period, currentWeekDate, storageMode]);

    // Initial load + real-time polling every 30 seconds
    useEffect(() => {
        setLoading(true);
        fetchAllData();
        const interval = setInterval(fetchAllData, 30000);
        return () => clearInterval(interval);
    }, [fetchAllData]);

    const categoryStats = useMemo(() => {
        const stats = {};
        data.forEach(item => {
            const cat = item.category_name || t('noCategory');
            if (!stats[cat]) {
                stats[cat] = { name: cat, total: 0, extra: 0, habits: 0, targetTotal: 0, targetExtra: 0 };
            }
            stats[cat].total += (item.countCapped || 0); // только тёмно-зелёные (streak)
            stats[cat].extra += (item.countExtra || 0);
            stats[cat].habits += 1;

            const daysInPeriod = getDaysInPeriod(period, currentWeekDate);
            const hTargetTotal = item.use_target && (item.completion_target !== null && item.completion_target !== undefined)
                ? getScaledTarget(item, 'completion', period, currentWeekDate)
                : daysInPeriod;
            const hTargetExtra = item.use_target && item.quantity_target
                ? getScaledTarget(item, 'quantity', period, currentWeekDate)
                : 0;

            stats[cat].targetTotal += hTargetTotal;
            stats[cat].targetExtra += hTargetExtra;
        });

        const allStats = Object.values(stats);

        // Если есть sortedCategories — используем их порядок как на странице треков
        if (sortedCategories && sortedCategories.length > 0) {
            const orderMap = {};
            sortedCategories.forEach((cat, idx) => {
                const name = cat.name === 'Все' ? null : cat.name;
                if (name) orderMap[name] = idx;
            });
            allStats.sort((a, b) => {
                const ia = orderMap[a.name] ?? 9999;
                const ib = orderMap[b.name] ?? 9999;
                return ia - ib;
            });
        } else {
            allStats.sort((a, b) => b.total - a.total);
        }

        return allStats;
    }, [data, t, sortedCategories, period, currentWeekDate]);

    // Привычки сгруппированные по категории
    const habitsByCategory = useMemo(() => {
        const map = {};
        data.forEach(item => {
            const cat = item.category_name || t('noCategory');
            if (!map[cat]) map[cat] = [];
            map[cat].push(item);
        });
        return map;
    }, [data, t]);

    const [expandedCategories, setExpandedCategories] = useState(new Set());

    const toggleCategory = (catName) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(catName)) next.delete(catName);
            else next.add(catName);
            return next;
        });
    };

    if (loading || categoryStats.length === 0) return null;

    return (
        <div className="category-comparison-section">
            <div className="comparison-header">
                <h3>{t('categoryComparison')}</h3>
            </div>
            <div className="category-table-container">
                <table className="category-comparison-table">
                    <thead>
                        <tr>
                            <th>{t('category')}</th>
                            <th>{t('totalDone')}</th>
                            <th>{t('quantity')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categoryStats.map((stat, idx) => {
                            const maxExtra = Math.max(...categoryStats.map(s => s.extra)) || 1;
                            
                            const catTargetTotal = stat.targetTotal || 1;
                            const progressWidth = Math.min(100, (stat.total / catTargetTotal) * 100);
                            const totalFraction = `${stat.total}/${catTargetTotal}`;

                            let progressWidthExtra = 0;
                            let extraFraction = '';
                            if (stat.targetExtra > 0) {
                                progressWidthExtra = Math.min(100, (stat.extra / stat.targetExtra) * 100);
                                extraFraction = `${stat.extra}/${stat.targetExtra}`;
                            } else {
                                progressWidthExtra = (stat.extra / maxExtra) * 100;
                                extraFraction = `${stat.extra}/${maxExtra}`;
                            }

                            const isExpanded = expandedCategories.has(stat.name);
                            const habits = habitsByCategory[stat.name] || [];
                            const maxHabitExtra = Math.max(...habits.map(h => h.countExtra || 0)) || 1;

                            return (
                                <React.Fragment key={idx}>
                                    <tr className="cat-row">
                                        <td className="cat-name-cell">
                                            <button
                                                className={`cat-toggle-btn ${isExpanded ? 'expanded' : ''}`}
                                                onClick={() => toggleCategory(stat.name)}
                                                aria-expanded={isExpanded}
                                                aria-label={isExpanded 
                                                    ? (language === 'ru' ? `Свернуть категорию ${stat.name}` : `Collapse category ${stat.name}`) 
                                                    : (language === 'ru' ? `Развернуть категорию ${stat.name}` : `Expand category ${stat.name}`)
                                                }
                                            >
                                                <svg
                                                    className="cat-toggle-icon"
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 12 12"
                                                    fill="none"
                                                    aria-hidden="true"
                                                    focusable="false"
                                                >
                                                    <path
                                                        d="M4 2.5L7.5 6L4 9.5"
                                                        stroke="currentColor"
                                                        strokeWidth="1.75"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                            {stat.name}
                                        </td>
                                        <td className="cat-value-cell">
                                            <div className="cat-progress-container">
                                                <span className="cat-progress-number">{stat.total}</span>
                                                <div className="cat-progress-bar-bg">
                                                    <div className="cat-progress-bar-fill" style={{ width: `${progressWidth}%` }}></div>
                                                </div>
                                                <span className="cat-progress-percent">{totalFraction}</span>
                                            </div>
                                        </td>
                                        <td className="cat-value-cell cat-value-quantity">
                                            {stat.targetExtra > 0 ? (
                                                <div className="cat-progress-container">
                                                    <span className="cat-progress-number cat-quantity-number">{stat.extra || 0}</span>
                                                    <div className="cat-progress-bar-bg cat-progress-bar-bg--purple">
                                                        <div className="cat-progress-bar-fill cat-progress-bar-fill--purple" style={{ width: `${progressWidthExtra}%` }}></div>
                                                    </div>
                                                    <span className="cat-progress-percent">{extraFraction}</span>
                                                </div>
                                            ) : (
                                                <span className="cat-quantity-zero">—</span>
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && habits.map((habit, hIdx) => {
                                        const daysInPeriod = getDaysInPeriod(period, currentWeekDate);

                                        const hTargetTotal = habit.use_target && (habit.completion_target !== null && habit.completion_target !== undefined)
                                            ? getScaledTarget(habit, 'completion', period, currentWeekDate)
                                            : daysInPeriod;
                                        const hProgressWidth = Math.min(100, ((habit.countCapped || 0) / hTargetTotal) * 100);
                                        const hTotalFraction = `${habit.countCapped || 0}/${hTargetTotal}`;

                                        const hTargetExtra = habit.use_target && habit.quantity_target
                                            ? getScaledTarget(habit, 'quantity', period, currentWeekDate)
                                            : 0;
                                        
                                        let hExtraWidth = 0;
                                        let hExtraFraction = '';
                                        if (hTargetExtra > 0) {
                                            hExtraWidth = Math.min(100, ((habit.countExtra || 0) / hTargetExtra) * 100);
                                            hExtraFraction = `${habit.countExtra || 0}/${hTargetExtra}`;
                                        } else {
                                            hExtraWidth = ((habit.countExtra || 0) / maxHabitExtra) * 100;
                                            hExtraFraction = `${habit.countExtra || 0}/${maxHabitExtra}`;
                                        }
                                        return (
                                            <tr key={`h-${hIdx}`} className="cat-habit-row">
                                                <td className="cat-habit-name-cell">↳ {habit.name}</td>
                                                <td className="cat-value-cell">
                                                    <div className="cat-progress-container">
                                                        <span className="cat-progress-number">{habit.countCapped || 0}</span>
                                                        <div className="cat-progress-bar-bg">
                                                            <div className="cat-progress-bar-fill" style={{ width: `${hProgressWidth}%` }}></div>
                                                        </div>
                                                        <span className="cat-progress-percent">{hTotalFraction}</span>
                                                    </div>
                                                </td>
                                                <td className="cat-value-cell cat-value-quantity">
                                                    {hTargetExtra > 0 ? (
                                                        <div className="cat-progress-container">
                                                            <span className="cat-progress-number cat-quantity-number">{habit.countExtra || 0}</span>
                                                            <div className="cat-progress-bar-bg cat-progress-bar-bg--purple">
                                                                <div className="cat-progress-bar-fill cat-progress-bar-fill--purple" style={{ width: `${hExtraWidth}%` }}></div>
                                                            </div>
                                                            <span className="cat-progress-percent">{hExtraFraction}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="cat-quantity-zero">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── CalendarReport ────────────────────────────────────────────────────────────

const MONTH_NAMES = {
    ru: [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ],
    en: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
};
const QUARTER_NAMES = {
    ru: ['I КВАРТАЛ', 'II КВАРТАЛ', 'III КВАРТАЛ', 'IV КВАРТАЛ'],
    en: ['I QUARTER', 'II QUARTER', 'III QUARTER', 'IV QUARTER']
};
const QUARTERS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
const DAY_HEADERS = {
    ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
};

const CalendarReport = ({ theme, t, language, storageMode, selectedCategory, selectedHabitId }) => {
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [dayData, setDayData] = useState({});
    const [loading, setLoading] = useState(true);

    const maxQuantity = useMemo(() => {
        let maxVal = 0;
        Object.values(dayData).forEach(item => {
            if (item.quantity > maxVal) {
                maxVal = item.quantity;
            }
        });
        return maxVal || 1;
    }, [dayData]);
    const [collapsedQuarters, setCollapsedQuarters] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('habbits_collapsedQuarters') || '{}');
        } catch {
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem('habbits_collapsedQuarters', JSON.stringify(collapsedQuarters));
    }, [collapsedQuarters]);

    const toggleQuarter = (qIdx) => {
        setCollapsedQuarters(prev => ({
            ...prev,
            [qIdx]: !prev[qIdx]
        }));
    };

    const isDark = theme === 'dark' || (theme === 'auto' && document.body.classList.contains('dark-theme'));
    const todayStr = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }, []);

    const monthNames = MONTH_NAMES[language] || MONTH_NAMES.ru;
    const quarterNames = QUARTER_NAMES[language] || QUARTER_NAMES.ru;
    const dayHeaders = DAY_HEADERS[language] || DAY_HEADERS.ru;

    useEffect(() => {
        const fetchCalendarData = async () => {
            setLoading(true);
            try {
                const result = await storageService.getDailyStatistics(
                    storageMode,
                    {
                        start_date: `${calYear}-01-01`,
                        end_date: `${calYear}-12-31`,
                        category: selectedCategory || 'Все',
                        habit_id: selectedHabitId
                    },
                    { credentials: 'include' }
                );
                const map = {};
                (result.data || []).forEach(item => {
                    map[item.date] = {
                        completed: item.completed_days || 0,
                        quantity: item.extra_quantity || 0,
                        habitCount: item.habit_count || 0
                    };
                });
                setDayData(map);
            } catch (e) {
                console.error('Ошибка загрузки данных календаря:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchCalendarData();
    }, [calYear, selectedCategory, selectedHabitId, storageMode]);

    const renderMonth = useCallback((monthIdx) => {
        const firstDay = new Date(calYear, monthIdx, 1).getDay();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(calYear, monthIdx + 1, 0).getDate();

        const cells = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const mm = String(monthIdx + 1).padStart(2, '0');
            const dd = String(d).padStart(2, '0');
            cells.push({ day: d, dateStr: `${calYear}-${mm}-${dd}` });
        }

        return (
            <div className="cal-month" key={monthIdx}>
                <div className="cal-month-title">{monthNames[monthIdx]}</div>
                <div className="cal-grid">
                    {dayHeaders.map(h => (
                        <div key={h} className="cal-day-header">{h}</div>
                    ))}
                    {cells.map((cell, idx) => {
                        if (!cell) {
                            return <div key={`e-${monthIdx}-${idx}`} className="cal-day cal-day-empty" />;
                        }
                        const { day, dateStr } = cell;
                        const data = dayData[dateStr];
                        const completed = data?.completed || 0;
                        const quantity = data?.quantity || 0;
                        const habitCount = data?.habitCount || 0;
                        const isFuture = dateStr > todayStr;
                        const isToday = dateStr === todayStr;
                        const isDone = completed > 0 && !isFuture;

                        const hasHabits = habitCount > 0;
                        const ratio = habitCount > 0 ? completed / habitCount : 0;
                        const quantityRatio = maxQuantity > 0 ? quantity / maxQuantity : 0;

                        return (
                            <div
                                key={dateStr}
                                className={[
                                    'cal-day',
                                    isDone ? 'done' : '',
                                    isFuture ? 'future' : '',
                                    isToday ? 'today' : '',
                                    hasHabits ? 'has-habits' : ''
                                ].filter(Boolean).join(' ')}
                                title={
                                    hasHabits
                                        ? language === 'ru'
                                            ? `${dateStr}: выполнено ${completed} из ${habitCount}${quantity > 0 ? `, кол-во: ${quantity}` : ''}`
                                            : `${dateStr}: completed ${completed} of ${habitCount}${quantity > 0 ? `, qty: ${quantity}` : ''}`
                                        : dateStr
                                }
                            >
                                <span className="cal-day-num">{day}</span>
                                {hasHabits && (
                                    <div className="cal-day-progress-bg">
                                        <div className="cal-progress-col green-col">
                                            <div
                                                className="cal-progress-fill"
                                                style={{ height: `${ratio * 100}%` }}
                                            />
                                            {completed > 0 && (
                                                <div className="cal-progress-badge">
                                                    {completed}/{habitCount}
                                                </div>
                                            )}
                                        </div>
                                        <div className="cal-progress-col purple-col">
                                            <div
                                                className="cal-progress-fill"
                                                style={{ height: `${quantityRatio * 100}%` }}
                                            />
                                            {quantity > 0 && (
                                                <div className="cal-progress-badge">
                                                    {quantity}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }, [calYear, dayData, todayStr, language, monthNames, dayHeaders, maxQuantity]);

    return (
        <div className="cal-report-container">
            <div className="cal-year-nav">
                <button
                    className="cal-nav-btn"
                    onClick={() => setCalYear(y => y - 1)}
                    aria-label={language === 'ru' ? 'Предыдущий год' : 'Previous year'}
                >←</button>
                <span className="cal-year-label">{calYear}</span>
                <button
                    className="cal-nav-btn"
                    onClick={() => setCalYear(y => y + 1)}
                    aria-label={language === 'ru' ? 'Следующий год' : 'Next year'}
                >→</button>
            </div>

            {loading ? (
                <div className="charts-loading">
                    <div className="loading-spinner" />
                    <p>{t('loading') || 'Загрузка...'}</p>
                </div>
            ) : (
                 <div className="cal-quarters">
                    {QUARTERS.map((monthIdxs, qIdx) => {
                        const isCollapsed = !!collapsedQuarters[qIdx];
                        return (
                            <div key={qIdx} className={`cal-quarter ${isCollapsed ? 'collapsed' : ''}`}>
                                <div 
                                    className="cal-quarter-title" 
                                    onClick={() => toggleQuarter(qIdx)}
                                >
                                    <span>{quarterNames[qIdx]}</span>
                                    <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
                                </div>
                                {!isCollapsed && (
                                    <div className="cal-quarter-months">
                                        {monthIdxs.map(mIdx => renderMonth(mIdx))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Charts ────────────────────────────────────────────────────────────────────

const Charts = ({ 
    getCookie, 
    habitsData, 
    handleGenerateReport, 
    handleGenerateSummaryReport, 
    isReportLoading, 
    currentWeekDate,
    sortedCategories,
    selectedCategory,
    onSelectCategory,
    theme,
    t,
    language,
    storageMode
}) => {
    const [reportView, setReportView] = useState('charts'); // 'charts' | 'calendar'
    const [period, setPeriod] = useState('day');
    const [viewType, setViewType] = useState('habits'); // 'habits' or 'quantity'
    const [chartData, setChartData] = useState([]);
    const [realDataCount, setRealDataCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [chartDate, setChartDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    });
    
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const categoryDropdownRef = useRef(null);

    const [selectedHabitId, setSelectedHabitId] = useState('all');
    const [isHabitDropdownOpen, setIsHabitDropdownOpen] = useState(false);
    const habitDropdownRef = useRef(null);

    const selectedCategoryName = useMemo(() => {
        if (selectedCategory === 'all' || selectedCategory === 'Все') return t('allCategories') || 'Все категории';
        return selectedCategory === 'Без категории' ? t('noCategory') : selectedCategory;
    }, [selectedCategory, t]);

    const selectedHabitName = useMemo(() => {
        if (selectedHabitId === 'all') return t('allHabits') || 'Все привычки';
        const habit = habitsData.find(h => h.id.toString() === selectedHabitId.toString());
        return habit ? habit.name : (t('allHabits') || 'Все привычки');
    }, [selectedHabitId, habitsData, t]);

    useEffect(() => {
        setSelectedHabitId('all');
    }, [selectedCategory]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
                setIsCategoryDropdownOpen(false);
            }
            if (habitDropdownRef.current && !habitDropdownRef.current.contains(event.target)) {
                setIsHabitDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth < 480;
    const isTablet = windowWidth < 768;
    const isDark = theme === 'dark' || (theme === 'auto' && document.body.classList.contains('dark-theme'));
    const CHART_HEIGHT = isMobile ? 400 : isTablet ? 500 : 650;
    const xAxisDataKey = 'index';
    const xAxisHeight = isMobile ? (period === 'week' ? 65 : 50) : (period === 'week' ? 72 : 40);
    const barLabelSize = isMobile ? 10 : isTablet ? 12 : 18;
    const barCategoryGap = '0%';
    const barGap = 0;
    const [periodLabel, setPeriodLabel] = useState({ title: '', subtitle: '' });
    const [slideDirection, setSlideDirection] = useState(null);
    const swipeStartRef = useRef(null);
    const swipeActiveRef = useRef(false);
    const [rangeLimits, setRangeLimits] = useState({
        day: 7,
        week: 5,
        month: 12,
        year: 5
    });
    const [columnOffset, setColumnOffset] = useState(0);
    const [columnAnim, setColumnAnim] = useState(null);   // 'expand' | 'shrink' | null
    const [barAnimActive, setBarAnimActive] = useState(false);

    const mainScrollRef = useRef(null);
    const mainIndicatorRef = useRef(null);

    // Set initial period label
    useEffect(() => {
        setPeriodLabel(generatePeriodLabel(period, currentWeekDate, t, language));
    }, []);

    const handleMainScroll = (e) => {
        if (!mainIndicatorRef.current) return;
        const { scrollLeft, scrollWidth } = e.target;
        const left = (scrollLeft / scrollWidth) * 100;
        mainIndicatorRef.current.style.left = `${left}%`;
    };

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        if (newPeriod === 'day') {
            const now = new Date();
            setChartDate(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`);
        } else {
            setChartDate(currentWeekDate);
        }
    };

    useEffect(() => {
        if (mainScrollRef.current && mainIndicatorRef.current) {
            const { scrollWidth, clientWidth } = mainScrollRef.current;
            const width = (clientWidth / scrollWidth) * 100;
            mainIndicatorRef.current.style.width = `${width}%`;
            // Reset scroll on period change
            mainScrollRef.current.scrollLeft = 0;
            mainIndicatorRef.current.style.left = '0%';
        }
    }, [chartData.length, period, columnOffset]);

    const fetchStatistics = useCallback(async () => {
        setLoading(true);
        try {
            const limit = rangeLimits[period] || 7;
            const refDate = new Date(chartDate);
            let start_date = '';
            let end_date = '';

            if (period === 'day') {
                const dayOfWeek = refDate.getDay();
                const diffToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                const sunday = new Date(refDate);
                sunday.setDate(refDate.getDate() + diffToSunday);
                const monday = new Date(sunday);
                monday.setDate(sunday.getDate() - (limit - 1));
                end_date = sunday.toISOString().split('T')[0];
                start_date = monday.toISOString().split('T')[0];
            } else if (period === 'week') {
                const dayOfWeek = refDate.getDay();
                const diffToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                const sunday = new Date(refDate);
                sunday.setDate(refDate.getDate() + diffToSunday);
                const start = new Date(sunday);
                start.setDate(sunday.getDate() - (limit * 7 - 1));
                end_date = sunday.toISOString().split('T')[0];
                start_date = start.toISOString().split('T')[0];
            } else if (period === 'month') {
                const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
                const start = new Date(end.getFullYear(), end.getMonth() - (limit - 1), 1);
                end_date = end.toISOString().split('T')[0];
                start_date = start.toISOString().split('T')[0];
            } else if (period === 'year') {
                const end = new Date(refDate.getFullYear(), 11, 31);
                const start = new Date(end.getFullYear() - (limit - 1), 0, 1);
                end_date = end.toISOString().split('T')[0];
                start_date = start.toISOString().split('T')[0];
            }

            const json = await storageService.getDailyStatistics(storageMode, {
                period,
                date: chartDate,
                start_date,
                end_date,
                category: selectedCategory || 'Все',
                habit_id: selectedHabitId
            }, {
                credentials: 'include'
            });

            setPeriodLabel(generatePeriodLabel(period, chartDate, t, language));
                const todayStr = new Date().toISOString().split('T')[0];
                const weekDayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                
                // Calculate current week range for highlighting
                const today = new Date();
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
                const currentMonday = new Date(today);
                currentMonday.setDate(diff);
                currentMonday.setHours(0, 0, 0, 0);
                const currentSunday = new Date(currentMonday);
                currentSunday.setDate(currentMonday.getDate() + 6);
                currentSunday.setHours(23, 59, 59, 999);
                const currentMondayStr = currentMonday.toLocaleDateString('en-CA');
                
                const formattedData = json.data.map((item, index) => {
                    const isFuture = item.date > todayStr;
                    const habitCount = item.habit_count || 0;
                    const maxPossible = habitCount * item.days_in_period;
                    const completed = item.completed_days || 0;

                    let percentageStr = '';
                    let completionFraction = '';
                    if (!isFuture && maxPossible > 0) {
                        const rawPercent = (completed / maxPossible) * 100;
                        const roundedPercent = Math.round(rawPercent);
                        const finalPercent = (completed > 0 && roundedPercent === 0) ? 1 : roundedPercent;
                        percentageStr = `${finalPercent}%`;
                        completionFraction = `${completed}/${maxPossible}`;
                    } else if (!isFuture && maxPossible === 0) {
                        percentageStr = '0%';
                        completionFraction = '0/0';
                    }

                    const parsedDate = new Date(item.date);
                    const weekDay = t(weekDayKeys[parsedDate.getDay()]);
                    const dayNumber = String(parsedDate.getDate());
                    
                    // Check if this is the current week
                    const isCurrentWeek = period === 'week' && item.date === currentMondayStr;
                    
                    // Check if this is the current month
                    const isCurrentMonth = period === 'month' && 
                        parsedDate.getMonth() === today.getMonth() && 
                        parsedDate.getFullYear() === today.getFullYear();
                    
                    // Check if this is the current year
                    const isCurrentYear = period === 'year' && 
                        parsedDate.getFullYear() === today.getFullYear();

                    const commonData = {
                        index: index,
                        label: item.label || item.date,
                        weekNumber: item.week_number || null,
                        date: item.date,
                        fullDate: item.date,
                        isToday: item.date === todayStr,
                        isCurrentWeek: isCurrentWeek,
                        isCurrentMonth: isCurrentMonth,
                        isCurrentYear: isCurrentYear,
                        habit_count: habitCount
                    };

                    const countCapped = item.completed_days || 0;
                    const streakCount = item.streak_count || 0;
                    const nonStreakCapped = Math.max(0, countCapped - streakCount);
                    return {
                        ...commonData,
                        dayMonth: weekDay,
                        dayNumber: dayNumber,
                        countTotal: item.completed_count,
                        countCapped: countCapped,
                        nonStreakCapped: nonStreakCapped,
                        countRestored: item.restored_days || 0,
                        countExtra: item.extra_quantity,
                        streakCount: streakCount,
                        percentage: percentageStr,
                        completionFraction: completionFraction
                    };
                });
                // Filter out leading empty periods before any habits or activity occurred
                let firstActiveIdx = -1;
                if (period === 'month' || period === 'year') {
                    const firstCompletionIdx = formattedData.findIndex(item => (
                        (item.countCapped || 0) > 0 || 
                        (item.countRestored || 0) > 0 || 
                        (item.countExtra || 0) > 0
                    ));

                    if (firstCompletionIdx !== -1) {
                        let startIdx = firstCompletionIdx;
                        // For month: allow the immediately preceding month if it had habits
                        if (period === 'month' && startIdx > 0 && (formattedData[startIdx - 1].habit_count || 0) > 0) {
                            startIdx -= 1;
                        }
                        firstActiveIdx = startIdx;
                    } else {
                        // No completion activity yet: find first period with habit_count > 0, or show the current/last period
                        const firstHabitIdx = formattedData.findIndex(item => (item.habit_count || 0) > 0);
                        firstActiveIdx = firstHabitIdx !== -1 ? firstHabitIdx : Math.max(0, formattedData.length - 1);
                    }
                } else {
                    firstActiveIdx = 0;
                }

                const filteredData = formattedData
                    .slice(firstActiveIdx)
                    .map((item, idx) => ({ ...item, index: idx }));

                setRealDataCount(filteredData.length);

                // For month and year, pad with dummy columns on the right so active bars start from the left and stay side-by-side
                let paddedData = [...filteredData];
                const minColumns = (period === 'month' || period === 'year') ? 5 : (filteredData.length === 1 ? 3 : filteredData.length);
                if (filteredData.length > 0 && filteredData.length < minColumns) {
                    while (paddedData.length < minColumns) {
                        const idx = paddedData.length;
                        paddedData.push({
                            ...filteredData[0],
                            index: idx,
                            date: `dummy-${idx}`,
                            countTotal: 0,
                            countCapped: 0,
                            nonStreakCapped: 0,
                            countRestored: 0,
                            countExtra: 0,
                            streakCount: 0,
                            label: '',
                            dayMonth: '',
                            dayNumber: '',
                            percentage: '',
                            completionFraction: '',
                            isToday: false,
                            isCurrentWeek: false,
                            isCurrentMonth: false,
                            isCurrentYear: false,
                            isDummy: true
                        });
                    }
                }
                setChartData(paddedData);
        } catch (error) {
            console.error('Error fetching statistics:', error);
        } finally {
            setLoading(false);
        }
    }, [period, chartDate, selectedCategory, selectedHabitId, t, language, storageMode, rangeLimits]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    useEffect(() => {
        // Only sync date from parent when NOT in day mode (day mode manages its own date)
        if (period !== 'day') {
            setChartDate(currentWeekDate);
        }
    }, [currentWeekDate, period]);

    const handlePrevPeriod = () => {
        setChartDate(prevDate => {
            const date = new Date(prevDate);
            if (period === 'day' || period === 'week') {
                date.setDate(date.getDate() - 7);
            } else if (period === 'month') {
                date.setMonth(date.getMonth() - 1);
            } else if (period === 'year') {
                date.setFullYear(date.getFullYear() - 1);
            }
            return date.toISOString().split('T')[0];
        });
    };

    const handleNextPeriod = () => {
        setChartDate(prevDate => {
            const date = new Date(prevDate);
            if (period === 'day' || period === 'week') {
                date.setDate(date.getDate() + 7);
            } else if (period === 'month') {
                date.setMonth(date.getMonth() + 1);
            } else if (period === 'year') {
                date.setFullYear(date.getFullYear() + 1);
            }
            return date.toISOString().split('T')[0];
        });
    };

    const goToPrev = () => {
        setSlideDirection('right');
        handlePrevPeriod();
        setTimeout(() => setSlideDirection(null), 350);
    };

    const goToNext = () => {
        setSlideDirection('left');
        handleNextPeriod();
        setTimeout(() => setSlideDirection(null), 350);
    };

    const handleSwipeTouchStart = (e) => {
        swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        swipeActiveRef.current = false;
    };

    const handleSwipeTouchMove = (e) => {
        if (!swipeStartRef.current) return;
        const dx = e.touches[0].clientX - swipeStartRef.current.x;
        const dy = e.touches[0].clientY - swipeStartRef.current.y;
        // Если движение горизонтальное и мы в начале/конце скролла — блокируем вертикальный scroll
        if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 10) {
            const scroll = mainScrollRef.current;
            const fitsInView = !scroll || scroll.scrollWidth <= scroll.clientWidth + 4;
            const atStart = !scroll || scroll.scrollLeft <= 2;
            const atEnd = !scroll || scroll.scrollLeft >= scroll.scrollWidth - scroll.clientWidth - 2;
            if (fitsInView || (dx < 0 && atEnd) || (dx > 0 && atStart)) {
                swipeActiveRef.current = true;
            }
        }
    };

    const handleSwipeTouchEnd = (e) => {
        if (!swipeStartRef.current) return;
        const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
        const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
        swipeStartRef.current = null;
        if (Math.abs(dx) < 55 || Math.abs(dy) > Math.abs(dx) * 0.75) return;
        const scroll = mainScrollRef.current;
        const fitsInView = !scroll || scroll.scrollWidth <= scroll.clientWidth + 4;
        const atStart = !scroll || scroll.scrollLeft <= 2;
        const atEnd = !scroll || scroll.scrollLeft >= scroll.scrollWidth - scroll.clientWidth - 2;
        if (dx < 0 && (atEnd || fitsInView)) goToNext();
        else if (dx > 0 && (atStart || fitsInView)) goToPrev();
    };

    // Mouse drag swipe for desktop
    const mouseStartRef = useRef(null);
    const handleMouseDown = (e) => {
        // Only main mouse button, not on buttons or interactive elements
        if (e.button !== 0 || e.target.closest('button, select, input')) return;
        mouseStartRef.current = { x: e.clientX };
    };
    const handleMouseUp = (e) => {
        if (!mouseStartRef.current) return;
        const dx = e.clientX - mouseStartRef.current.x;
        mouseStartRef.current = null;
        if (Math.abs(dx) < 60) return;
        const scroll = mainScrollRef.current;
        const fitsInView = !scroll || scroll.scrollWidth <= scroll.clientWidth + 4;
        const atStart = !scroll || scroll.scrollLeft <= 2;
        const atEnd = !scroll || scroll.scrollLeft >= scroll.scrollWidth - scroll.clientWidth - 2;
        if (dx < 0 && (atEnd || fitsInView)) goToNext();
        else if (dx > 0 && (atStart || fitsInView)) goToPrev();
    };
    const handleMouseLeave = () => { mouseStartRef.current = null; };

    // ─── Видимые данные (теперь отображаем все запрошенные данные) ───────────
    const visibleChartData = useMemo(
        () => chartData,
        [chartData]
    );

    const triggerColumnAnimation = (dir, action) => {
        action();
        setColumnAnim(dir);
        setBarAnimActive(true);
        setTimeout(() => {
            setColumnAnim(null);
            setBarAnimActive(false);
        }, 480);
    };

    const handleAddColumn = () => {
        triggerColumnAnimation('expand', () => {
            setRangeLimits(prev => ({
                ...prev,
                [period]: (prev[period] || 7) + 1
            }));
        });
    };

    const handleRemoveColumn = () => {
        if ((rangeLimits[period] || 7) > 1) {
            triggerColumnAnimation('shrink', () => {
                setRangeLimits(prev => ({
                    ...prev,
                    [period]: Math.max(1, (prev[period] || 7) - 1)
                }));
            });
        }
    };

    const periodUnitLabel = () => {
        if (period === 'day') return language === 'ru' ? 'дн.' : 'd';
        if (period === 'week') return language === 'ru' ? 'нед.' : 'w';
        if (period === 'month') return language === 'ru' ? 'мес.' : 'mo';
        return language === 'ru' ? 'л.' : 'yr';
    };

    return (
        <div className="charts-container">
            <div className="charts-header">
                <div className="charts-title-row">
                    <h2>{t('statistics')}</h2>
                    {/* Переключатель вкладок */}
                    <div className="report-tab-switcher">
                        <button
                            id="report-tab-charts"
                            className={`report-tab-btn${reportView === 'charts' ? ' active' : ''}`}
                            onClick={() => setReportView('charts')}
                            title={language === 'ru' ? 'Графики' : 'Charts'}
                            aria-label={language === 'ru' ? 'Графики' : 'Charts'}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="12" width="4" height="9" rx="1"/>
                                <rect x="10" y="7" width="4" height="14" rx="1"/>
                                <rect x="17" y="3" width="4" height="18" rx="1"/>
                            </svg>
                        </button>
                        <button
                            id="report-tab-calendar"
                            className={`report-tab-btn${reportView === 'calendar' ? ' active' : ''}`}
                            onClick={() => setReportView('calendar')}
                            title={language === 'ru' ? 'Календарный отчёт' : 'Calendar report'}
                            aria-label={language === 'ru' ? 'Календарный отчёт' : 'Calendar report'}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                                <rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>
                                <rect x="14" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {reportView === 'charts' && (
                <>

                <div
                    className="chart-navigation-controls"
                    onTouchStart={handleSwipeTouchStart}
                    onTouchMove={handleSwipeTouchMove}
                    onTouchEnd={handleSwipeTouchEnd}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                >
                    <button className="nav-arrow-btn" onClick={goToPrev} aria-label={language === 'ru' ? 'Предыдущий период' : 'Previous period'}>←</button>
                    <div className="navigation-labels">
                        <span className="current-period-label">
                            <span>{periodLabel.title}</span>
                            {periodLabel.subtitle && <span className="current-period-subtitle">{periodLabel.subtitle}</span>}
                        </span>
                    </div>
                    <button className="nav-arrow-btn" onClick={goToNext} aria-label={language === 'ru' ? 'Следующий период' : 'Next period'}>→</button>
                </div>

                {/* viewType selector removed to show both habits and quantity together */}

                <div className="charts-category-row">
                    <div className="period-selector">
                        <button
                            className={`period-btn ${period === 'day' ? 'active' : ''}`}
                            onClick={() => handlePeriodChange('day')}
                        >
                            {t('days')}
                        </button>
                        <button
                            className={`period-btn ${period === 'week' ? 'active' : ''}`}
                            onClick={() => handlePeriodChange('week')}
                        >
                            {t('weeks')}
                        </button>
                        <button
                            className={`period-btn ${period === 'month' ? 'active' : ''}`}
                            onClick={() => handlePeriodChange('month')}
                        >
                            {t('months')}
                        </button>
                        <button
                            className={`period-btn ${period === 'year' ? 'active' : ''}`}
                            onClick={() => handlePeriodChange('year')}
                        >
                            {t('years')}
                        </button>
                    </div>

                    {sortedCategories && onSelectCategory && (
                        <div className="analytics-habit-selector analytics-category-selector" ref={categoryDropdownRef} style={{ zIndex: isCategoryDropdownOpen ? 1010 : 1000, margin: 0 }}>
                            <div 
                                className={`custom-dropdown-header ${isCategoryDropdownOpen ? 'open' : ''}`}
                                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                            >
                                <span>{selectedCategoryName}</span>
                                <div className="dropdown-arrow-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </div>
                            </div>
                            {isCategoryDropdownOpen && (
                                <div className="custom-dropdown-list">
                                    {sortedCategories.map(cat => (
                                        <div 
                                            key={cat.id} 
                                            className={`dropdown-item ${selectedCategory === cat.name ? 'active' : ''}`}
                                            onClick={() => {
                                                onSelectCategory(cat.name);
                                                setIsCategoryDropdownOpen(false);
                                            }}
                                        >
                                            {cat.name === 'Все' ? (t('allCategories') || 'Все категории') : 
                                             (cat.name === 'Без категории' ? t('noCategory') : cat.name)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {habitsData && habitsData.length > 0 && (
                        <div className="analytics-habit-selector analytics-category-selector" ref={habitDropdownRef} style={{ zIndex: isHabitDropdownOpen ? 1010 : 1000, margin: 0 }}>
                            <div 
                                className={`custom-dropdown-header ${isHabitDropdownOpen ? 'open' : ''}`}
                                onClick={() => setIsHabitDropdownOpen(!isHabitDropdownOpen)}
                            >
                                <span>{selectedHabitName}</span>
                                <div className="dropdown-arrow-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </div>
                            </div>
                            {isHabitDropdownOpen && (
                                <div className="custom-dropdown-list">
                                    <div 
                                        key="all"
                                        className={`dropdown-item ${selectedHabitId === 'all' ? 'active' : ''}`}
                                        onClick={() => {
                                            setSelectedHabitId('all');
                                            setIsHabitDropdownOpen(false);
                                        }}
                                    >
                                        {t('allHabits') || 'Все привычки'}
                                    </div>
                                    {habitsData.map(habit => (
                                        <div 
                                            key={habit.id} 
                                            className={`dropdown-item ${selectedHabitId.toString() === habit.id.toString() ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedHabitId(habit.id);
                                                setIsHabitDropdownOpen(false);
                                            }}
                                        >
                                            {habit.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                </>
                )}
            </div>

            {reportView === 'calendar' ? (
                <div key={`${selectedCategory}-${selectedHabitId}`} className="report-entrance-active">
                    <CalendarReport
                        theme={theme}
                        t={t}
                        language={language}
                        storageMode={storageMode}
                        selectedCategory={selectedCategory}
                        selectedHabitId={selectedHabitId}
                    />
                </div>
            ) : (
                <>
                {loading ? (
                    <div className="charts-loading">
                        <div className="loading-spinner"></div>
                        <p>{t('loading')}</p>
                    </div>
                ) : (
                    <div
                        key={`${period}-${viewType}`}
                        className={`chart-wrapper report-entrance-active ${slideDirection ? `slide-anim-${slideDirection}` : ''}${columnAnim ? ` col-anim-${columnAnim}` : ''}`}
                        onTouchStart={handleSwipeTouchStart}
                        onTouchMove={handleSwipeTouchMove}
                        onTouchEnd={handleSwipeTouchEnd}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="main-chart-scroll-wrapper" onScroll={handleMainScroll} ref={mainScrollRef}>
                            <div className="main-chart-inner" style={{ 
                                width: `${Math.max(visibleChartData.length * (isMobile ? 65 : 85), isMobile ? 220 : 350)}px`,
                                transition: 'width 0.35s cubic-bezier(0.25,0.46,0.45,0.94)'
                            }}>
                                <ResponsiveContainer width="100%" height="100%" style={{ overflow: 'visible' }}>
                                    <ComposedChart
                                        data={visibleChartData}
                                        margin={{ top: 8, right: 30, left: 0, bottom: 10 }}
                                        barCategoryGap={visibleChartData.length === 1 ? "2%" : (period === 'month' ? "5%" : "10%")}
                                        barGap={visibleChartData.length === 1 ? 0 : 2}
                                        barSize={isMobile ? ((period === 'month' || period === 'year') ? 28 : 18) : isTablet ? ((period === 'month' || period === 'year') ? 36 : 22) : ((period === 'month' || period === 'year') ? 44 : 28)}
                                        maxBarSize={100}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#404040" : "#e0e0e0"} />
                                        <XAxis
                                            dataKey={xAxisDataKey}
                                            stroke={isDark ? "#666" : "#666"}
                                            tick={<CustomXAxisTick period={period} isMobile={isMobile} isDark={isDark} chartData={visibleChartData} t={t} language={language} />}
                                            height={xAxisHeight}
                                            interval={0}
                                            tickLine={false}
                                            axisLine={false}
                                            type="category"
                                        />
                                        <YAxis
                                            stroke={isDark ? "#666" : "#666"}
                                            tick={{ fill: isDark ? "#E0E0E0" : "#666", fontSize: 12 }}
                                            allowDecimals={false}
                                            domain={[0, (dataMax) => {
                                                if (!dataMax || isNaN(dataMax) || dataMax === 0) return 1;
                                                if (dataMax <= 2) return dataMax + 1;
                                                return Math.ceil(dataMax * 1.15);
                                            }]}
                                            nice={true}
                                        />
                                                <Bar
                                                    dataKey="countCapped"
                                                    stackId="a"
                                                    fill="#059669"
                                                    radius={[8, 8, 0, 0]}
                                                    isAnimationActive={barAnimActive}
                                                    name={t('completed')}
                                                    shape={<CustomBarShape />}
                                                >
                                                    <LabelList
                                                        dataKey="countCapped"
                                                        content={(props) => <CustomBarLabel {...props} color="#FFF" baseSize={barLabelSize} />}
                                                    />
                                                </Bar>
                                                <Bar
                                                    dataKey="countRestored"
                                                    stackId="a"
                                                    fill="#6EE7B7"
                                                    radius={[8, 8, 0, 0]}
                                                    isAnimationActive={barAnimActive}
                                                    name={t('restored')}
                                                    shape={<CustomBarShape />}
                                                >
                                                    <LabelList
                                                        dataKey="countRestored"
                                                        content={(props) => <CustomBarLabel {...props} color="#FFF" baseSize={barLabelSize} />}
                                                    />
                                                    {period === 'day' && (
                                                        <LabelList
                                                            dataKey="dayMonth"
                                                            position="top"
                                                            content={(props) => {
                                                                const { x, y, value, index, width } = props;
                                                                if (!value || x == null || y == null) return null;
                                                                const chartTop = 8;
                                                                const cx = x + width / 2;
                                                                return (
                                                                    <text x={cx} y={chartTop} textAnchor="middle" fill={isDark ? "#E0E0E0" : "#666"} fontSize={isMobile ? 10 : 11} fontWeight={500}>
                                                                        {value}
                                                                    </text>
                                                                );
                                                            }}
                                                        />
                                                    )}
                                                    <LabelList
                                                        dataKey="completionFraction"
                                                        position="top"
                                                        content={(props) => <PercentageBadgeVertical {...props} fSize={isMobile ? 10 : 12} period={period} color="#059669" />}
                                                    />
                                                </Bar>
                                                <Bar
                                                    dataKey="countExtra"
                                                    stackId="b"
                                                    fill="#8B5CF6"
                                                    radius={[8, 8, 0, 0]}
                                                    isAnimationActive={barAnimActive}
                                                    name={t('quantity')}
                                                    shape={<CustomBarShape />}
                                                >
                                                    <LabelList
                                                        dataKey="countExtra"
                                                        content={(props) => <CustomBarLabel {...props} color="#FFF" baseSize={barLabelSize} />}
                                                    />
                                                    <LabelList
                                                        dataKey="completionFraction"
                                                        position="top"
                                                        content={(props) => <PercentageBadgeVertical {...props} fSize={isMobile ? 10 : 12} period={period} color="#8B5CF6" />}
                                                    />
                                                </Bar>
                                        {/* Зелёная пунктирная линия по вершинам столбцов */}
                                        <Line
                                            dataKey={d => d.isDummy ? null : ((d.countCapped || 0) + (d.countRestored || 0))}
                                            type="monotone"
                                            stroke="#22c55e"
                                            strokeWidth={isMobile ? 1.5 : 2}
                                            strokeDasharray="7 5"
                                            dot={{ r: isMobile ? 2.5 : 3.5, fill: '#22c55e', stroke: '#fff', strokeWidth: 1.5 }}
                                            activeDot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                                            isAnimationActive={barAnimActive}
                                            name="trend"
                                            legendType="none"
                                            connectNulls={false}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {period === 'year' && visibleChartData.length > (isMobile ? 5 : 7) && (
                            <div className="main-scroll-indicator-container">
                                <div className="main-scroll-indicator-bar" ref={mainIndicatorRef}></div>
                            </div>
                        )}

                        {visibleChartData.length === 0 && (
                            <div className="no-data-message">
                                <p>📊 {t('noData')}</p>
                                <p className="no-data-hint">{t('noDataHint')}</p>
                            </div>
                        )}

                        {/* Кнопки расширения / сжатия диапазона */}
                        {chartData.length > 0 && (
                            <div className="chart-expand-controls">
                                <button
                                    className="chart-expand-btn minus"
                                    onClick={handleRemoveColumn}
                                    disabled={(realDataCount || visibleChartData.length) <= 1}
                                    aria-label={language === 'ru' ? 'Убрать столбец' : 'Remove column'}
                                    title={language === 'ru' ? 'Убрать старый столбец' : 'Remove oldest column'}
                                >−</button>
                                <span className="chart-expand-count">
                                    {(realDataCount || visibleChartData.length)} {periodUnitLabel()}
                                </span>
                                <button
                                    className="chart-expand-btn plus"
                                    onClick={handleAddColumn}
                                    disabled={false}
                                    aria-label={language === 'ru' ? 'Добавить столбец' : 'Add column'}
                                    title={language === 'ru' ? 'Показать ещё один период' : 'Show one more period'}
                                >+</button>
                            </div>
                        )}
                    </div>
                )}

                <div key={`${period}-${chartDate}-${selectedCategory}`} className="report-entrance-active">
                    <CategoryComparisonTable
                        period={period}
                        currentWeekDate={chartDate}
                        theme={theme}
                        t={t}
                        language={language}
                        storageMode={storageMode}
                        sortedCategories={sortedCategories}
                    />
                </div>

                <div key={`${period}-${chartDate}-${selectedCategory}-${selectedHabitId}`} className="report-entrance-active">
                    <HabitsComparisonChart
                        period={period}
                        viewType={viewType}
                        currentWeekDate={chartDate}
                        selectedCategory={selectedCategory}
                        selectedHabitId={selectedHabitId}
                        theme={theme}
                        t={t}
                        language={language}
                        chartData={chartData}
                        storageMode={storageMode}
                    />
                </div>
            </>
        )}
        </div>
    );
};

export default Charts;
