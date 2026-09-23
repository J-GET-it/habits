from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import Achievement, Category, Date, UserAll, Habit, ReminderSettings, PushSubscription


class CategorySerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        min_length=2,
        max_length=20,
        error_messages={
            "min_length": "Название категории должно содержать минимум 2 символа.",
            "max_length": "Название категории не должно превышать 20 символов."
        }
    )

    class Meta:
        model = Category
        fields = ('id', 'user', 'name', 'slug', 'order', 'is_archived')
        read_only_fields = ('id', 'user', 'slug')


class HabitSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.none(), required=False, allow_null=True
    )
    category_name = serializers.SerializerMethodField()
    category_slug = serializers.SerializerMethodField()
    start_date = serializers.DateField(required=False, allow_null=True)
    target_type = serializers.CharField(required=False)

    class Meta:
        model = Habit
        fields = ('id', 'user', 'name', 'category', 'category_name', 'category_slug', 'slug', 'order', 'is_archived', 'start_date', 'target_type', 'use_target', 'completion_target', 'quantity_target', 'dismissed_comment_date')
        read_only_fields = ('id', 'user', 'slug')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            user_profile, _ = UserAll.objects.get_or_create(
                auth_user=request.user,
                defaults={'name': request.user.username, 'age': ''}
            )
            self.fields['category'].queryset = Category.objects.filter(user=user_profile)

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None

    def get_category_slug(self, obj):
        return obj.category.slug if obj.category else None


class UserAllSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAll
        fields = '__all__'


class DateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Date
        fields = '__all__'  # Includes quantity field
        read_only_fields = ('id', 'slug', 'name')

class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = '__all__'


# Authentication serializers
class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для отображения и редактирования данных пользователя"""
    age = serializers.CharField(source='user_profile.age', allow_blank=True, required=False)
    date_of_birth = serializers.DateField(source='user_profile.date_of_birth', allow_null=True, required=False)
    profile_photo = serializers.ImageField(source='user_profile.profile_photo', allow_null=True, required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'age', 'date_of_birth', 'profile_photo')
        read_only_fields = ('id',)

    def validate_age(self, value):
        if value:
            try:
                age_int = int(value)
                if age_int < 0 or age_int > 150:
                    raise serializers.ValidationError("Возраст должен быть от 0 до 150 лет.")
            except ValueError:
                raise serializers.ValidationError("Возраст должен быть числом.")
        return value

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('user_profile', {})
        age = profile_data.get('age')
        date_of_birth = profile_data.get('date_of_birth')
        profile_photo = profile_data.get('profile_photo')

        # Update User model
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update UserAll model
        profile = instance.user_profile
        if age is not None:
            profile.age = age
        if date_of_birth is not None:
            profile.date_of_birth = date_of_birth
        if profile_photo is not None:
            profile.profile_photo = profile_photo
        profile.name = instance.username # Keep sync if needed
        profile.save()

        return instance


class RegisterSerializer(serializers.ModelSerializer):
    """Сериализатор для регистрации нового пользователя"""
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password2 = serializers.CharField(
        write_only=True, 
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'first_name', 'last_name')
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Пароли не совпадают"}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """Сериализатор для входа в систему"""
    username = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True, 
        write_only=True,
        style={'input_type': 'password'}
    )


class ReminderSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReminderSettings
        fields = ('enabled', 'text', 'times', 'time_zone')

class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ('endpoint', 'p256dh', 'auth')