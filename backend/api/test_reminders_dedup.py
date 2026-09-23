import sys
import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import UserAll, ReminderSettings, PushSubscription
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status

# Ensure pywebpush is mockable even if not installed locally
if 'pywebpush' not in sys.modules:
    mock_pywebpush = MagicMock()
    mock_pywebpush.WebPushException = type('WebPushException', (Exception,), {'response': None})
    sys.modules['pywebpush'] = mock_pywebpush


class RemindersDeduplicationTests(TestCase):
    def setUp(self):
        self.auth_user = User.objects.create_user(username='pushuser', password='password123')
        self.user_profile = UserAll.objects.create(auth_user=self.auth_user, name='Push User')
        self.client = APIClient()
        self.client.force_authenticate(user=self.auth_user)

    def test_subscribe_push_cleans_up_stale_provider_endpoints(self):
        """Проверяем, что при новой подписке старые подписки того же провайдера удаляются."""
        # Первая подписка из Safari / старой PWA
        old_apple_endpoint = "https://web.push.apple.com/QC01_old_endpoint_token"
        PushSubscription.objects.create(
            user=self.user_profile,
            endpoint=old_apple_endpoint,
            p256dh="old_key",
            auth="old_auth"
        )
        self.assertEqual(PushSubscription.objects.filter(user=self.user_profile).count(), 1)

        # Новая подписка из PWA (новые учетные данные push)
        new_apple_endpoint = "https://web.push.apple.com/QC02_new_endpoint_token"
        response = self.client.post('/api/v1/reminders/subscribe/', {
            'endpoint': new_apple_endpoint,
            'p256dh': 'new_key',
            'auth': 'new_auth'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Должна остаться ровно 1 подписка (новая)
        subs = PushSubscription.objects.filter(user=self.user_profile)
        self.assertEqual(subs.count(), 1)
        self.assertEqual(subs.first().endpoint, new_apple_endpoint)

    def test_send_reminders_deduplicates_subscriptions_and_cleans_ghosts(self):
        """Команда send_reminders не шлет дубли на один и тот же девайс и удаляет старые подписки."""
        # Допустим, в базе уже накопились 3 старых подписки от Apple Web Push
        sub1 = PushSubscription.objects.create(
            user=self.user_profile,
            endpoint="https://web.push.apple.com/token1",
            p256dh="k1",
            auth="a1"
        )
        sub2 = PushSubscription.objects.create(
            user=self.user_profile,
            endpoint="https://web.push.apple.com/token2",
            p256dh="k2",
            auth="a2"
        )
        sub3 = PushSubscription.objects.create(
            user=self.user_profile,
            endpoint="https://web.push.apple.com/token3",
            p256dh="k3",
            auth="a3"
        )

        now = timezone.localtime(timezone.now())
        current_time_str = now.strftime('%H:%M')

        setting = ReminderSettings.objects.create(
            user=self.user_profile,
            enabled=True,
            text="Трекинг 🥾",
            times=[current_time_str],
            time_zone='Europe/Moscow'
        )

        sent_payloads = []

        def mock_webpush(subscription_info, data, vapid_private_key, vapid_claims):
            sent_payloads.append({
                'sub': subscription_info,
                'data': json.loads(data)
            })

        with patch('pywebpush.webpush', side_effect=mock_webpush):
            call_command('send_reminders')

        # Должно быть отправлено ровно 1 уведомление (а не 3!)
        self.assertEqual(len(sent_payloads), 1)

        # Проверяем детерминированный tag
        today_date = now.date().isoformat()
        expected_tag = f"habit-reminder-{self.user_profile.id}-{today_date}-{current_time_str}"
        self.assertEqual(sent_payloads[0]['data']['tag'], expected_tag)
        self.assertEqual(sent_payloads[0]['data']['body'], "Трекинг 🥾")

        # Старые дубликаты должны быть очищены из БД
        remaining_subs = PushSubscription.objects.filter(user=self.user_profile)
        self.assertEqual(remaining_subs.count(), 1)
        self.assertEqual(remaining_subs.first().endpoint, "https://web.push.apple.com/token3")

    def test_send_reminders_does_not_resend_in_same_minute(self):
        """Повторный запуск команды в ту же минуту не отправляет дублирующее уведомление."""
        PushSubscription.objects.create(
            user=self.user_profile,
            endpoint="https://web.push.apple.com/token_once",
            p256dh="k",
            auth="a"
        )

        now = timezone.localtime(timezone.now())
        current_time_str = now.strftime('%H:%M')

        setting = ReminderSettings.objects.create(
            user=self.user_profile,
            enabled=True,
            text="Тест",
            times=[current_time_str],
            time_zone='Europe/Moscow'
        )

        sent_calls = []

        def mock_webpush(subscription_info, data, vapid_private_key, vapid_claims):
            sent_calls.append(True)

        with patch('pywebpush.webpush', side_effect=mock_webpush):
            # Первый вызов
            call_command('send_reminders')
            self.assertEqual(len(sent_calls), 1)

            # Второй вызов в ту же минуту
            call_command('send_reminders')
            # Количество не должно измениться!
            self.assertEqual(len(sent_calls), 1)
