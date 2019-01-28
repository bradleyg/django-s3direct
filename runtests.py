"""Tests for s3direct package."""

from os import environ
import sys
from distutils.version import StrictVersion
import django
from django.conf import settings


def is_authenticated(user):
    if callable(user.is_authenticated):  # Django =< 1.9
        return user.is_authenticated()
    return user.is_authenticated


settings.configure(
    DEBUG=True,
    DATABASES={
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
        }
    },
    ROOT_URLCONF='s3direct.urls',
    INSTALLED_APPS=(
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.admin',
        's3direct',
    ),
    MIDDLEWARE=(
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
    ),
    MIDDLEWARE_CLASSES=(
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
    ),
    TEMPLATES=[
        {
            'BACKEND': 'django.template.backends.django.DjangoTemplates',
            'APP_DIRS': True,
            'OPTIONS': {
                'context_processors': [
                    "django.contrib.auth.context_processors.auth",
                ]
            }
        },
    ],
    AWS_ACCESS_KEY_ID=environ.get('AWS_ACCESS_KEY_ID', '123'),
    AWS_SECRET_ACCESS_KEY=environ.get('AWS_SECRET_ACCESS_KEY', '123'),
    AWS_STORAGE_BUCKET_NAME=environ.get(
        'AWS_STORAGE_BUCKET_NAME', 'test-bucket'),
    S3DIRECT_REGION='us-east-1',
    S3DIRECT_DESTINATIONS={
        'misc': {
            'key': lambda original_filename: 'images/unique.jpg'
        },
        'files': {
            'key': '/',
            'auth': lambda u: u.is_staff
        },
        'protected': {
            'key': '/',
            'auth': lambda u: u.is_staff
        },
        'not_protected': {
            'key': '/',
        },
        'imgs': {
            'key': 'uploads/imgs',
            'allowed': ['image/jpeg', 'image/png']
        },
        'thumbs': {
            'key': 'uploads/thumbs',
            'allowed': ['image/jpeg'],
            'content_length_range': (1000, 50000)
        },
        'vids': {
            'key': 'uploads/vids',
            'auth': is_authenticated,
            'allowed': ['video/mp4']
        },
        'cached': {
            'key': 'uploads/vids',
            'auth': is_authenticated,
            'allowed': '*',
            'acl': 'authenticated-read',
            'bucket': 'astoragebucketname',
            'cache_control': 'max-age=2592000',
            'content_disposition': 'attachment',
            'server_side_encryption': 'AES256'
        },
        'accidental-leading-slash': {
            'key': '/directory/leading'
        },
        'accidental-trailing-slash': {
            'key': 'directory/trailing/'
        },
        'region-cn': {
            'key': 'uploads/vids',
            'region': 'cn-north-1'
        },
        'region-eu': {
            'key': 'uploads/vids',
            'region': 'eu-west-1'
        },
        'region-default': {
            'key': 'uploads/vids'
        },
        'key_args': {
            'key': lambda original_filename, args: args + '/' + 'background.jpg',
            'key_args': 'assets/backgrounds'
        },
    }
)

if hasattr(django, 'setup'):
    django.setup()

if django.get_version() < StrictVersion('1.6'):
    from django.test.simple import DjangoTestSuiteRunner
    test_runner = DjangoTestSuiteRunner(verbosity=1)
else:
    from django.test.runner import DiscoverRunner
    test_runner = DiscoverRunner(verbosity=1)

failures = test_runner.run_tests(['s3direct', ])

if failures:
    sys.exit(failures)
