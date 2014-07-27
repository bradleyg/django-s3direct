import sys
from os import environ

from django.conf import settings


settings.configure(DEBUG=True,
                   DATABASES={
                       'default': {
                           'ENGINE': 'django.db.backends.sqlite3',
                       }
                   },
                   ROOT_URLCONF='s3direct.urls',
                   INSTALLED_APPS=('django.contrib.auth',
                                   'django.contrib.contenttypes',
                                   'django.contrib.sessions',
                                   'django.contrib.admin',
                                   's3direct',),
                   AWS_ACCESS_KEY_ID=environ.get('AWS_ACCESS_KEY_ID', ''),
                   AWS_SECRET_ACCESS_KEY=environ.get(
                                'AWS_SECRET_ACCESS_KEY', ''),
                   AWS_STORAGE_BUCKET_NAME=environ.get(
                                'AWS_STORAGE_BUCKET_NAME',
                                'test-bucket'),
                   S3DIRECT_ENDPOINT='s3.amazonaws.com',
                   S3DIRECT_AUTH_TEST=lambda u: u.is_staff
                   )

from django.test.simple import DjangoTestSuiteRunner
test_runner = DjangoTestSuiteRunner(verbosity=1)
failures = test_runner.run_tests(['s3direct', ])

if failures:
    sys.exit(failures)
