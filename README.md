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
        <AllowedOrigin>yourdomain.com</AllowedOrigin>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>GET</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <AllowedHeader>*</AllowedHeader>
    </CORSRule>
</CORSConfiguration>
```

If you want to allow file uploads from any domain (unsafe), use: `<AllowedOrigin>*</AllowedOrigin>`

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
# key [required] Where to upload the file to
# auth [optional] An ACL function to whether the current user can perform this action
# allowed [optional] List of allowed MIME types
# acl [optional] Give the object another ACL rather than 'public-read'
# cache_control [optional] Cache control headers, eg 'max-age=2592000'
# content_disposition [optional] Useful for sending files as attachments
# bucket [optional] Specify a different bucket for this particular object
# server_side_encryption [optional] Encryption headers for buckets that require it
#
S3DIRECT_DESTINATIONS = {
    # Allow anybody to upload any MIME type
    'example1': {
        'key': 'uploads/misc',
    },

    # Allow staff users to upload any MIME type
    'example2': {
        'key': 'uploads/files',
        'auth': lambda u: u.is_staff,
    },

    # Limit uploads to jpeg's and png's.
    'example3': {
        'key': 'uploads/imgs',
        'allowed': ['image/jpeg', 'image/png'],
    },

    # Allow authenticated users to upload mp4's
    'example4': {
        'key': 'uploads/vids',
        'auth': lambda u: u.is_authenticated(),
        'allowed': ['video/mp4'],
    },

    # Define a custom filename for the object.
    'example5': {
        'key': lambda original_filename: 'images/unique.jpg',
    },

    # Specify a non-default bucket for this object
    'example6': {
        'key': '/',
        'bucket': 'pdf-bucket',
    },

    # Give the object a private ACL:
    'example7': {
        'key': 'uploads/private',
        'acl': 'private'
    },

    # Set custom cache control and content disposition headers.
    'example8': {
        'key': 'uploads/vids',
        'cache_control': 'max-age=2592000',
        'content_disposition': 'attachment'
    },

    # Limit size of uploads to a min and max size range (in bytes)
    'example9': {
        'content_length_range': (5000, 20000000),
    },

    # Specify encryption header for buckets that require it.
    'example10': {
        'server_side_encryption': 'AES256',
    },
}
```
NOTE: See past README versions for older "positional" style destination settings.

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

__*Optional.__ You can create a custom template by passing in a string with your own HTML to the `html` keyword argument. For example:

```python
from django import forms
from s3direct.widgets import S3DirectWidget

class S3DirectUploadForm(forms.Form):
    images = forms.URLField(widget=S3DirectWidget(
        dest='destination_key_from_settings',
        html=(
            '<div class="s3direct" data-policy-url="{policy_url}">'
            '  <a class="file-link" target="_blank" href="{file_url}">{file_name}</a>'
            '  <a class="file-remove" href="#remove">Remove</a>'
            '  <input class="file-url" type="hidden" value="{file_url}" id="{element_id}" name="{name}" />'
            '  <input class="file-dest" type="hidden" value="{dest}">'
            '  <input class="file-input" type="file" />'
            '  <div class="progress progress-striped active">'
            '    <div class="bar"></div>'
            '  </div>'
            '</div>'
        )))
```

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
