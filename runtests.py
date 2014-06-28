#!/usr/bin/env python
import sys

from os.path import dirname, abspath
from os import environ


def module_exists(module_name):
    try:
        __import__(module_name)
    except ImportError:
        return False
    else:
        return True


from django.conf import settings

if not settings.configured:
    settings.configure(
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3'}},
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'django.contrib.sessions',
            'django.contrib.admin',
            's3direct',
        ],
        ROOT_URLCONF='s3direct.urls',
        AWS_ACCESS_KEY_ID=environ.get('AWS_ACCESS_KEY_ID', ''),
        AWS_SECRET_ACCESS_KEY=environ.get('AWS_SECRET_ACCESS_KEY', ''),
        AWS_STORAGE_BUCKET_NAME=environ.get('AWS_STORAGE_BUCKET_NAME', 'test-storage'),

        MEDIA_URL='https://test-storage.s3.amazonaws.com/',

        USE_I18N=True,
        USE_L10N=True,
        USE_TZ=True,

        S3DIRECT_DESTINATIONS={
            'foo': ('', lambda u: True, ['image/jpeg', 'video/*']),
            'bar': ('bar', lambda u: u.is_staff),
            'baz': ('baz/baz', lambda u: u.is_authenticated())
        },
    )

if module_exists("django.test.runner.Discover"):
    from django.test.runner import DiscoverRunner as Runner
else:
    from django.test.simple import DjangoTestSuiteRunner as Runner


def runtests(*test_args):
    if not test_args:
        test_args = ['s3direct']
    parent = dirname(abspath(__file__))
    sys.path.insert(0, parent)
    failures = Runner().run_tests(test_args, verbosity=1, interactive=True)
    sys.exit(bool(failures))


if __name__ == '__main__':
    runtests(*sys.argv[1:])
