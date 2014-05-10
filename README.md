[![Build Status](https://travis-ci.org/bradleyg/django-s3direct.svg?branch=master)](https://travis-ci.org/bradleyg/django-s3direct)
[![PyPi Version](https://pypip.in/v/django-s3direct/badge.png)](https://crate.io/packages/django-s3direct)
[![PyPi Downloads](https://pypip.in/d/django-s3direct/badge.png)](https://crate.io/packages/django-s3direct)
[![License](https://pypip.in/license/django-s3direct/badge.png)](https://crate.io/packages/django-s3direct)

django-s3direct
===============

Upload files direct to S3 from Django
-------------------------------------

S3Direct is a collection of django widgets that upload a file directly to AWS S3 and return ether a URL or Django File object.

![screenshot](https://raw.github.com/bradleyg/django-s3direct/master/screenshot.png)


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

### Settings.py  

```python
INSTALLED_APPS = [
    ...
    's3direct',
    ...
]

AWS_SECRET_ACCESS_KEY = ''  # (required)
AWS_ACCESS_KEY_ID = ''  # (required)
AWS_STORAGE_BUCKET_NAME = ''  # (required)
S3DIRECT_DESTINATIONS = {'profile_picture': ('path/to/dir', lambda u: u.is_authenticated)} # (required, dictionary containing named Tuples('path', user_function).
S3DIRECT_ENDPOINT = ''  # (optional, http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region)
S3DIRECT_UNIQUE_RENAME = False  # (optional, default is 'False', gives the uploaded file a unique filename)
```

### urls.py

```python
urlpatterns = patterns('',
    url(r'^s3direct/', include('s3direct.urls')),
)
```

### forms.py


```python
from django import forms
from s3direct.widgets import S3DirectFileWidget

class Example(forms.Form):
    image = forms.ImageField(widget=S3DirectFileWidget(upload_to='profile'))
    pdf_url = forms.URLField(widget=S3DirectURLWidget(upload_to='profile'))
    # 'upload_to' is a required argument
```