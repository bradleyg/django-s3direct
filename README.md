##Ajax file uploads
  
[https://github.com/bradleyg/django-s3direct](https://github.com/bradleyg/django-s3direct)
  
Add direct uploads to S3 functionality with a progress bar to file input fields within Django admin.

![screenshot](https://raw.github.com/bradleyg/django-s3direct/master/screenshot.png)

```pip install django-s3direct```

```python
# settings.py
S3DIRECT_DIR = 's3direct' # (optional, default is 's3direct')
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
