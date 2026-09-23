from datetime import date
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient
from api.models import UserAll, Habit, Date


class ResetNoteBehaviorTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testrunner', password='password123')
        self.profile = UserAll.objects.create(auth_user=self.user, name='Test Runner')
        self.habit = Habit.objects.create(user=self.profile, name='Exercise')

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_clear_comment_hides_note_without_deleting_history(self):
        """
        Тест бага:
        При сбросе заметки:
        1. Заметка должна исчезнуть с главного экрана (weekly_status -> latest_comment=None).
        2. Текст самой последней заметки в базе данных НЕ должен удаляться.
        3. На главном экране НЕ должна появляться предыдущая заметка.
        """
        # Создаем две заметки в разное время
        date_old = Date.objects.create(
            user=self.profile,
            habit=self.habit,
            habit_date=date(2026, 9, 20),
            is_done=True,
            comment='Предыдущая заметка'
        )
        date_new = Date.objects.create(
            user=self.profile,
            habit=self.habit,
            habit_date=date(2026, 9, 23),
            is_done=True,
            comment='Последняя актуальная заметка'
        )

        # 1. До сброса: на главном экране видна последняя заметка
        res_before = self.client.get('/api/v1/habits/weekly_status/?date=2026-09-23')
        self.assertEqual(res_before.status_code, status.HTTP_200_OK)
        habit_info_before = next(h for h in res_before.data if h['id'] == self.habit.id)
        self.assertEqual(habit_info_before['latest_comment'], 'Последняя актуальная заметка')

        # 2. Вызываем сброс заметки (как при клике "Сбросить заметку" в модалке)
        res_clear = self.client.post('/api/v1/habits/clear_comment/', {'habit_id': self.habit.id}, format='json')
        self.assertEqual(res_clear.status_code, status.HTTP_200_OK)
        self.assertEqual(res_clear.data, {'status': 'cleared'})

        # 3. ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ: Текст заметки в базе данных НЕ УДАЛЕН!
        date_new.refresh_from_db()
        date_old.refresh_from_db()
        self.assertEqual(date_new.comment, 'Последняя актуальная заметка', 'Текст последней заметки должен сохраняться!')
        self.assertEqual(date_old.comment, 'Предыдущая заметка', 'Текст старой заметки должен сохраняться!')

        # 4. ПРОВЕРКА ГЛАВНОГО ЭКРАНА:
        # Заметка исчезла с главного экрана, и предыдущая заметка НЕ всплыла!
        res_after = self.client.get('/api/v1/habits/weekly_status/?date=2026-09-23')
        self.assertEqual(res_after.status_code, status.HTTP_200_OK)
        habit_info_after = next(h for h in res_after.data if h['id'] == self.habit.id)
        self.assertIsNone(habit_info_after['latest_comment'], 'На главном экране заметка должна исчезнуть (быть None)!')
        self.assertIsNone(habit_info_after['latest_comment_details'])

    def test_new_comment_reappears_on_main_screen_after_dismissal(self):
        """
        Если заметка была скрыта, а затем добавлена новая заметка за более позднюю дату,
        она должна снова отображаться на главном экране.
        """
        # Создаем заметку
        Date.objects.create(
            user=self.profile,
            habit=self.habit,
            habit_date=date(2026, 9, 21),
            is_done=True,
            comment='Заметка 1'
        )

        # Сбрасываем с главного экрана
        self.client.post('/api/v1/habits/clear_comment/', {'habit_id': self.habit.id}, format='json')
        res1 = self.client.get('/api/v1/habits/weekly_status/?date=2026-09-21')
        self.assertIsNone(res1.data[0]['latest_comment'])

        # Пользователь добавляет новую заметку через update_status
        self.client.post('/api/v1/habits/update_status/', {
            'habit_id': self.habit.id,
            'date': '2026-09-24',
            'is_done': True,
            'comment': 'Новая свежая заметка'
        }, format='json')

        # Теперь новая заметка отображается на главном экране
        res2 = self.client.get('/api/v1/habits/weekly_status/?date=2026-09-24')
        self.assertEqual(res2.data[0]['latest_comment'], 'Новая свежая заметка')

    def test_editing_dismissed_note_reappears_on_main_screen(self):
        """
        Если пользователь обновил текст скрытой заметки, она снова должна появиться на главном экране.
        """
        Date.objects.create(
            user=self.profile,
            habit=self.habit,
            habit_date=date(2026, 9, 22),
            is_done=True,
            comment='Исходный текст'
        )

        # Сброс
        self.client.post('/api/v1/habits/clear_comment/', {'habit_id': self.habit.id}, format='json')
        res1 = self.client.get('/api/v1/habits/weekly_status/?date=2026-09-22')
        self.assertIsNone(res1.data[0]['latest_comment'])

        # Редактирование этой же даты
        self.client.post('/api/v1/habits/update_status/', {
            'habit_id': self.habit.id,
            'date': '2026-09-22',
            'is_done': True,
            'comment': 'Отредактированный текст'
        }, format='json')

        # Отредактированная заметка снова отображается
        res2 = self.client.get('/api/v1/habits/weekly_status/?date=2026-09-22')
        self.assertEqual(res2.data[0]['latest_comment'], 'Отредактированный текст')
