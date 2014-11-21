import os
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

SECRET_KEY = 'd0au$i5he(#ais5@-i@rv=963$a@4d2p2fmnc7(gyc2ecoi^_)'

DEBUG = True
TEMPLATE_DEBUG = DEBUG

ALLOWED_HOSTS = []

INSTALLED_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    's3direct',
    'cat',
)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

ROOT_URLCONF = 'example.urls'
WSGI_APPLICATION = 'example.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = True
USE_TZ = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    }
}

STATIC_ROOT = os.path.join(BASE_DIR, 'static')
STATIC_URL = '/static/'

TEMPLATE_DIRS = (os.path.join(BASE_DIR, 'templates'),)

AWS_ACCESS_KEY_ID = ''
AWS_SECRET_ACCESS_KEY = ''
AWS_STORAGE_BUCKET_NAME = ''
S3DIRECT_REGION = 'us-east-1'


def create_filename(filename):
    import uuid
    ext = filename.split('.')[-1]
    filename = '%s.%s' % (uuid.uuid4().hex, ext)
    return os.path.join('images', filename)


S3DIRECT_DESTINATIONS={
    # Allow anybody to upload any MIME type
    'misc': ('uploads/misc',),

    # Allow staff users to upload any MIME type
    'files': ('uploads/files', lambda u: u.is_staff,),

    # Allow anybody to upload jpeg's and png's.
    'imgs': ('uploads/imgs', lambda u: True, ['image/jpeg', 'image/png'],),

    # Allow authenticated users to upload mp4's
    'vids': ('uploads/vids', lambda u: u.is_authenticated(), ['video/mp4'],),

    # Allow anybody to upload any MIME type with a custom name function
    'custom_filename': (create_filename,),
}
