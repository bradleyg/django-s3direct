"""Tests for s3direct package."""

from os import environ
import sys
from distutils.version import StrictVersion
import django
from django.conf import settings

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
    MIDDLEWARE_CLASSES=(
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
    ),
    AWS_ACCESS_KEY_ID=environ.get('AWS_ACCESS_KEY_ID', ''),
    AWS_SECRET_ACCESS_KEY=environ.get('AWS_SECRET_ACCESS_KEY', ''),
    AWS_STORAGE_BUCKET_NAME=environ.get(
        'AWS_STORAGE_BUCKET_NAME', 'test-bucket'),
    S3DIRECT_REGION='us-east-1',
    S3DIRECT_DESTINATIONS={
        'misc': {
            'key': lambda original_filename: 'images/unique.jpg',
        },
        'files': {
            'key': 'uploads/files',
            'auth': lambda u: u.is_staff,
        },
        'imgs': {
            'key': 'uploads/imgs',
            'auth': lambda u: True,
            'allowed': ['image/jpeg', 'image/png'],
            'content_length_range': (5000, 20000000),  # 5kb - 20mb
        },
        'vids': {
            'key': 'uploads/vids',
            'auth': lambda u: u.is_authenticated(),
            'allowed': ['video/mp4'],
        },
        'cached': {
            'key': 'uploads/vids',
            'auth': lambda u: True,
            'allowed': '*',
            'acl': 'authenticated-read',
            'bucket': 'astoragebucketname',
            'cache_control': 'max-age=2592000',
            'content_disposition': 'attachment',
            'server_side_encryption': 'AES256',
        }
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
