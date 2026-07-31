/**
 * Storage Service to handle both Cloud (API) and Local (localStorage) storage modes.
 */

const LOCAL_STORAGE_KEYS = {
  HABITS: 'habbits_local_habits',
  CATEGORIES: 'habbits_local_categories',
  STATUSES: 'habbits_local_statuses',
  STORAGE_MODE: 'habbits_storage_mode'
};

// Helper to generate unique IDs for local items
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to format date as YYYY-MM-DD in local time to avoid timezone shifts
const toLocalDateString = (dateInput) => {
  if (!dateInput) return '';
  // If it's already a YYYY-MM-DD string, just return it
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return dateInput;
  // Use UTC components to avoid timezone shifting
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isStreakActiveOnDate = (habitId, checkDateStr, statuses, habitStartDateStr) => {
  const [cy, cm, cd] = checkDateStr.split('-').map(Number);
  const checkDate = new Date(Date.UTC(cy, cm - 1, cd));
  let startDate = new Date(checkDate.getTime());
  startDate.setUTCDate(checkDate.getUTCDate() - 45);

  if (habitStartDateStr) {
    const [sy, sm, sd] = habitStartDateStr.split('-').map(Number);
    const habitStartDate = new Date(Date.UTC(sy, sm - 1, sd));
    if (habitStartDate > startDate) {
      startDate = habitStartDate;
    }
  }

  const datesInRange = [];
  const curr = new Date(startDate.getTime());

  while (curr <= checkDate) {
    datesInRange.push(toLocalDateString(curr));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  let streakActive = false;
  let consecutiveHits = 0;
  let consecutiveMisses = 0;

  datesInRange.forEach(dateStr => {
    const isDone = statuses.some(s => 
      String(s.habit) === String(habitId) && 
      s.date === dateStr && 
      s.is_done && 
      !s.is_restored
    );

    if (isDone) {
      consecutiveHits++;
      consecutiveMisses = 0;
      if (consecutiveHits >= 2) {
        streakActive = true;
      }
    } else {
      consecutiveHits = 0;
      consecutiveMisses++;
      if (consecutiveMisses >= 1) {
        if (dateStr < checkDateStr) {
          streakActive = false;
        }
      }
    }
  });

  return streakActive;
};

// Helper for JSON fetch with error handling
const fetchJson = async (url, opts) => {
  const resp = await fetch(url, opts);
  if (!resp.ok) throw new Error(`Fetch ${url} failed: ${resp.status}`);
  return resp.json();
};

const storageService = {
  getStorageMode: () => {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.STORAGE_MODE) || 'cloud';
  },

  setStorageMode: (mode) => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.STORAGE_MODE, mode);
  },

  // --- HABITS ---

  getHabits: async (mode, options = {}) => {
    if (mode === 'cloud') {
      try {
        return await fetchJson('/api/v1/habits/', options);
      } catch (e) {
        console.warn('Cloud getHabits failed, falling back to local:', e);
      }
    }
    const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
    const statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
    
    // Basic simulation of the backend response structure
    return habits.filter(h => !h.is_archived).map(h => ({
      ...h,
      statuses: statuses.filter(s => s.habit === h.id)
    }));
  },

  getArchivedHabits: async (mode, options = {}) => {
    if (mode === 'cloud') {
      try {
        return await fetchJson('/api/v1/habits/archived/', options);
      } catch (e) {
        console.warn('Cloud getArchivedHabits failed, falling back to local:', e);
      }
    }
    const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
    return habits.filter(h => h.is_archived);
  },

  saveHabit: async (mode, habitData, options = {}) => {
    if (mode === 'cloud') {
      const url = habitData.id ? `/api/v1/habits/${habitData.id}/` : '/api/v1/habits/';
      const method = habitData.id ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        ...options,
        method,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(habitData)
      });
      if (!response.ok) throw new Error('Failed to save habit');
      return response.json();
    } else {
      const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      let habit;
      if (habitData.id) {
        const index = habits.findIndex(h => h.id === habitData.id);
        if (index === -1) throw new Error('Habit not found');
        habits[index] = { ...habits[index], ...habitData };
        habit = habits[index];
      } else {
        habit = {
          ...habitData,
          id: generateId(),
          is_archived: false,
          order: habits.length,
          start_date: habitData.start_date || null
        };
        habits.push(habit);
      }
      localStorage.setItem(LOCAL_STORAGE_KEYS.HABITS, JSON.stringify(habits));
      return habit;
    }
  },

  deleteHabit: async (mode, id, options = {}) => {
    if (mode === 'cloud') {
      const response = await fetch(`/api/v1/habits/${id}/`, {
        ...options,
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete habit');
      return true;
    } else {
      let habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      habits = habits.filter(h => h.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.HABITS, JSON.stringify(habits));
      
      let statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      statuses = statuses.filter(s => s.habit !== id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.STATUSES, JSON.stringify(statuses));
      return true;
    }
  },

  reorderHabits: async (mode, orderedIds, options = {}) => {
    if (mode === 'cloud') {
      const payload = orderedIds.map((id, index) => ({ id, order: index }));
      const response = await fetch('/api/v1/habits/reorder/', {
        ...options,
        method: 'POST',
        headers: {
          ...options.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to reorder habits');
      return response.json();
    } else {
      const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      orderedIds.forEach((id, index) => {
        const habit = habits.find(h => h.id === id);
        if (habit) habit.order = index;
      });
      habits.sort((a, b) => a.order - b.order);
      localStorage.setItem(LOCAL_STORAGE_KEYS.HABITS, JSON.stringify(habits));
      return true;
    }
  },

  // --- CATEGORIES ---

  getCategories: async (mode, options = {}) => {
    if (mode === 'cloud') {
      try {
        return await fetchJson('/api/v1/categories/', options);
      } catch (e) {
        console.warn('Cloud getCategories failed, falling back to local:', e);
      }
    }
    const categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
    return categories.filter(c => !c.is_archived);
  },

  getArchivedCategories: async (mode, options = {}) => {
    if (mode === 'cloud') {
      try {
        return await fetchJson('/api/v1/categories/archived/', options);
      } catch (e) {
        console.warn('Cloud getArchivedCategories failed, falling back to local:', e);
      }
    }
    const categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
    return categories.filter(c => c.is_archived);
  },

  saveCategory: async (mode, categoryData, options = {}) => {
    if (mode === 'cloud') {
      const url = categoryData.id ? `/api/v1/categories/${categoryData.id}/` : '/api/v1/categories/';
      const method = categoryData.id ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        ...options,
        method,
        headers: {
          ...options.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryData)
      });
      if (!response.ok) throw new Error('Failed to save category');
      return response.json();
    } else {
      const categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
      let category;
      if (categoryData.id) {
        const index = categories.findIndex(c => c.id === categoryData.id);
        if (index === -1) throw new Error('Category not found');
        categories[index] = { ...categories[index], ...categoryData };
        category = categories[index];
      } else {
        category = {
          ...categoryData,
          id: generateId(),
          is_archived: false,
          order: categories.length
        };
        categories.push(category);
      }
      localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      return category;
    }
  },

  deleteCategory: async (mode, id, options = {}) => {
    if (mode === 'cloud') {
      const response = await fetch(`/api/v1/categories/${id}/`, {
        ...options,
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete category');
      return true;
    } else {
      let categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
      categories = categories.filter(c => c.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      
      // Update habits in this category
      let habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      habits.forEach(h => {
        if (h.category === id) h.category = null;
      });
      localStorage.setItem(LOCAL_STORAGE_KEYS.HABITS, JSON.stringify(habits));
      return true;
    }
  },

  archiveCategory: async (mode, id, options = {}) => {
    if (mode === 'cloud') {
      const response = await fetch(`/api/v1/categories/${id}/archive/`, {
        ...options,
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to archive category');
      return response.json();
    } else {
      const categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
      const category = categories.find(c => c.id === id);
      if (category) category.is_archived = !category.is_archived;
      localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      return category;
    }
  },

  reorderCategories: async (mode, orderedIds, options = {}) => {
    if (mode === 'cloud') {
      const payload = orderedIds.map((id, index) => ({ id, order: index }));
      const response = await fetch('/api/v1/categories/reorder/', {
        ...options,
        method: 'POST',
        headers: {
          ...options.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to reorder categories');
      return response.json();
    } else {
      const categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
      orderedIds.forEach((id, index) => {
        const category = categories.find(c => c.id === id);
        if (category) category.order = index;
      });
      categories.sort((a, b) => a.order - b.order);
      localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      return true;
    }
  },

  // --- STATUSES ---

  getWeeklyStatus: async (mode, date, options = {}) => {
    if (mode === 'cloud') {
      try {
        return await fetchJson(`/api/v1/habits/weekly_status/?date=${date}`, options);
      } catch (e) {
        console.warn('Cloud getWeeklyStatus failed, falling back to local:', e);
      }
    }
    // Local fallback simulation
    let habits = [];
    let statuses = [];
    let categories = [];
    try {
      habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      if (!Array.isArray(habits)) habits = [];
      statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      if (!Array.isArray(statuses)) statuses = [];
      categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
      if (!Array.isArray(categories)) categories = [];
    } catch (e) {
      console.error('Error parsing local storage data', e);
    }
    const start = new Date(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = toLocalDateString(start);
    const endStr = toLocalDateString(end);

    // Calculate previous week's Fri, Sat, Sun for active streak carry-over
    const prevSun = new Date(start);
    prevSun.setDate(start.getDate() - 1);
    const prevSat = new Date(start);
    prevSat.setDate(start.getDate() - 2);
    const prevFri = new Date(start);
    prevFri.setDate(start.getDate() - 3);

    const prevSunStr = toLocalDateString(prevSun);
    const prevSatStr = toLocalDateString(prevSat);
    const prevFriStr = toLocalDateString(prevFri);

    // Simulation of weekly status endpoint
    return habits.filter(h => !h.is_archived).map(h => {
      const catObj = categories.find(c => c.id === h.category || String(c.id) === String(h.category));
      const habitStatuses = statuses.filter(s => {
        const habitIdMatch = String(s.habit) === String(h.id);
        const dateMatch = s.date >= startStr && s.date <= endStr;
        return habitIdMatch && dateMatch;
      });

      const todayStr = toLocalDateString(new Date());
      let isStreakActiveToday = null;

      let prevSunDone;
      if (prevSunStr > todayStr) {
        if (isStreakActiveToday === null) {
          isStreakActiveToday = isStreakActiveOnDate(h.id, todayStr, statuses, h.start_date);
        }
        prevSunDone = isStreakActiveToday;
      } else {
        prevSunDone = statuses.some(s => String(s.habit) === String(h.id) && s.date === prevSunStr && s.is_done && !s.is_restored);
      }

      let prevSatDone;
      if (prevSatStr > todayStr) {
        if (isStreakActiveToday === null) {
          isStreakActiveToday = isStreakActiveOnDate(h.id, todayStr, statuses, h.start_date);
        }
        prevSatDone = isStreakActiveToday;
      } else {
        prevSatDone = statuses.some(s => String(s.habit) === String(h.id) && s.date === prevSatStr && s.is_done && !s.is_restored);
      }

      let prevFriDone;
      if (prevFriStr > todayStr) {
        if (isStreakActiveToday === null) {
          isStreakActiveToday = isStreakActiveOnDate(h.id, todayStr, statuses, h.start_date);
        }
        prevFriDone = isStreakActiveToday;
      } else {
        prevFriDone = statuses.some(s => String(s.habit) === String(h.id) && s.date === prevFriStr && s.is_done && !s.is_restored);
      }

      return {
        ...h,
        category_name: catObj ? catObj.name : null,
        statuses: habitStatuses,
        prev_week_sun_done: prevSunDone,
        prev_week_sat_done: prevSatDone,
        prev_week_fri_done: prevFriDone
      };
    });
  },

  // Возвращает статусы всех привычек за текущий квартал
  getQuarterlyStatus: async (mode, date, options = {}) => {
    if (mode === 'cloud') {
      try {
        return await fetchJson(`/api/v1/habits/quarterly_status/?date=${date}`, options);
      } catch (e) {
        console.warn('Cloud getQuarterlyStatus failed, falling back to local:', e);
      }
    }
    // Local fallback — собираем данные из localStorage
    let habits = [];
    let statuses = [];
    try {
      habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      if (!Array.isArray(habits)) habits = [];
      statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      if (!Array.isArray(statuses)) statuses = [];
    } catch (e) {
      console.error('Error parsing local storage data', e);
    }

    const ref = new Date(date + 'T00:00:00');
    const quarterMonthStart = Math.floor(ref.getMonth() / 3) * 3;
    const quarterStart = new Date(Date.UTC(ref.getFullYear(), quarterMonthStart, 1));
    const quarterEnd = new Date(Date.UTC(ref.getFullYear(), quarterMonthStart + 3, 0)); // последний день квартала

    const totalDays = Math.round((quarterEnd - quarterStart) / 86400000) + 1;

    return habits.filter(h => !h.is_archived).map(h => {
      const days = [];
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(quarterStart.getTime());
        d.setUTCDate(d.getUTCDate() + i);
        const dStr = toLocalDateString(d);
        const entry = statuses.find(s => String(s.habit) === String(h.id) && s.date === dStr);
        days.push({
          date: dStr,
          is_done: entry ? entry.is_done : false,
          is_restored: entry ? entry.is_restored : false,
        });
      }
      return {
        id: h.id,
        name: h.name,
        start_date: h.start_date || null,
        quarter_start: toLocalDateString(quarterStart),
        quarter_end: toLocalDateString(quarterEnd),
        days,
      };
    });
  },

  saveStatus: async (mode, statusData, options = {}) => {

    if (mode === 'cloud') {
      const response = await fetch('/api/v1/habits/update_status/', {
        ...options,
        method: 'POST',
        headers: {
          ...options.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(statusData)
      });
      if (!response.ok) throw new Error('Failed to save status');
      return response.json();
    } else {
      const statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      const { habit_id, date, is_done, is_restored, quantity, comment } = statusData;
      
      let statusIndex = statuses.findIndex(s => s.habit === habit_id && s.date === date);
      let status;
      
      if (statusIndex !== -1) {
        statuses[statusIndex] = { ...statuses[statusIndex], is_done, is_restored, quantity, comment };
        status = statuses[statusIndex];
      } else {
        status = {
          id: generateId(),
          habit: habit_id,
          date,
          is_done,
          is_restored,
          quantity,
          comment
        };
        statuses.push(status);
      }
      localStorage.setItem(LOCAL_STORAGE_KEYS.STATUSES, JSON.stringify(statuses));

      const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      const habitIndex = habits.findIndex(h => h.id === habit_id);
      if (habitIndex !== -1 && !habits[habitIndex].start_date) {
        const filledStatuses = statuses
          .filter(s => String(s.habit) === String(habit_id) && (s.is_done || s.comment || s.quantity != null))
          .map(s => s.date)
          .filter(Boolean)
          .sort();

        if (filledStatuses.length > 0) {
          habits[habitIndex] = {
            ...habits[habitIndex],
            start_date: filledStatuses[0]
          };
          localStorage.setItem(LOCAL_STORAGE_KEYS.HABITS, JSON.stringify(habits));
        }
      }

      return status;
    }
  },

  clearComment: async (mode, habitId, options = {}) => {
    if (mode === 'cloud') {
      const response = await fetch('/api/v1/habits/clear_comment/', {
        ...options,
        method: 'POST',
        headers: {
          ...options.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ habit_id: habitId })
      });
      if (!response.ok) throw new Error('Failed to clear comment');
      return response.json();
    } else {
      // Локальный режим: очищаем комментарий в последнем статусе
      const statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      const habitStatuses = statuses
        .filter(s => String(s.habit) === String(habitId) && s.comment)
        .sort((a, b) => (b.date > a.date ? 1 : -1));
      if (habitStatuses.length > 0) {
        const idx = statuses.findIndex(s => s.id === habitStatuses[0].id);
        if (idx !== -1) {
          statuses[idx].comment = '';
          localStorage.setItem(LOCAL_STORAGE_KEYS.STATUSES, JSON.stringify(statuses));
        }
      }
      return { status: 'cleared' };
    }
  },

  // --- COMPARISON / CHARTS ---

  getComparison: async (mode, params, options = {}) => {
    const { period, date, category, habit_id } = params;
    if (mode === 'cloud') {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`/api/v1/habits/habit_comparison/?${query}`, options);
      if (!response.ok) throw new Error('Failed to fetch comparison data');
      return response.json();
    } else {
      const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      const statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      const categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');

      // Filter habits by category if needed
      let filteredHabits = habits.filter(h => !h.is_archived);
      if (habit_id && habit_id !== 'all') {
        filteredHabits = filteredHabits.filter(h => String(h.id) === String(habit_id));
      } else if (category && category !== 'Все') {
        const catObj = categories.find(c => c.name === category);
        if (catObj) {
          filteredHabits = filteredHabits.filter(h => h.category === catObj.id);
        }
      }

      // Simulation of comparison statistics
      const stats = filteredHabits.map(h => {
        let habitStatuses = statuses.filter(s => s.habit === h.id);
        
        // Filter by date/period
        if (period === 'day') {
          habitStatuses = habitStatuses.filter(s => s.date === date);
        } else if (period === 'week') {
          // Simplified: assume date is the Monday of the week
          const start = new Date(date);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          const startStr = toLocalDateString(start);
          const endStr = toLocalDateString(end);
          habitStatuses = habitStatuses.filter(s => s.date >= startStr && s.date <= endStr);
        } else if (period === 'month') {
          const month = date.substring(0, 7); // YYYY-MM
          habitStatuses = habitStatuses.filter(s => s.date.startsWith(month));
        } else if (period === 'year') {
          const year = date.substring(0, 4); // YYYY
          habitStatuses = habitStatuses.filter(s => s.date.startsWith(year));
        }

        const completed_days = habitStatuses.filter(s => s.is_done && !s.is_restored).length;
        const restored_days = habitStatuses.filter(s => s.is_restored).length;
        const extra_quantity = habitStatuses.reduce((acc, s) => acc + (s.quantity || 0), 0);
        
        const catObj = categories.find(c => c.id === h.category);
        
        return {
          id: h.id,
          name: h.name,
          category_name: catObj ? catObj.name : 'Без категории',
          completed_days,
          restored_days,
          extra_quantity,
          start_date: h.start_date
        };
      });

      return { habits: stats };
    }
  },

  getReport: async (mode, habitId, params, options = {}) => {
    const { period, date } = params;
    if (mode === 'cloud') {
      const response = await fetch(`/api/v1/habits/${habitId}/report/?period=${period}&date=${date}`, options);
      if (!response.ok) throw new Error('Failed to fetch report');
      return response.json();
    } else {
      // Local report simulation (simplified)
      const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      const habit = habits.find(h => h.id === habitId);
      return {
        habit: habit || { id: habitId, name: 'Habit' },
        period,
        date,
        data: [] // Simple stub for now
      };
    }
  },

  getSummaryReport: async (mode, params, options = {}) => {
    const { period, date } = params;
    if (mode === 'cloud') {
      const response = await fetch(`/api/v1/habits/summary_report/?period=${period}&date=${date}`, options);
      if (!response.ok) throw new Error('Failed to fetch summary report');
      return response.json();
    } else {
      // Local summary report simulation
      return {
        is_general: true,
        period,
        date,
        habits: [] // Simple stub for now
      };
    }
  },

  getDailyStatistics: async (mode, params, options = {}) => {
    const { period, date, category, start_date, end_date, habit_id } = params;
    if (mode === 'cloud') {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`/api/v1/habits/daily_statistics/?${query}`, options);
      if (!response.ok) throw new Error('Failed to fetch daily statistics');
      return response.json();
    } else {
      // Local daily statistics simulation
      const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      const statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      
      let filteredHabits = habits.filter(h => !h.is_archived);
      if (habit_id && habit_id !== 'all') {
        filteredHabits = filteredHabits.filter(h => String(h.id) === String(habit_id));
      } else if (category && category !== 'Все') {
        if (category === 'Без категории') {
          filteredHabits = filteredHabits.filter(h => !h.category);
        } else {
          const categories = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]');
          const targetCat = categories.find(c => c.name === category);
          if (targetCat) {
            filteredHabits = filteredHabits.filter(h => String(h.category) === String(targetCat.id));
          } else {
            filteredHabits = [];
          }
        }
      }

      const stats = [];
      
      if (start_date && end_date) {
        const start = new Date(start_date);
        start.setHours(0,0,0,0);
        const end = new Date(end_date);
        end.setHours(23,59,59,999);

        if (period === 'day' || !period) {
          let current = new Date(start);
          while (current <= end) {
            const dateStr = toLocalDateString(current);
            const dayStatuses = statuses.filter(s => s.date === dateStr && s.is_done && filteredHabits.some(h => String(h.id) === String(s.habit)));
            const habitCount = filteredHabits.filter(h => !h.start_date || h.start_date <= dateStr).length;
            const completedCount = dayStatuses.length;
            const completedDays = dayStatuses.filter(s => !s.is_restored).length;
            const restoredDays = dayStatuses.filter(s => s.is_restored).length;
            const extraQuantity = dayStatuses.filter(s => s.quantity != null).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            stats.push({
              date: dateStr,
              label: String(current.getDate()),
              days_in_period: 1,
              habit_count: habitCount,
              completed_count: completedCount + extraQuantity,
              completed_days: completedDays,
              restored_days: restoredDays,
              extra_quantity: extraQuantity
            });
            current.setDate(current.getDate() + 1);
          }
        } else if (period === 'week') {
          let current = new Date(start);
          while (current <= end) {
            const periodEnd = new Date(current);
            periodEnd.setDate(current.getDate() + 6);
            const startStr = toLocalDateString(current);
            const endStr = toLocalDateString(periodEnd);
            const rangeStatuses = statuses.filter(s => s.date >= startStr && s.date <= endStr && s.is_done && filteredHabits.some(h => String(h.id) === String(s.habit)));
            const habitCount = filteredHabits.filter(h => !h.start_date || h.start_date <= endStr).length;
            const completedCount = rangeStatuses.length;
            const completedDays = rangeStatuses.filter(s => !s.is_restored).length;
            const restoredDays = rangeStatuses.filter(s => s.is_restored).length;
            const extraQuantity = rangeStatuses.filter(s => s.quantity != null).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            stats.push({
              date: startStr,
              label: `${current.getDate()}-${periodEnd.getDate()}`,
              days_in_period: 7,
              habit_count: habitCount,
              completed_count: completedCount + extraQuantity,
              completed_days: completedDays,
              restored_days: restoredDays,
              extra_quantity: extraQuantity
            });
            current.setDate(current.getDate() + 7);
          }
        } else if (period === 'month') {
          let current = new Date(start.getFullYear(), start.getMonth(), 1);
          while (current <= end) {
            const periodStart = new Date(current.getFullYear(), current.getMonth(), 1);
            const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
            const startStr = toLocalDateString(periodStart);
            const endStr = toLocalDateString(periodEnd);
            const rangeStatuses = statuses.filter(s => s.date >= startStr && s.date <= endStr && s.is_done && filteredHabits.some(h => String(h.id) === String(s.habit)));
            const habitCount = filteredHabits.filter(h => !h.start_date || h.start_date <= endStr).length;
            const completedCount = rangeStatuses.length;
            const completedDays = rangeStatuses.filter(s => !s.is_restored).length;
            const restoredDays = rangeStatuses.filter(s => s.is_restored).length;
            const extraQuantity = rangeStatuses.filter(s => s.quantity != null).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            stats.push({
              date: startStr,
              label: periodStart.toLocaleDateString('ru-RU', { month: 'short' }),
              days_in_period: periodEnd.getDate(),
              habit_count: habitCount,
              completed_count: completedCount + extraQuantity,
              completed_days: completedDays,
              restored_days: restoredDays,
              extra_quantity: extraQuantity
            });
            current.setMonth(current.getMonth() + 1);
          }
        } else if (period === 'year') {
          let current = new Date(start.getFullYear(), 0, 1);
          while (current <= end) {
            const periodStart = new Date(current.getFullYear(), 0, 1);
            const periodEnd = new Date(current.getFullYear(), 11, 31);
            const startStr = toLocalDateString(periodStart);
            const endStr = toLocalDateString(periodEnd);
            const rangeStatuses = statuses.filter(s => s.date >= startStr && s.date <= endStr && s.is_done && filteredHabits.some(h => String(h.id) === String(s.habit)));
            const habitCount = filteredHabits.filter(h => !h.start_date || h.start_date <= endStr).length;
            const completedCount = rangeStatuses.length;
            const completedDays = rangeStatuses.filter(s => !s.is_restored).length;
            const restoredDays = rangeStatuses.filter(s => s.is_restored).length;
            const extraQuantity = rangeStatuses.filter(s => s.quantity != null).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            stats.push({
              date: startStr,
              label: String(current.getFullYear()),
              days_in_period: 365,
              habit_count: habitCount,
              completed_count: completedCount + extraQuantity,
              completed_days: completedDays,
              restored_days: restoredDays,
              extra_quantity: extraQuantity
            });
            current.setFullYear(current.getFullYear() + 1);
          }
        }
      } else {
        const now = new Date();
        let startOfPeriod;
        
        if (period === 'week') {
          const d = new Date(date || now);
          const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
          startOfPeriod = new Date(d);
          startOfPeriod.setDate(d.getDate() - day);
        } else if (period === 'month') {
          const d = new Date(date || now);
          startOfPeriod = new Date(d.getFullYear(), 0, 1);
        } else {
          startOfPeriod = new Date(new Date().getFullYear(), 0, 1);
        }
        
        startOfPeriod.setHours(0, 0, 0, 0);
        
        if (period === 'week') {
          for (let i = 0; i < 7; i++) {
            const current = new Date(startOfPeriod);
            current.setDate(startOfPeriod.getDate() + i);
            const dateStr = toLocalDateString(current);
            const dayStatuses = statuses.filter(s => s.date === dateStr && s.is_done && filteredHabits.some(h => String(h.id) === String(s.habit)));
            const habitCount = filteredHabits.filter(h => !h.start_date || h.start_date <= dateStr).length;
            const completedCount = dayStatuses.length;
            stats.push({
              date: dateStr,
              label: current.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
              habit_count: habitCount,
              completed_count: completedCount,
              completed_days: completedCount > 0 ? 1 : 0,
              restored_days: 0,
              extra_quantity: 0
            });
          }
        } else if (period === 'month') {
          const year = startOfPeriod.getFullYear();
          for (let month = 0; month < 12; month++) {
            const periodStart = new Date(year, month, 1);
            const periodEnd = new Date(year, month + 1, 0);
            const monthKey = periodStart.toLocaleDateString('ru-RU', { month: 'short' });
            const startStr = toLocalDateString(periodStart);
            const endStr = toLocalDateString(periodEnd);
            const monthStatuses = statuses.filter(s => s.date >= startStr && s.date <= endStr && s.is_done && filteredHabits.some(h => String(h.id) === String(s.habit)));
            const habitCount = filteredHabits.filter(h => !h.start_date || h.start_date <= endStr).length;
            const completedCount = monthStatuses.length;
            stats.push({
              date: startStr,
              label: monthKey,
              habit_count: habitCount,
              completed_count: completedCount,
              completed_days: completedCount > 0 ? 1 : 0,
              restored_days: 0,
              extra_quantity: 0
            });
          }
        } else {
          for (let i = 0; i < 366; i++) {
            const current = new Date(startOfPeriod);
            current.setDate(startOfPeriod.getDate() + i);
            if (current.getFullYear() !== startOfPeriod.getFullYear()) break;
            const dateStr = toLocalDateString(current);
            const dayStatuses = statuses.filter(s => s.date === dateStr && s.is_done && filteredHabits.some(h => String(h.id) === String(s.habit)));
            const habitCount = filteredHabits.filter(h => !h.start_date || h.start_date <= dateStr).length;
            const completedCount = dayStatuses.length;
            stats.push({
              date: dateStr,
              label: current.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
              habit_count: habitCount,
              completed_count: completedCount,
              completed_days: completedCount > 0 ? 1 : 0,
              restored_days: 0,
              extra_quantity: 0
            });
          }
        }
      }
      
      return {
        data: stats,
        period_label: period
      };
    }
  },

  getAnalyticsChart: async (mode, habitId, categoryName, options = {}) => {
    if (mode === 'cloud') {
      let url = `/api/v1/habits/analytics_chart/?habit_id=${habitId}`;
      if (categoryName) {
        url += `&category_name=${encodeURIComponent(categoryName)}`;
      }
      const response = await fetch(url, options);
      if (!response.ok) throw new Error('Failed to fetch analytics chart');
      return response.json();
    } else {
      // Local analytics chart simulation
      const habits = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]');
      const statuses = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]');
      
      let filteredHabits = habits.filter(h => !h.is_archived);
      if (categoryName && categoryName !== 'all' && categoryName !== 'Все') {
        if (categoryName === 'Без категории') {
          filteredHabits = filteredHabits.filter(h => !h.category_name);
        } else {
          filteredHabits = filteredHabits.filter(h => h.category_name === categoryName);
        }
      }
      if (habitId && habitId !== 'all') {
        filteredHabits = filteredHabits.filter(h => String(h.id) === String(habitId));
      }
      
      // Get the earliest start_date among selected habits
      let startDateStr = null;
      filteredHabits.forEach(h => {
        if (h.start_date && (!startDateStr || h.start_date < startDateStr)) {
          startDateStr = h.start_date;
        }
      });

      // Also check earliest actual completed entry (user may have backdated records)
      const habitIds = new Set(filteredHabits.map(h => String(h.id)));
      let earliestDoneStr = null;
      statuses.forEach(s => {
        if (s.is_done && habitIds.has(String(s.habit)) && s.date) {
          if (!earliestDoneStr || s.date < earliestDoneStr) {
            earliestDoneStr = s.date;
          }
        }
      });

      // Pick the earliest of the two
      const candidates = [startDateStr, earliestDoneStr].filter(Boolean);
      const resolvedStart = candidates.length > 0 ? candidates.reduce((a, b) => a < b ? a : b) : null;

      let startDateOfChart = resolvedStart ? new Date(resolvedStart) : new Date();
      if (!resolvedStart) {
        startDateOfChart.setDate(startDateOfChart.getDate() - 30);
      }
      
      const today = new Date();
      // Chart ends at the end of the current week (Sunday)
      const dayOfWeek = today.getDay();
      const endOfChart = new Date(today);
      endOfChart.setDate(today.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek));
      
      // Align start to the first Monday of that week
      const startDayOfWeek = startDateOfChart.getDay();
      const daysSinceMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
      const weekStart = new Date(startDateOfChart);
      weekStart.setDate(startDateOfChart.getDate() - daysSinceMonday);
      
      // Safeguard against too many weeks
      if ((endOfChart - weekStart) / (1000 * 60 * 60 * 24) > 365) {
        weekStart.setTime(endOfChart.getTime() - 365 * 24 * 60 * 60 * 1000);
      }
      
      const weeksData = [];
      const MONTHS_RU = {
        1: 'Январь', 2: 'Февраль', 3: 'Март', 4: 'Апрель',
        5: 'Май', 6: 'Июнь', 7: 'Июль', 8: 'Август',
        9: 'Сентябрь', 10: 'Октябрь', 11: 'Ноябрь', 12: 'Декабрь'
      };
      
      const getISOWeekNumber = (date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      };
      
      let currentWeek = new Date(weekStart);
      while (currentWeek <= endOfChart) {
        const weekEnd = new Date(currentWeek);
        weekEnd.setDate(currentWeek.getDate() + 6);
        
        const thursday = new Date(currentWeek);
        thursday.setDate(currentWeek.getDate() + 3);
        
        const currentStr = toLocalDateString(currentWeek);
        const endStr = toLocalDateString(weekEnd);
        
        const weekStatuses = statuses.filter(s => {
          const habitMatch = filteredHabits.some(h => String(h.id) === String(s.habit));
          const dateMatch = s.date >= currentStr && s.date <= endStr;
          return habitMatch && dateMatch && s.is_done && !s.is_restored;
        });
        
        const totalCompletions = weekStatuses.length;
        const totalQuantity = weekStatuses.reduce((sum, status) => {
          return sum + (status.quantity != null ? Number(status.quantity) : 1);
        }, 0);
        
        let totalPossibleDays = 0;
        filteredHabits.forEach(habit => {
          if (habit.start_date) {
            const hStartStr = habit.start_date;
            if (hStartStr <= endStr) {
              if (hStartStr >= currentStr) {
                const actualStart = new Date(hStartStr);
                totalPossibleDays += Math.max(0, Math.round((weekEnd - actualStart) / (1000 * 60 * 60 * 24)) + 1);
              } else {
                totalPossibleDays += 7;
              }
            }
          } else {
            totalPossibleDays += 7;
          }
        });
        
        const activeHabitsCount = filteredHabits.filter(habit => !habit.start_date || habit.start_date <= endStr).length;
        
        let avgDays = 0;
        let displayDaysDone = totalCompletions;
        let displayTotalDays = totalPossibleDays;
        
        if (activeHabitsCount > 0) {
          avgDays = Number((totalCompletions / activeHabitsCount).toFixed(1));
        }
        
        weeksData.push({
          week_label: `н${getISOWeekNumber(currentWeek)}`,
          month: thursday.getMonth() + 1,
          month_name: MONTHS_RU[thursday.getMonth() + 1],
          value: Math.min(avgDays, 7),
          days_done: displayDaysDone,
          total_days: displayTotalDays,
          quantity: totalQuantity,
          week_start: currentStr,
          week_end: endStr
        });
        
        currentWeek.setDate(currentWeek.getDate() + 7);
      }
      
      // Calculate month stats
      const monthsData = {};
      const uniqueMonths = [];
      weeksData.forEach(w => {
        const dt = new Date(w.week_start);
        dt.setDate(dt.getDate() + 3); // Thursday
        const key = { year: dt.getFullYear(), month: dt.getMonth() + 1 };
        if (!uniqueMonths.some(m => m.year === key.year && m.month === key.month)) {
          uniqueMonths.push(key);
        }
      });
      
      let prevPercentage = null;
      uniqueMonths.forEach(m => {
        const mStartStr = `${m.year}-${String(m.month).padStart(2, '0')}-01`;
        const lastDay = new Date(m.year, m.month, 0).getDate();
        const mEndStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        
        const activeHabits = filteredHabits.filter(h => !h.start_date || h.start_date <= mEndStr).length;
        const monthStatuses = statuses.filter(s => {
          const habitMatch = filteredHabits.some(h => String(h.id) === String(s.habit));
          const dateMatch = s.date >= mStartStr && s.date <= mEndStr;
          return habitMatch && dateMatch && s.is_done && !s.is_restored;
        });
        
        const maxPossible = activeHabits * lastDay;
        let percentage = 0;
        if (maxPossible > 0) {
          percentage = Math.round((monthStatuses.length / maxPossible) * 100);
        }
        
        let trend = null;
        if (prevPercentage !== null) {
          trend = percentage - prevPercentage;
        }
        
        monthsData[m.month] = {
          percentage,
          trend
        };
        prevPercentage = percentage;
      });
      
      return {
        weeks: weeksData,
        months: monthsData
      };
    }
  },

  // --- EXPORT / IMPORT ---

  exportData: async (mode) => {
    if (mode === 'cloud') {
      try {
        const options = { credentials: 'include' };
        
        // Fetch all needed data from the API
        const [habitsRes, archivedHabitsRes, categoriesRes, archivedCategoriesRes, datesRes] = await Promise.all([
          fetch('/api/v1/habits/', options),
          fetch('/api/v1/habits/archived/', options),
          fetch('/api/v1/categories/', options),
          fetch('/api/v1/categories/archived/', options),
          fetch('/api/v1/dates/', options)
        ]);

        const habits = await habitsRes.json();
        const archivedHabits = await archivedHabitsRes.json();
        const categories = await categoriesRes.json();
        const archivedCategories = await archivedCategoriesRes.json();
        const dates = await datesRes.json();

        // Format dates to match local storage statuses structure
        const statuses = Array.isArray(dates) ? dates.map(d => ({
          id: d.id,
          habit: d.habit,
          date: d.habit_date,
          is_done: d.is_done,
          is_restored: d.is_restored,
          quantity: d.quantity,
          comment: d.comment
        })) : [];

        const data = {
          habits: [...(Array.isArray(habits) ? habits : []), ...(Array.isArray(archivedHabits) ? archivedHabits : [])],
          categories: [...(Array.isArray(categories) ? categories : []), ...(Array.isArray(archivedCategories) ? archivedCategories : [])],
          statuses: statuses,
          settings: {
            theme: localStorage.getItem('theme'),
            language: localStorage.getItem('language'),
            reminderSettings: localStorage.getItem('reminderSettings')
          },
          exportedAt: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
      } catch (error) {
        console.error('Failed to export cloud data:', error);
        throw error;
      }
    } else {
      const data = {
        habits: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.HABITS) || '[]'),
        categories: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES) || '[]'),
        statuses: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.STATUSES) || '[]'),
        settings: {
          theme: localStorage.getItem('theme'),
          language: localStorage.getItem('language'),
          reminderSettings: localStorage.getItem('reminderSettings')
        },
        exportedAt: new Date().toISOString()
      };
      return JSON.stringify(data, null, 2);
    }
  },

  importData: (jsonData) => {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      if (data.habits) localStorage.setItem(LOCAL_STORAGE_KEYS.HABITS, JSON.stringify(data.habits));
      if (data.categories) localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(data.categories));
      if (data.statuses) localStorage.setItem(LOCAL_STORAGE_KEYS.STATUSES, JSON.stringify(data.statuses));
      
      if (data.settings) {
        if (data.settings.theme) localStorage.setItem('theme', data.settings.theme);
        if (data.settings.language) localStorage.setItem('language', data.settings.language);
        if (data.settings.reminderSettings) localStorage.setItem('reminderSettings', data.settings.reminderSettings);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Import error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default storageService;
