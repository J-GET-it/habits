from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify
from django.core.validators import MinLengthValidator, MaxValueValidator, MinValueValidator


def unique_slugify(instance, slug):
    model = instance.__class__
    unique_slug = slug
    num = 1
    while model.objects.filter(slug=unique_slug).exclude(id=instance.id).exists():
        unique_slug = f'{slug}-{num}'
        num += 1
    return unique_slug


class UserAll(models.Model):
    auth_user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="user_profile",
        null=True,
        blank=True,
        verbose_name="Пользователь Django"
    )
    
    name = models.CharField(
        max_length=100,
        verbose_name="Название"
    )

    age = models.CharField(
        max_length=100,
        verbose_name="Возраст",
        blank=True
    )

    date_of_birth = models.DateField(
        verbose_name="Дата рождения",
        null=True,
        blank=True
    )

    profile_photo = models.ImageField(
        upload_to='profile_photos/',
        verbose_name="Фото профиля",
        null=True,
        blank=True
    )

    slug = models.SlugField(
        unique=True,
        verbose_name="Слаг",
        max_length=100,
        blank=True,
    )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slugify(self, slugify(self.name))
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"


class Category(models.Model):
    user = models.ForeignKey(
        UserAll,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(
        max_length=20,
        validators=[MinLengthValidator(2)],
        verbose_name="Название",
    )
    slug = models.SlugField(
        verbose_name="Слаг",
        max_length=100,
        blank=True,
    )
    
    order = models.IntegerField(
        default=0,
        verbose_name="Порядок",
    )

    is_archived = models.BooleanField(
        default=False,
        verbose_name="В архиве",
    )

    created_at = models.DateField(
        auto_now_add=True,
        verbose_name="Дата создания",
        null=True,
        blank=True,
    )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slugify(self, slugify(self.name))
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"
        unique_together = (('user', 'name'), ('user', 'slug'))
        ordering = ['order']


class Habit(models.Model):
    user = models.ForeignKey(
        UserAll,
        on_delete=models.CASCADE,
        related_name="habit",
    )
    name = models.CharField(
        max_length=100,
        verbose_name="Название",
    )
    category_old = models.CharField(
        max_length=20,
        choices=[
            ('Soul', 'Душа'),
            ('Personal', 'Личное'),
            ('Work', 'Работа'),
        ],
        default='Personal',
        verbose_name="Старая категория"
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="habits",
        verbose_name="Категория"
    )

    slug = models.SlugField(
        unique=True,
        verbose_name="Слаг",
        max_length=100,
        blank=True,
    )

    order = models.IntegerField(
        default=0,
        verbose_name="Порядок",
    )

    is_archived = models.BooleanField(
        default=False,
        verbose_name="В архиве",
    )

    created_at = models.DateField(
        auto_now_add=True,
        verbose_name="Дата создания",
        null=True,
        blank=True,
    )

    TARGET_TYPE_CHOICES = [
        ('at_least', 'Не менее (светло-зеленая)'),
        ('less_or_equal', 'Не более (зеленая)'),
    ]

    target_type = models.CharField(
        max_length=20,
        choices=TARGET_TYPE_CHOICES,
        default='at_least',
        verbose_name="Тип цели",
        help_text="Тип цели привычки: не менее (светло-зеленая) или не более (зеленая)"
    )

    start_date = models.DateField(
        verbose_name="Дата начала",
        help_text="Дата создания привычки (можно изменить)",
        null=True,
        blank=True
    )

    use_target = models.BooleanField(
        default=False,
        verbose_name="Использовать цель",
    )
    completion_target = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Цель выполнения",
        help_text="Целевое количество дней выполнения в месяц"
    )
    quantity_target = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Цель количества",
        help_text="Целевое количество действий (например, страниц) в месяц"
    )
    dismissed_comment_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Дата скрытой заметки",
        help_text="Заметки до этой даты включительно не показываются на главном экране"
    )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slugify(self, slugify(self.name))
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

    class Meta:
        verbose_name = "Привычка"
        verbose_name_plural = "Привычки"
        ordering = ['order']


class Date(models.Model):
    user = models.ForeignKey(
        UserAll,
        on_delete=models.CASCADE,
        related_name="date",
    )
    habit = models.ForeignKey(
        Habit,
        on_delete=models.CASCADE,
        related_name="date",
    )
    habit_date = models.DateField(
        max_length=100,
        verbose_name="Дата привычки",
    )
    name = models.CharField(
        max_length=100,
        verbose_name="Название",
        blank=True,
    )

    slug = models.SlugField(
        unique=True,
        verbose_name="Слаг",
        max_length=100,
        blank=True,
    )

    is_done = models.BooleanField(
        verbose_name="Сделано",
        default=False
    )
    is_restored = models.BooleanField(
        verbose_name="Восполнено",
        default=False
    )

    quantity = models.IntegerField(
        verbose_name="Количество",
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(999)],
        help_text="Количество выполненных действий (например, 30 отжиманий)"
    )

    comment = models.TextField(
        verbose_name="Комментарий",
        blank=True,
        null=True
    )

    photo = models.ImageField(
        verbose_name="Фото",
        upload_to="habit_photos/",
        blank=True,
        null=True
    )

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = f"{self.habit.name} - {self.habit_date}"
        if not self.slug:
            self.slug = unique_slugify(self, slugify(self.name))
        if self.comment and self.comment.strip():
            if self.habit.dismissed_comment_date and self.habit_date >= self.habit.dismissed_comment_date:
                self.habit.dismissed_comment_date = None
                self.habit.save(update_fields=['dismissed_comment_date'])
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

    class Meta:
        verbose_name = "Дата"
        verbose_name_plural = "Даты"
        unique_together = ('user', 'habit', 'habit_date')


class Achievement(models.Model):
    user = models.ManyToManyField(
        UserAll,
        related_name="achievement",
        )
    name = models.CharField(
        max_length=100,
        verbose_name="Название",
    )

    slug = models.SlugField(
        unique=True,
        verbose_name="Слаг",
        max_length=100,
    )
    def __str__(self) -> models.CharField:
        return self.name

    class Meta:
        verbose_name = "Ачивка"
        verbose_name_plural = "Ачивки"

class ReminderSettings(models.Model):
    user = models.OneToOneField(UserAll, on_delete=models.CASCADE, related_name='reminder_settings')
    enabled = models.BooleanField(default=False)
    text = models.CharField(max_length=255, default='Не забудьте отметить привычки!', verbose_name="Текст напоминания")
    # Список времен в формате ["09:00", "18:00"]
    times = models.JSONField(default=list, verbose_name="Время напоминаний")
    time_zone = models.CharField(max_length=64, default='UTC', verbose_name="Часовой пояс")
    last_sent_date = models.DateField(null=True, blank=True, verbose_name="Дата последней отправки")
    last_sent_times = models.JSONField(default=list, blank=True, verbose_name="Отправленные времена за дату")
    
    class Meta:
        verbose_name = "Настройки напоминаний"
        verbose_name_plural = "Настройки напоминаний"

class PushSubscription(models.Model):
    user = models.ForeignKey(UserAll, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.URLField(max_length=500)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Подписка на пуш"
        verbose_name_plural = "Подписки на пуш"
        