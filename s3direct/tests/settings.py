DEBUG = True
DATABASES = {}
DATABASES['default'] = {'ENGINE': 'django.db.backends.sqlite3'}
SECRET_KEY = 'vaO4Y<g#YRWG8;Md8noiLp>.w(w~q_b=|1`?9<x>0KxA%UB!63'
ROOT_URLCONF = 's3direct.urls'
INSTALLED_APPS = ('s3direct',)
AWS_STORAGE_BUCKET_NAME = 'test_bucket'
AWS_SECRET_ACCESS_KEY = 'test_secret'
AWS_ACCESS_KEY_ID = 'test_key'
S3DIRECT_DIR='s3direct'
S3DIRECT_ENDPOINT='s3-eu-west-1.amazonaws.com'
S3DIRECT_UNIQUE_RENAME=True