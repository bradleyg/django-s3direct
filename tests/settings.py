from os import getenv, path

DEBUG = True
TEMPLATE_DEBUG = True
USE_TZ = True
USE_L10N = True

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": "test.db"}}

INSTALLED_APPS = (
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "s3upload",
    "example",
)

MIDDLEWARE = [
    # default django middleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

PROJECT_DIR = path.abspath(path.join(path.dirname(__file__)))

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [path.join(PROJECT_DIR, "templates")],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.contrib.messages.context_processors.messages",
                "django.contrib.auth.context_processors.auth",
                "django.template.context_processors.request",
            ]
        },
    }
]

STATIC_URL = "/static/"

SECRET_KEY = "secret"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "%(levelname)s %(message)s"}},
    "handlers": {
        "console": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
            "formatter": "simple",
        }
    },
    "loggers": {
        "": {"handlers": ["console"], "propagate": True, "level": "DEBUG"},
        # 'django': {
        #     'handlers': ['console'],
        #     'propagate': True,
        #     'level': 'WARNING',
        # },
    },
}

ROOT_URLCONF = "tests.urls"

# used by the example app
def create_filename(filename):
    import uuid

    ext = filename.split(".")[-1]
    filename = "%s.%s" % (uuid.uuid4().hex, ext)
    return path.join("custom", filename)


AWS_ACCESS_KEY_ID = getenv("AWS_ACCESS_KEY_ID", "XXX")
AWS_SECRET_ACCESS_KEY = getenv("AWS_SECRET_ACCESS_KEY", "XXX")
AWS_STORAGE_BUCKET_NAME = getenv("AWS_STORAGE_BUCKET_NAME", "test-bucket")

S3UPLOAD_REGION = "us-east-1"
S3UPLOAD_DESTINATIONS = {
    "misc": {"key": lambda original_filename: "images/unique.jpg"},
    "files": {"key": "uploads/files", "auth": lambda u: u.is_staff},
    "imgs": {
        "key": "uploads/imgs",
        "auth": lambda u: True,
        "allowed_types": ["image/jpeg", "image/png"],
        "content_length_range": (5000, 20000000),  # 5kb - 20mb
        "allowed_extensions": (".jpg", ".jpeg", ".png"),
    },
    "vids": {
        "key": "uploads/vids",
        "auth": lambda u: u.is_authenticated,
        "allowed_types": ["video/mp4"],
    },
    "cached": {
        "key": "uploads/vids",
        "auth": lambda u: True,
        "allowed_types": "*",
        "acl": "authenticated-read",
        "bucket": "astoragebucketname",
        "cache_control": "max-age=2592000",
        "content_disposition": "attachment",
        "server_side_encryption": "AES256",
    },
    # Allow anybody to upload any MIME type with a custom name function
    "custom_filename": {"key": create_filename},
}

if not DEBUG:
    raise Exception("This settings file can only be used with DEBUG=True")
