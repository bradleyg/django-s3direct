#!/usr/bin/env python
import sys

from os.path import dirname, abspath


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
            's3direct',
        ],
        ROOT_URLCONF='s3direct.urls'
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
