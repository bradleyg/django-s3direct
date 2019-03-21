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
    AWS_ACCESS_KEY_ID='123',
    AWS_SECRET_ACCESS_KEY='123',
    AWS_STORAGE_BUCKET_NAME='test-bucket',
    AWS_S3_REGION_NAME='us-east-1',
    AWS_S3_ENDPOINT_URL='https://s3.amazonaws.com',
    S3DIRECT_DESTINATIONS={
        'generic': {
            'key': '/'
        },
        'missing-key': {
            'key': None
        },
        'login-required': {
            'key': '/',
            'auth': lambda u: u.is_staff
        },
        'login-not-required': {
            'key': '/'
        },
        'only-images': {
            'key': '/',
            'allowed': ['image/jpeg', 'image/png']
        },
        'limited-size': {
            'key': '/',
            'content_length_range': (1000, 50000)
        },
        'folder-upload' : {
            'key': 'uploads/folder'
        },
        'accidental-leading-slash': {
            'key': '/uploads/folder'
        },
        'accidental-trailing-slash': {
            'key': 'uploads/folder/'
        },
        'function-object-key': {
            'key': lambda original_filename: 'images/unique.jpg'
        },
        'function-object-key-args': {
            'key': lambda original_filename, args: args + '/' + 'filename.jpg',
            'key_args': 'uploads/folder'
        },
        'function-object-dynamic-key-args': {
            'key': lambda original_filename, args: args + '/' + 'filename.jpg'
        },
        'policy-conditions': {
            'key': '/',
            'auth': is_authenticated,
            'allowed': '*',
            'acl': 'authenticated-read',
            'bucket': 'astoragebucketname',
            'cache_control': 'max-age=2592000',
            'content_disposition': 'attachment',
            'server_side_encryption': 'AES256'
        },
        'allow-existence-optimisation': {
            'key': 'uploads',
            'allow_existence_optimization': True,
        },
        'disallow-existence-optimisation': {
            'key': 'uploads',
            'allow_existence_optimization': False,
        },
        'unset-existence-optimisation': {
            'key': 'uploads',
        },
        'custom-region-bucket': {
            'key': 'uploads',
            'region': 'cn-north-1',
            'endpoint': 'https://s3.cn-north-1.amazonaws.com.cn'
        },
        'optional-content-disposition-callable': {
            'key': '/',
            'content_disposition': lambda x: 'attachment; filename="{}"'.format(x)
        },
        'optional-cache-control-non-callable': {
            'key': '/',
            'cache_control': 'public' 
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
