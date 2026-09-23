// Service Worker для уведомлений-напоминаний о привычках
const REMINDER_CHECK_INTERVAL = 60000; // Проверка каждую минуту
const DB_NAME = 'HabbitsRemindersDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

let reminderSettings = null;
let checkIntervalId = null;

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror  = (e) => reject(e.target.error);
  });
}

async function saveSettingsToDB(settings) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(settings, 'reminderSettings');
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror    = () => rej(tx.error);
    });
    db.close();
  } catch (e) {
    console.error('[SW] Ошибка сохранения в IndexedDB:', e);
  }
}

async function loadSettingsFromDB() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('reminderSettings');
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror   = () => { db.close(); reject(req.error); };
    });
  } catch (e) {
    console.error('[SW] Ошибка загрузки из IndexedDB:', e);
    return null;
  }
}

// ─── Управление интервалом ─────────────────────────────────────────────────────

// Гарантирует, что интервал проверки запущен.
// Вызывается при каждом входящем сообщении, т.к. браузер может убить SW
// в любой момент, и тогда интервал пропадает.
function ensureIntervalRunning() {
  if (!checkIntervalId) {
    console.log('[SW] Перезапускаем интервал проверки напоминаний');
    checkIntervalId = setInterval(checkReminders, REMINDER_CHECK_INTERVAL);
  }
}

// ─── Логика проверки напоминаний ──────────────────────────────────────────────

function checkReminders() {
  if (!reminderSettings || !reminderSettings.enabled) return;

  const now   = new Date();
  const today = now.toDateString();

  // Сброс счётчиков в начале нового дня
  if (reminderSettings.lastNotificationDate !== today) {
    console.log('[SW] Новый день — сбрасываем счётчики');
    reminderSettings.lastNotificationDate = today;
    reminderSettings.notificationsSentToday = 0;
    reminderSettings.sentReminders = [];
    saveSettingsToDB(reminderSettings);
  }

  const reminderTimes = reminderSettings.reminderTimes || [];
  if (reminderTimes.length === 0) return;

  if ((reminderSettings.notificationsSentToday || 0) >= reminderTimes.length) return;

  for (const time of reminderTimes) {
    const [hours, minutes] = time.split(':').map(Number);
    const reminderDate = new Date(now);
    reminderDate.setHours(hours, minutes, 0, 0);

    const timeDiff = now - reminderDate; // положительное = прошли, отрицательное = ещё впереди

    // Срабатываем в окне [0, REMINDER_CHECK_INTERVAL*2] — небольшой запас на случай задержки
    if (timeDiff >= 0 && timeDiff < REMINDER_CHECK_INTERVAL * 2) {
      const reminderKey = `${today}-${time}`;
      if (!(reminderSettings.sentReminders || []).includes(reminderKey)) {
        console.log('[SW] Отправляем уведомление для:', time);
        sendNotification(false, time);

        if (!reminderSettings.sentReminders) reminderSettings.sentReminders = [];
        reminderSettings.sentReminders.push(reminderKey);
        reminderSettings.notificationsSentToday = (reminderSettings.notificationsSentToday || 0) + 1;
        saveSettingsToDB(reminderSettings);
        break; // Только одно уведомление за проверку
      }
    }
  }
}

// ─── Отправка уведомления ─────────────────────────────────────────────────────

function sendNotification(isTest = false, time = null) {
  const body = reminderSettings?.text || 'Не забудьте отметить привычки!';
  const now = new Date();
  const today = now.toDateString();
  const timeStr = time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const tag  = isTest
    ? `habit-test-${Date.now()}`
    : `habit-reminder-${today}-${timeStr}`;

  return self.registration.showNotification('Habbits 🌱', {
    body,
    icon:               '/favicon.ico',
    badge:              '/favicon-96x96.png',
    tag,
    requireInteraction: false,
    silent:             false,
    vibrate:            [200, 100, 200],
  });
}

// ─── Запрос настроек у клиента ────────────────────────────────────────────────

async function requestSettingsFromClients() {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    if (clients.length > 0) {
      console.log('[SW] Запрашиваем настройки у клиентов');
      clients.forEach(client => client.postMessage({ type: 'REQUEST_SETTINGS' }));
    }
  } catch (e) {
    console.error('[SW] Ошибка запроса настроек:', e);
  }
}

// ─── Инициализация SW ─────────────────────────────────────────────────────────

async function initSW() {
  // Пробуем загрузить настройки из IndexedDB
  const saved = await loadSettingsFromDB();
  if (saved) {
    reminderSettings = saved;
    console.log('[SW] Настройки загружены из IndexedDB:', reminderSettings);
  } else {
    // Просим клиента передать актуальные настройки
    await requestSettingsFromClients();
  }

  // Запускаем интервал проверки
  if (checkIntervalId) clearInterval(checkIntervalId);
  checkIntervalId = setInterval(checkReminders, REMINDER_CHECK_INTERVAL);
  // Сразу проверяем, вдруг уже пора
  checkReminders();
}

// ─── Обработка сообщений от клиента ─────────────────────────────────────────

self.addEventListener('message', async (event) => {
  const { type, settings } = event.data || {};

  if (type === 'UPDATE_REMINDER_SETTINGS' || type === 'SETTINGS_RESPONSE') {
    // Если SW был убит браузером и перезапущен, reminderSettings = null.
    // Пробуем загрузить сохранённые данные отслеживания из IndexedDB,
    // чтобы не потерять sentReminders и не слать дубликаты.
    let preserved = {};
    if (!reminderSettings) {
      const saved = await loadSettingsFromDB();
      if (saved) {
        preserved = {
          sentReminders:         saved.sentReminders         || [],
          notificationsSentToday: saved.notificationsSentToday || 0,
          lastNotificationDate:  saved.lastNotificationDate  || null,
        };
      }
    } else {
      preserved = {
        sentReminders:         reminderSettings.sentReminders         || [],
        notificationsSentToday: reminderSettings.notificationsSentToday || 0,
        lastNotificationDate:  reminderSettings.lastNotificationDate  || null,
      };
    }

    // Мёрджим: настройки пользователя из App перезаписывают только «преференции»,
    // внутренние счётчики отслеживания — сохраняются.
    reminderSettings = { ...preserved, ...settings };
    await saveSettingsToDB(reminderSettings);
    console.log('[SW] Настройки обновлены:', reminderSettings);

    // Гарантируем что интервал работает (SW мог быть перезапущен без activate)
    ensureIntervalRunning();
    // Сразу проверяем — вдруг уже наступило время
    checkReminders();

  } else if (type === 'TEST_NOTIFICATION') {
    // Загрузить настройки из DB если нужно
    if (!reminderSettings) {
      reminderSettings = await loadSettingsFromDB();
    }
    await sendNotification(true);

  } else if (type === 'SHOW_REMINDER_NOTIFICATION') {
    // Резервный вызов из страницы (когда SW не отвечает на setInterval)
    if (!reminderSettings) {
      reminderSettings = await loadSettingsFromDB();
    }
    const targetTime = event.data?.time;
    const now = new Date();
    const today = now.toDateString();
    const reminderKey = targetTime ? `${today}-${targetTime}` : null;
    if (reminderKey && (reminderSettings?.sentReminders || []).includes(reminderKey)) {
      // Уже отправлено ранее сегодня
      return;
    }
    await sendNotification(false, targetTime);
    if (reminderSettings && reminderKey) {
      if (!reminderSettings.sentReminders) reminderSettings.sentReminders = [];
      reminderSettings.sentReminders.push(reminderKey);
      reminderSettings.notificationsSentToday = (reminderSettings.notificationsSentToday || 0) + 1;
      await saveSettingsToDB(reminderSettings);
    }

  } else if (type === 'PING') {
    // Keepalive-пинг от страницы — убеждаемся, что интервал запущен,
    // и сразу проверяем время (на случай пропущенного интервала)
    if (!reminderSettings) {
      reminderSettings = await loadSettingsFromDB();
    }
    ensureIntervalRunning();
    checkReminders();
  }
});

// ─── Lifecycle SW ─────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Установка');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Активация');
  event.waitUntil(
    self.clients.claim().then(() => initSW())
  );
});

// ─── Клик по уведомлению ─────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ─── Серверные Push-уведомления (Web Push API) ───────────────────────────────

self.addEventListener('push', (event) => {
  console.log('[SW] Push получен');
  let data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch (e) { data = { title: 'Habbits 🌱', body: event.data.text() }; }
  }

  const title   = data.title  || 'Habbits 🌱';
  const tag     = data.tag    || 'habit-reminder';
  const options = {
    body:    data.body   || 'Пора отметить привычки!',
    icon:    data.icon   || '/favicon.ico',
    badge:   data.badge  || '/favicon-96x96.png',
    tag:     tag,
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
