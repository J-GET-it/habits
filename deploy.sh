#!/bin/bash
# deploy.sh — скрипт обновления Habits на продакшн-сервере
# Запускать на VPS: bash deploy.sh
# Или с локальной машины через SSH: ssh user@server 'bash /var/www/habits/deploy.sh'

set -e  # Прерывать при любой ошибке

HABITS_DIR="/var/www/habits"
BACKEND_DIR="$HABITS_DIR/backend"
FRONTEND_DIR="$HABITS_DIR/frontend"
VENV="$BACKEND_DIR/venv/bin/activate"

echo "======================================"
echo " Habits — деплой обновлений"
echo "======================================"

# 1. Получаем новый код (если используется git)
# Раскомментируйте если проект в git:
# echo "[1/4] Получение нового кода..."
# cd $HABITS_DIR
# git pull

# 2. Обновление бэкенда
echo "[1/3] Перезапуск Django (gunicorn)..."

# Попробуем оба варианта названия сервиса (habits-gunicorn или habits)
if systemctl is-active --quiet habits-gunicorn 2>/dev/null; then
    sudo systemctl restart habits-gunicorn
    echo "      ✓ Перезапущен habits-gunicorn"
elif systemctl is-active --quiet habits 2>/dev/null; then
    sudo systemctl restart habits
    echo "      ✓ Перезапущен habits"
else
    echo "      ⚠ Сервис gunicorn не найден (проверьте вручную)"
    echo "        Попробуйте: sudo systemctl restart habits-gunicorn"
    echo "        Или:        sudo systemctl restart habits"
fi

# 3. Сборка фронтенда
echo "[2/3] Сборка фронтенда React..."
cd $FRONTEND_DIR
npm run build
echo "      ✓ Frontend собран"

# 4. Перезагрузка nginx
echo "[3/3] Перезагрузка Nginx..."
sudo nginx -t && sudo systemctl reload nginx
echo "      ✓ Nginx перезагружен"

echo ""
echo "======================================"
echo " Деплой завершён!"
echo "======================================"
echo ""
echo " Проверьте работу:"
echo "   curl -I https://ваш-домен/api/v1/habits/quarterly_status/"
echo ""
echo " Если данные всё ещё не появляются — проверьте логи:"
echo "   sudo journalctl -u habits-gunicorn -n 50"
echo "   sudo journalctl -u habits -n 50"
