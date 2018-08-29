django-s3-upload
================

Compatibility
-------------

This library is now Python3 and Django1.11 and above only.

Upload files directly to S3 from Django
-------------------------------------

[![Build Status](https://travis-ci.org/yunojuno/django-s3upload.svg?branch=master)](https://travis-ci.org/yunojuno/django-s3upload)

This project allows direct uploading of a file from the browser to AWS S3 via a file input field rendered by Django.

The uploaded file's URL is then saveable as the value of that field in the database.

This avoids the problem of uploads timing out when they go via a web server before being handed off to S3.

Features include:

* displaying a progress bar
* support for ACLs (eg, private uploads)
* support for encrypted-at-rest S3 buckets
* mimetype and file extension whitelisting
* specifying different bucket destinations on a per-field basis

## Installation

Install with Pip:

```pip install django-s3-upload```

## AWS Setup

### Access Credentials

You have two options of providing access to AWS resources:

1. Add credentials of an IAM user to your Django settings (see below)
2. Use the EC2 instance profile and its attached IAM role

Whether you are using an IAM user or a role, there needs to be an IAM policy
in effect that grants permission to upload to S3:

```json
"Statement": [
  {
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:PutObjectAcl"],
    "Resource": "arn:aws:s3:::your-bucket-name/*"
  }
]
```

If the instance profile is to be used, the IAM role needs to have a
Trust Relationship configuration applied:

```json
"Statement": [
	{
		"Effect": "Allow",
		"Principal": {
			"Service": "ec2.amazonaws.com"
		},
		"Action": "sts:AssumeRole"
	}
]
```

Note that in order to use the EC2 instance profile, django-s3-upload needs
to query the EC2 instance metadata using utility functions from the
[botocore] [] package. You already have `botocore` installed if `boto3`
is a dependency of your project.

### S3 CORS

Setup a CORS policy on your S3 bucket.

```xml
<CORSConfiguration>
    <CORSRule>
        <AllowedOrigin>http://yourdomain.com:8080</AllowedOrigin>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
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
    's3upload',
    ...
]

TEMPLATES = [{
    ...
    'APP_DIRS': True,
    ...
}]

# AWS

# If these are not defined, the EC2 instance profile and IAM role are used.
# This requires you to add boto3 (or botocore, which is a dependency of boto3)
# to your project dependencies.
AWS_ACCESS_KEY_ID = ''
AWS_SECRET_ACCESS_KEY = ''

AWS_STORAGE_BUCKET_NAME = ''

# The region of your bucket, more info:
# http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
S3UPLOAD_REGION = 'us-east-1'

# Destinations, with the following keys:
#
# key [required] Where to upload the file to, can be either:
#     1. '/' = Upload to root with the original filename.
#     2. 'some/path' = Upload to some/path with the original filename.
#     3. functionName = Pass a function and create your own path/filename.
# auth [optional] An ACL function to whether the current Django user can perform this action.
# allowed [optional] List of allowed MIME types.
# acl [optional] Give the object another ACL rather than 'public-read'.
# cache_control [optional] Cache control headers, eg 'max-age=2592000'.
# content_disposition [optional] Useful for sending files as attachments.
# bucket [optional] Specify a different bucket for this particular object.
# server_side_encryption [optional] Encryption headers for buckets that require it.

S3UPLOAD_DESTINATIONS = {
    'example_destination': {
        # REQUIRED
        'key': 'uploads/images',

        # OPTIONAL
        'auth': lambda u: u.is_staff, # Default allow anybody to upload
        'allowed_types': ['image/jpeg', 'image/png', 'video/mp4'],  # Default allow all mime types
        'allowed_extensions': ('.jpg', '.jpeg', '.png'), # Defaults to all extensions
        'bucket': 'pdf-bucket', # Default is 'AWS_STORAGE_BUCKET_NAME'
        'acl': 'private', # Defaults to 'public-read'
        'cache_control': 'max-age=2592000', # Default no cache-control
        'content_disposition': 'attachment',  # Default no content disposition
        'content_length_range': (5000, 20000000), # Default allow any size
        'server_side_encryption': 'AES256', # Default no encryption
    }
}
```

### urls.py

```python
urlpatterns = [
    url(r'^s3upload/', include('s3upload.urls')),
]
```

Run ```python manage.py collectstatic``` if required.

## Use in Django admin

### models.py

```python
from django.db import models
from s3upload.fields import S3UploadField

class Example(models.Model):
    video = S3UploadField(dest='example_destination')
```

## Use the widget in a custom form

### forms.py

```python
from django import forms
from s3upload.widgets import S3UploadWidget

class S3UploadForm(forms.Form):
    images = forms.URLField(widget=S3UploadWidget(dest='example_destination'))
```

__*Optional.__ You can modify the HTML of the widget by overiding template __s3direct/templates/s3direct-widget.tpl__

### views.py

```python
from django.views.generic import FormView
from .forms import S3UploadForm

class MyView(FormView):
    template_name = 'form.html'
    form_class = S3UploadForm
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
$ git clone git@github.com:yunojuno/django-s3-upload.git
$ cd django-s3-upload

# Add your AWS keys to your environment
export AWS_ACCESS_KEY_ID='...'
export AWS_SECRET_ACCESS_KEY='...'
export AWS_STORAGE_BUCKET_NAME='...'
export S3DIRECT_REGION='...'    # e.g. 'eu-west-1'

$ docker-compose up
```

Visit ```http://localhost:8000/admin``` to view the admin widget and ```http://localhost:8000/form``` to view the custom form widget.

[botocore]: https://github.com/boto/botocore
