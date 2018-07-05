"""Tests for s3upload package."""

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
    ROOT_URLCONF='s3upload.urls',
    INSTALLED_APPS=(
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.admin',
        's3upload',
    ),
    MIDDLEWARE=(
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
    AWS_ACCESS_KEY_ID=environ.get('AWS_ACCESS_KEY_ID', ''),
    AWS_SECRET_ACCESS_KEY=environ.get('AWS_SECRET_ACCESS_KEY', ''),
    AWS_STORAGE_BUCKET_NAME=environ.get(
        'AWS_STORAGE_BUCKET_NAME', 'test-bucket'),
    S3UPLOAD_REGION='us-east-1',
    S3UPLOAD_DESTINATIONS={
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
            'allowed_types': ['image/jpeg', 'image/png'],
            'content_length_range': (5000, 20000000),  # 5kb - 20mb
            'allowed_extensions': ('.jpg', '.jpeg', '.png'),
        },
        'vids': {
            'key': 'uploads/vids',
            'auth': lambda u: u.is_authenticated,
            'allowed_types': ['video/mp4'],
        },
        'cached': {
            'key': 'uploads/vids',
            'auth': lambda u: True,
            'allowed_types': '*',
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

failures = test_runner.run_tests(['s3upload', ])

if failures:
    sys.exit(failures)
