"""Tests for s3direct package."""

import sys
import django
from django.conf import settings
from django.test.utils import get_runner

settings.configure(
    SECRET_KEY='test-key',
    DEBUG=True,
    DATABASES={'default': {
        'ENGINE': 'django.db.backends.sqlite3',
    }},
    ROOT_URLCONF='s3direct.urls',
    INSTALLED_APPS=(
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.admin',
        'django.contrib.messages',
        's3direct',
    ),
    MIDDLEWARE=(
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
        'django.contrib.messages.middleware.MessageMiddleware',
    ),
    TEMPLATES=[
        {
            'BACKEND': 'django.template.backends.django.DjangoTemplates',
            'APP_DIRS': True,
            'OPTIONS': {
                'context_processors': [
                    'django.template.context_processors.request',
                    "django.contrib.auth.context_processors.auth",
                    'django.contrib.messages.context_processors.messages',
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
        'folder-upload': {
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
        'policy-conditions': {
            'key': '/',
            'auth': lambda user: user.is_authenticated,
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
            'content_disposition':
            lambda x: 'attachment; filename="{}"'.format(x)
        },
        'optional-cache-control-non-callable': {
            'key': '/',
            'cache_control': 'public'
        }
    })

django.setup()

TestRunner = get_runner(settings)
test_runner = TestRunner()

failures = test_runner.run_tests(['s3direct'])
sys.exit(bool(failures))
