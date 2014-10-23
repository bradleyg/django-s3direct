import sys
import os
from os import environ

import django
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
                   MIDDLEWARE_CLASSES=('django.contrib.sessions.middleware.SessionMiddleware',
                                       'django.contrib.auth.middleware.AuthenticationMiddleware',),
                   AWS_ACCESS_KEY_ID=environ.get('AWS_ACCESS_KEY_ID', ''),
                   AWS_SECRET_ACCESS_KEY=environ.get(
                                'AWS_SECRET_ACCESS_KEY', ''),
                   AWS_STORAGE_BUCKET_NAME=environ.get(
                                'AWS_STORAGE_BUCKET_NAME',
                                'test-bucket'),
                   S3DIRECT_REGION='us-east-1',
                   S3DIRECT_DESTINATIONS={
                       'misc': (lambda original_filename: 'images/unique.jpg',),
                       'files': ('uploads/files', lambda u: u.is_staff,),
                       'imgs': ('uploads/imgs', lambda u: True, ['image/jpeg', 'image/png'],),
                       'vids': ('uploads/vids', lambda u: u.is_authenticated(), ['video/mp4'],)
                   })

if hasattr(django, 'setup'):
  django.setup()

if django.get_version() < '1.6':
  from django.test.simple import DjangoTestSuiteRunner
  test_runner = DjangoTestSuiteRunner(verbosity=1)
else:
  from django.test.runner import DiscoverRunner
  test_runner = DiscoverRunner(verbosity=1)

failures = test_runner.run_tests(['s3direct', ])

if failures:
    sys.exit(failures)
