django-s3direct
===============

Upload files direct to S3 from Django
-------------------------------------

[![Build Status](https://travis-ci.org/bradleyg/django-s3direct.svg?branch=master)](https://travis-ci.org/bradleyg/django-s3direct)
[![PyPi Version](https://pypip.in/v/django-s3direct/badge.png)](https://crate.io/packages/django-s3direct)
[![PyPi Downloads](https://pypip.in/d/django-s3direct/badge.png)](https://crate.io/packages/django-s3direct)

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
        <AllowedOrigin>*</AllowedOrigin>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>GET</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <AllowedHeader>*</AllowedHeader>
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

# Destinations in the following format:
# {destination_key: (path_or_function, auth_test, [allowed_mime_types], permissions, custom_bucket)}
#
# 'destination_key' is the key to use for the 'dest' attribute on your widget or model field
S3DIRECT_DESTINATIONS = {
    # Allow anybody to upload any MIME type
    'misc': ('uploads/misc',),

    # Allow staff users to upload any MIME type
    'files': ('uploads/files', lambda u: u.is_staff,),

    # Allow anybody to upload jpeg's and png's.
    'imgs': ('uploads/imgs', lambda u: True, ['image/jpeg', 'image/png'],),

    # Allow authenticated users to upload mp4's
    'vids': ('uploads/vids', lambda u: u.is_authenticated(), ['video/mp4'],),

    # Allow anybody to upload any MIME type with a custom name function, eg:
    'custom_filename': (lambda original_filename: 'images/unique.jpg',),

    # Specify a non-default bucket for PDFs
    'pdfs': ('/', lambda u: True, ['application/pdf'], None, 'pdf-bucket',),

    # Allow logged in users to upload any type of file and give it a private acl:
    'private': (
        'uploads/vids',
        lambda u: u.is_authenticated(),
        '*',
        'private')

    # Allow authenticated users to upload with cache-control for a month and content-disposition set to attachment
    'cached': (
        'uploads/vids', 
        lambda u: u.is_authenticated(), 
        '*', 
        'public-read', 
        AWS_STORAGE_BUCKET_NAME, 
        'max-age=2592000', 
        'attachment')
}
```

### urls.py

```python
urlpatterns = patterns('',
    url(r'^s3direct/', include('s3direct.urls')),
)
```

Run ```python manage.py collectstatic``` if required.

## Use in Django admin only

### models.py

```python
from django.db import models
from s3direct.fields import S3DirectField

class Example(models.Model):
    video = S3DirectField(dest='destination_key_from_settings')
```

## Use the widget in a custom form

### forms.py

```python
from django import forms
from s3direct.widgets import S3DirectWidget

class S3DirectUploadForm(forms.Form):
    images = forms.URLField(widget=S3DirectWidget(dest='destination_key_from_settings'))
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

$ python manage.py syncdb
$ python manage.py runserver 0.0.0.0:5000
```

Visit ```http://localhost:5000/admin``` to view the admin widget and ```http://localhost:5000/form``` to view the custom form widget.

## Example usage of custom name function
Using the custom name function you can change the name of the uploaded file. With the example bellow you can easily turn the filename into a UUID:

### settings.py
```python
import uuid
import string

def uuidpathext(filename, prefix):
    extension = "." + os.path.splitext(filename)[1][1:]
    filepath = prefix + str(uuid.uuid4()) + extension
    return filepath
    
S3DIRECT_DESTINATIONS = {
    'pdf': (lambda f: uuidpathext(f,"prefixfolder/prefixname"), lambda u: u.is_authenticated(), ['application/pdf'], None, None),
}

```
