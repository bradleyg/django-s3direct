django-s3direct
===============

Upload files direct to S3 from Django
-------------------------------------


Add direct uploads to AWS S3 functionality with a progress bar to file input fields within Django admin.

![screenshot](https://raw.github.com/bradleyg/django-s3direct/master/screenshot.png)


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

### Settings.py  

```python
INSTALLED_APPS = [
    ...
    's3direct',
    ...
]

AWS_SECRET_ACCESS_KEY = ''
AWS_ACCESS_KEY_ID = ''
AWS_STORAGE_BUCKET_NAME = ''
S3DIRECT_ENDPOINT = '' # http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
S3DIRECT_DIR = 's3direct' # (optional, default is 's3direct', location within the bucket to upload files)
S3DIRECT_UNIQUE_RENAME = False # (optional, default is 'False', gives the uploaded file a unique filename)
```

### urls.py

```python
urlpatterns = patterns('',
    url(r'^s3direct/', include('s3direct.urls')),
)
```

### models.py


```python
from django.db import models
from s3direct.fields import S3DirectField

class Example(models.Model):
    thumbnail = S3DirectField(upload_to='s3direct')
    # 'upload_to' is an optional argument
```

You may need to run `collectstatic` before `s3direct` will work correctly on your public website:

```bash
python manage.py collectstatic
````

[![Build Status](https://secure.travis-ci.org/bradleyg/django-s3direct.png)](http://travis-ci.org/bradleyg/django-s3direct) 