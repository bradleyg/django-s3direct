django-s3direct
===============

Upload files directly to S3 from Django
-------------------------------------

[![Build Status](https://travis-ci.org/bradleyg/django-s3direct.svg?branch=master)](https://travis-ci.org/bradleyg/django-s3direct)

Add direct uploads to AWS S3 functionality with a progress bar to file input fields.

<img src="https://raw.githubusercontent.com/bradleyg/django-s3direct/master/screenshot.png" width="381"/>

## Installation

Install with Pip:

```pip install django-s3direct```

## AWS Setup

### Access Credentials

You have two options of providing access to AWS resources:

1. Add credentials of an IAM user to your Django settings
2. Use the EC2 instance profile and its attached IAM role

Whether you are using an IAM user or a role, there needs to be an IAM policy
in effect that grants permission to upload to S3. Remember to swap out __YOUR_BUCKET_NAME__ for your bucket.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:ListMultipartUploadParts",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

If the instance profile is to be used, the IAM role needs to have a
Trust Relationship configuration applied:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Note that in order to use the EC2 instance profile, django-s3direct needs
to query the EC2 instance metadata using utility functions from the
[botocore](https://github.com/boto/botocore) package. You already have `botocore` installed if `boto3`
is a dependency of your project.

### S3 CORS

Setup a CORS policy on your S3 bucket. Note the ETag header is particularly
important as it is used for multipart uploads by EvaporateJS. For more information
see [here](https://github.com/TTLabs/EvaporateJS/wiki/Configuring-The-AWS-S3-Bucket). Remember to swap out YOURDOMAIN.COM for your domain, including port if developing locally.

If using Digital Ocean Spaces you must upload the CORs config via the API. See [here](https://www.digitalocean.com/community/questions/why-can-i-use-http-localhost-port-with-cors-in-spaces)
for more details.

```xml
<CORSConfiguration>
    <CORSRule>
        <AllowedOrigin>http://YOURDOMAIN.COM:8080</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <ExposeHeader>ETag</ExposeHeader>
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

TEMPLATES = [{
    ...
    'APP_DIRS': True,
    ...
}]

# AWS

# If these are set to None, the EC2 instance profile and IAM role are used.
# This requires you to add boto3 (or botocore, which is a dependency of boto3)
# to your project dependencies.
AWS_ACCESS_KEY_ID = 'your-aws-access-key-id'
AWS_SECRET_ACCESS_KEY = 'your-aws-secret-access-key'
AWS_STORAGE_BUCKET_NAME = 'your-aws-s3-bucket-name'

# The region of your bucket, more info:
# http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
AWS_S3_REGION_NAME = 'eu-west-1'

# The endpoint of your bucket, more info:
# http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
AWS_S3_ENDPOINT_URL = 'https://s3-eu-west-1.amazonaws.com'

# Destinations, with the following keys:
#
# key [required] Where to upload the file to, can be either:
#     1. '/' = Upload to root with the original filename.
#     2. 'some/path' = Upload to some/path with the original filename.
#     3. functionName = Pass a function and create your own path/filename.
# key_args [optional] Arguments to be passed to 'key' if it's a function.
# auth [optional] An ACL function to whether the current Django user can perform this action.
# allowed [optional] List of allowed MIME types.
# acl [optional] Give the object another ACL rather than 'public-read'.
# cache_control [optional] Cache control headers, eg 'max-age=2592000'.
# content_disposition [optional] Useful for sending files as attachments.
# bucket [optional] Specify a different bucket for this particular object.
# server_side_encryption [optional] Encryption headers for buckets that require it.

S3DIRECT_DESTINATIONS = {
    'example_destination': {
        # REQUIRED
        'key': 'uploads/images',

        # OPTIONAL
        'auth': lambda u: u.is_staff, # Default allow anybody to upload
        'allowed': ['image/jpeg', 'image/png', 'video/mp4'],  # Default allow all mime types
        'bucket': 'pdf-bucket', # Default is 'AWS_STORAGE_BUCKET_NAME'
        'acl': 'private', # Defaults to 'public-read'
        'cache_control': 'max-age=2592000', # Default no cache-control
        'content_disposition': lambda x: 'attachment; filename="{}"'.format(x),  # Default no content disposition
        'content_length_range': (5000, 20000000), # Default allow any size
        'server_side_encryption': 'AES256', # Default no encryption
    },
    'example_other': {
        'key': lambda filename, args: args + '/' + filename,
    	'key_args': 'uploads/images',  # Only if 'key' is a function
    }
}
```

### urls.py

```python
urlpatterns = [
    ...
    url(r'^s3direct/', include('s3direct.urls')),
    ...
]
```

Run ```python manage.py collectstatic``` if required.

## Use in Django admin

### models.py

```python
from django.db import models
from s3direct.fields import S3DirectField

class Example(models.Model):
    video = S3DirectField(dest='example_destination')
```

## Use the widget in a custom form

### forms.py

```python
from django import forms
from s3direct.widgets import S3DirectWidget

class S3DirectUploadForm(forms.Form):
    images = forms.URLField(widget=S3DirectWidget(dest='example_destination'))
```

__*Optional.__ You can modify the HTML of the widget by overiding template __s3direct/templates/s3direct-widget.tpl__

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

# Add your AWS keys to your environment
export AWS_ACCESS_KEY_ID='…'
export AWS_SECRET_ACCESS_KEY='…'
export AWS_STORAGE_BUCKET_NAME='…'
export AWS_S3_REGION_NAME='…'    # e.g. 'eu-west-1'
export AWS_S3_ENDPOINT_URL='…' # e.g. 'https://s3-eu-west-1.amazonaws.com'

$ python manage.py migrate
$ python manage.py createsuperuser
$ python manage.py runserver
```

Visit ```http://localhost:8000/admin``` to view the admin widget and ```http://localhost:8000/form``` to view the custom form widget.

## Development
```shell
$ git clone git@github.com:bradleyg/django-s3direct.git
$ cd django-s3direct

# Build docker image
$ docker build . --build-arg SKIP_TOX=true -t s3direct
$ docker run -itv $(pwd):/code -p 8000:8000 s3direct bash
$ npm i

# Add your AWS keys/details to .env file and export
$ cp .env-dist .env
$ export $(cat .env)

# Run examples
$ python example/manage.py migrate
$ python example/manage.py createsuperuser
$ python example/manage.py runserver 0.0.0.0:8000

# Run tox tests
$ tox

# Run tests
$ npm run test

# Run frontend dev bundler
$ npm run dev

# Build frontend
$ npm run build

# Format python // PEP8
$ npm run yapf

# Upload to PYPI
$ npm run pypi
```
