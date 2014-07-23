django-s3direct
===============

Upload files direct to S3 from Django
-------------------------------------

Add direct uploads to AWS S3 functionality with a progress bar to file input fields.

![screenshot](https://raw.githubusercontent.com/bradleyg/django-s3direct/remove-js-deps/screenshot.png)

## Installation

Install with Pip:

```pip install django-s3direct```  

Currently only python 2.7 supported.  

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

# The region endpoint of your bucket, more info:
# http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
S3DIRECT_ENDPOINT = '' 

# Optional, give the uploaded file a uuid filename.
S3DIRECT_UNIQUE_RENAME = False

# Optional, only allow specific users to upload files.
S3DIRECT_AUTH_TEST = lambda u: u.is_staff
```

Run ```python manage.py collectstatic``` if required.  

### urls.py

```python
urlpatterns = patterns('',
    url(r'^s3direct/', include('s3direct.urls')),
)
```

## Use in Django admin only

### models.py

```python
from django.db import models
from s3direct.fields import S3DirectField

class Example(models.Model):
    video = S3DirectField(upload_to='videos')
```

## Use the widget in a custom form outside of admin

### forms.py

```python
from django import forms
from s3direct.widgets import S3DirectWidget

class S3DirectUploadForm(forms.Form):
    images = forms.URLField(widget=S3DirectWidget(upload_to='images'))
```

### views.py 

```python
from django.views.generic import FormView
from .forms import S3DirectUploadForm

class IndexView(FormView):
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
    {{ form.as_p }}
</body>
</html>
```

## Examples
Examples of both approaches can be found in the examples folder. To run them:
```shell
$ git clone git@github.com:bradleyg/django-s3direct.git
$ cd django-s3direct
$ python setup install
$ cd example

# Add your AWS keys to settings.py

$ python manage.py syncdb
$ python manage.py runserver 0.0.0.0:5000
```  

Visit ```http://localhost:5000/admin``` to view the admin widget and ```http://localhost:5000/form``` to view the custom form widget.