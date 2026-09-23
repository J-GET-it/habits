import json
import logging
from urllib.parse import urlparse

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import PushSubscription, ReminderSettings

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Отправить запланированные push-уведомления пользователям'

    def handle(self, *args, **options):
        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            self.stdout.write(self.style.ERROR(
                'pywebpush не установлен. Установите: pip install pywebpush'
            ))
            return

        utc_now = timezone.now()
        active_settings = ReminderSettings.objects.filter(enabled=True).select_related('user')

        sent_count = 0
        for setting in active_settings:
            # Определение локального времени пользователя
            user_now = self._get_user_now(setting, utc_now)
            current_time_str = user_now.strftime('%H:%M')
            today_date = user_now.date()

            # Сброс списка отправленных времён при наступлении нового дня
            if setting.last_sent_date != today_date:
                setting.last_sent_date = today_date
                setting.last_sent_times = []
                setting.save(update_fields=['last_sent_date', 'last_sent_times'])

            # Проверяем, есть ли текущее время в списке времён пользователя
            times_list = setting.times or []
            if current_time_str in times_list:
                # Предотвращаем повторную отправку в ту же минуту
                if current_time_str in (setting.last_sent_times or []):
                    continue

                self.stdout.write(
                    f"Отправляем напоминание для {setting.user.name} в {current_time_str}"
                )
                sent = self._send_to_user(setting, webpush, WebPushException, today_date, current_time_str)
                if sent > 0:
                    if not setting.last_sent_times:
                        setting.last_sent_times = []
                    setting.last_sent_times.append(current_time_str)
                    setting.save(update_fields=['last_sent_times'])
                sent_count += sent

        self.stdout.write(self.style.SUCCESS(
            f"Готово. Отправлено {sent_count} уведомлений."
        ))

    def _get_user_now(self, setting, utc_now):
        tz_name = setting.time_zone or 'Europe/Moscow'
        try:
            import zoneinfo
            tz = zoneinfo.ZoneInfo(tz_name)
            return utc_now.astimezone(tz)
        except Exception:
            return timezone.localtime(utc_now)

    def _send_to_user(self, reminder_setting, webpush, WebPushException, today_date, current_time_str):
        """Отправляет push-уведомление подпискам пользователя с дедупликацией по провайдеру."""
        subscriptions = PushSubscription.objects.filter(
            user=reminder_setting.user
        ).order_by('-created_at', '-id')

        if not subscriptions.exists():
            self.stdout.write(f"  Нет подписок у пользователя {reminder_setting.user.name}")
            return 0

        # Дедупликация: оставляем только одну (самую свежую) подписку на домен провайдера,
        # удаляя устаревшие «призрачные» подписки с того же устройства (например, web.push.apple.com)
        seen_domains = set()
        active_subs = []
        for sub in subscriptions:
            domain = urlparse(sub.endpoint).netloc
            if domain:
                if domain in seen_domains:
                    sub.delete()
                    self.stdout.write(f"  Удалена дублирующая подписка {domain}")
                    continue
                seen_domains.add(domain)
            active_subs.append(sub)

        # Детерминированный tag для коллапса дубликатов на уровне ОС/браузера
        deterministic_tag = f"habit-reminder-{reminder_setting.user.id}-{today_date.isoformat()}-{current_time_str}"

        payload = {
            "title": "Habbits 🌱",
            "body": reminder_setting.text or "Не забудьте отметить привычки!",
            "icon": "/favicon.ico",
            "badge": "/favicon-96x96.png",
            "tag": deterministic_tag,
            "url": "/"
        }

        sent = 0
        for sub in active_subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh,
                            "auth": sub.auth
                        }
                    },
                    data=json.dumps(payload),
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={
                        "sub": settings.VAPID_ADMIN_EMAIL,
                    }
                )
                self.stdout.write(
                    self.style.SUCCESS(f"  [OK] Отправлено на {sub.endpoint[:50]}...")
                )
                sent += 1
            except WebPushException as ex:
                self.stdout.write(
                    self.style.ERROR(f"  [FAIL] Ошибка для {sub.endpoint[:50]}: {ex}")
                )
                # 400, 404, 410 — подписка невалидна/истекла, удаляем
                status_code = getattr(ex.response, 'status_code', None)
                if status_code in [400, 404, 410]:
                    sub.delete()
                    self.stdout.write("    Устаревшая подписка удалена.")
            except Exception as ex:
                self.stdout.write(self.style.ERROR(f"  [FAIL] Неожиданная ошибка: {ex}"))

        return sent
