django-s3direct
===============

Upload files direct to S3 from Django
-------------------------------------
  
  
Add direct uploads to AWS S3 functionality with a progress bar to file input fields within Django admin.

![screenshot](https://raw.github.com/bradleyg/django-s3direct/master/screenshot.png)


## Installation

Install with Pip:

```pip install django-s3direct```


Update Django files:

```python
# settings.py
INSTALLED_APPS = [
    ...
    's3direct',
    ...
]
S3DIRECT_DIR = 's3direct' # (optional, default is 's3direct')
AWS_SECRET_ACCESS_KEY = ''
AWS_ACCESS_KEY_ID = ''
AWS_STORAGE_BUCKET_NAME = ''
```
  
```python
# urls.py
urlpatterns = patterns('',
    url(r'^s3direct/', include('s3direct.urls')),
)
```
  
```python
# models.py
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
