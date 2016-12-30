django-s3direct
===============

Upload files directly to S3 from Django
-------------------------------------

[![Build Status](https://travis-ci.org/bradleyg/django-s3direct.svg?branch=master)](https://travis-ci.org/bradleyg/django-s3direct)

Add direct uploads to AWS S3 functionality with a progress bar to file input fields.

![screenshot](https://raw.githubusercontent.com/bradleyg/django-s3direct/master/screenshot.png)

## Support
Python 2/3
Chrome / Safari / Firefox / IE10+

For older browser support use version 0.1.10.

## Installation

Install with Pip:

```pip install django-s3direct```

## S3 Setup

Setup a CORS policy on your S3 bucket.

```xml
<CORSConfiguration>
    <CORSRule>
        <AllowedOrigin>http://yourdomain.com:8080</AllowedOrigin>
        <AllowedMethod>POST</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
    </CORSRule>
</CORSConfiguration>
```

## Django Setup

### settings.py

```python
INSTALLED_APPS = [
    ...
    's3direct',
    ...
]

# AWS keys
AWS_SECRET_ACCESS_KEY = ''
AWS_ACCESS_KEY_ID = ''
AWS_STORAGE_BUCKET_NAME = ''

# The region of your bucket, more info:
# http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
S3DIRECT_REGION = 'us-east-1'

# Destinations, with the following keys:
#
# key [required] Where to upload the file to, can be either:
#     1. '/' = Upload to root with the original filename.
#     2. 'some/path' = Upload to some/path with the original filename.
#     3. functionName = Pass a function and create your own path/filename.
# auth [optional] An ACL function to whether the current user can perform this action
# allowed [optional] List of allowed MIME types
# acl [optional] Give the object another ACL rather than 'public-read'
# cache_control [optional] Cache control headers, eg 'max-age=2592000'
# content_disposition [optional] Useful for sending files as attachments
# bucket [optional] Specify a different bucket for this particular object
# server_side_encryption [optional] Encryption headers for buckets that require it
#
S3DIRECT_DESTINATIONS = {
    'example1': {
        'key': 'uploads/images',
        'auth': lambda u: u.is_staff,
        'allowed': ['image/jpeg', 'image/png', video/mp4],
        'key': lambda orig_name: 'images/%s-v1.jpg' % orig_name,
        'bucket': 'pdf-bucket',
        'acl': 'private',
        'cache_control': 'max-age=2592000',
        'content_disposition': 'attachment'
        'content_length_range': (5000, 20000000),
        'server_side_encryption': 'AES256',
    }
}
```

### urls.py

```python
urlpatterns = [
    url(r'^s3direct/', include('s3direct.urls')),
]
```

Run ```python manage.py collectstatic``` if required.

## Use in Django admin

### models.py

```python
from django.db import models
from s3direct.fields import S3DirectField

class Example(models.Model):
    video = S3DirectField(dest='example1')
```

## Use the widget in a custom form

### forms.py

```python
from django import forms
from s3direct.widgets import S3DirectWidget

class S3DirectUploadForm(forms.Form):
    images = forms.URLField(widget=S3DirectWidget(dest='example2'))
```

__*Optional.__ You modify the HTML of the widget by overiding template _s3direct/templates/s3direct-widget.tpl_

### views.py

```python
from django.views.generic import FormView
from .forms import S3DirectUploadForm

class MyView(FormView):
    template_name = 'form.html'
    form_class = S3DirectUploadForm
```

### templates/form.html

```html
<html>
<head>
    <meta charset="utf-8">
    <title>s3direct</title>
    {{ form.media }}
</head>
<body>
    <form action="" method="post">{% csrf_token %}
        {{ form.as_p }}
    </form>
</body>
</html>
```

## Examples
Examples of both approaches can be found in the examples folder. To run them:
```shell
$ git clone git@github.com:bradleyg/django-s3direct.git
$ cd django-s3direct
$ python setup.py install
$ cd example

# Add your AWS keys to settings.py

$ python manage.py migrate
$ python manage.py createsuperuser
$ python manage.py runserver 0.0.0.0:5000
```

Visit ```http://localhost:5000/admin``` to view the admin widget and ```http://localhost:5000/form``` to view the custom form widget.
