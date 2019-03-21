django-s3direct
===============

Upload files directly to S3 (or compatible service) from Django.
-------------------------------------

[![Build Status](https://travis-ci.org/bradleyg/django-s3direct.svg?branch=master)](https://travis-ci.org/bradleyg/django-s3direct)

Directly upload files to S3 and other compatible services (such as [Digital Ocean's Spaces](https://www.digitalocean.com/docs/spaces/)) with Django.  
<img src="https://raw.githubusercontent.com/bradleyg/django-s3direct/master/screenshot.png" width="381"/>

## Installation

Install with Pip:  
```pip install django-s3direct```

## Access setup

### When setting up access credentials you have two options:

### Option 1:
__Generate access credentials and add them directly to your Django settings__  
If you're not using AWS S3 you can skip to [CORS setup](#cors-setup). If using 
Amazon S3 you'll also need to create an IAM policy which grants permission to 
upload to your bucket for your newly created credentials. Remember to swap out 
__YOUR_BUCKET_NAME__ for your actual bucket.

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

### Option 2: 
__Use the EC2 instance profile and its attached IAM role (AWS only)__  
You'll need to ensure the following trust policy is in place in additon to the 
policy above. You'll also need to ensure you have the 
[botocore](https://github.com/boto/botocore) package installed. You already 
have `botocore` installed if `boto3`
is a dependency of your project.

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

### CORS setup

You'll need to add a CORS policy on your bucket. Note the ETag header is 
particularly important as it is used for multipart uploads. For more information 
see [here](https://github.com/TTLabs/EvaporateJS/wiki/Configuring-The-AWS-S3-Bucket). 
Remember to swap out YOURDOMAIN.COM in the example below with your domain, 
including port if developing locally.

If using Digital Ocean Spaces you must upload the CORS config via the API/s3cmd 
CLI. See [here](https://www.digitalocean.com/community/questions/why-can-i-use-http-localhost-port-with-cors-in-spaces)
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
AWS_ACCESS_KEY_ID = 'your-aws-access-key-id'
AWS_SECRET_ACCESS_KEY = 'your-aws-secret-access-key'

# Bucket name
AWS_STORAGE_BUCKET_NAME = 'your-aws-s3-bucket-name'

# The region of your bucket, more info:
# http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
AWS_S3_REGION_NAME = 'eu-west-1'

# The endpoint of your bucket, more info:
# http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
AWS_S3_ENDPOINT_URL = 'https://s3-eu-west-1.amazonaws.com'

S3DIRECT_DESTINATIONS = {
    'example_destination': {
        # "key" [required] The location to upload file
        #       1. String: folder path to upload to
        #       2. Function: generate folder path + filename using a function  
        'key': 'uploads/images',
    
        # "auth" [optional] Limit to specfic Django users
        #        Function: ACL function
        'auth': lambda u: u.is_staff,
    
        # "allowed" [optional] Limit to specific mime types
        #           List: list of mime types
        'allowed': ['image/jpeg', 'image/png', 'video/mp4'],

        # "bucket" [optional] Bucket if different from AWS_STORAGE_BUCKET_NAME
        #          String: bucket name
        'bucket': 'custom-bucket',

        # "endpoint" [optional] Endpoint if different from AWS_S3_ENDPOINT_URL
        #            String: endpoint URL
        'endpoint': 'custom-endpoint',

        # "region" [optional] Region if different from AWS_S3_REGION_NAME
        #          String: region name
        'region': 'custom-region', # Default is 'AWS_S3_REGION_NAME'
        
        # "acl" [optional] Custom ACL for object, default is 'public-read'
        #       String: ACL
        'acl': 'private',

        # "cache_control" [optional] Custom cache control header
        #                 String: header
        'cache_control': 'max-age=2592000',

        # "content_disposition" [optional] Custom content disposition header
        #                       String: header
        'content_disposition': lambda x: 'attachment; filename="{}"'.format(x),

        # "content_length_range" [optional] Limit file size
        #                        Tuple: (from, to) in bytes
        'content_length_range': (5000, 20000000),

        # "server_side_encryption" [optional] Use serverside encryption
        #                          String: encrytion standard
        'server_side_encryption': 'AES256',

        # "allow_existence_optimization" [optional] Checks to see if file already exists,
        #                                returns the URL to the object if so (no upload)
        #                                Boolean: True, False
        'allow_existence_optimization': False,
    },
    'example_destination_two': {
        'key': lambda filename, args: args + '/' + filename,
    	'key_args': 'uploads/images',
    },
    'example_destination_three': {
        'key': lambda filename, args: args['customer_id'] + '/' + filename,
    	# key_args, are dynamically supplied by the form
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

__*Optional.__ You can supply the __key_args__ parameter when creating the widget in order to dynamically define the resulting s3 keys.
For this to work correctly, __key_args__ must be json serializable:

```python
from django import forms
from s3direct.widgets import S3DirectWidget

class S3DirectUploadForm(forms.Form):
    images = forms.URLField(widget=S3DirectWidget(dest='example_destination'))
    
    def __init__(self, *args, **kwargs):
        instance = kwargs.get('instance', None)

        if instance:
            self.base_fields['images'].widget = S3DirectWidget(dest='example_destination_3', key_args={'customer_id':instance.customer.pk})
                
        super().__init__(*args, **kwargs)
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

# Add config to your environment
export AWS_ACCESS_KEY_ID='…'
export AWS_SECRET_ACCESS_KEY='…'
export AWS_STORAGE_BUCKET_NAME='…'
export AWS_S3_REGION_NAME='…'
export AWS_S3_ENDPOINT_URL='…'

$ python manage.py migrate
$ python manage.py createsuperuser
$ python manage.py runserver
```

Visit ```http://localhost:8000/admin``` to view the admin widget and 
```http://localhost:8000/form``` to view the custom form widget.

## Development
```shell
$ git clone git@github.com:bradleyg/django-s3direct.git
$ cd django-s3direct

# Build docker image
$ docker build . --build-arg SKIP_TOX=true -t s3direct
$ docker run -itv $(pwd):/code -p 8000:8000 s3direct bash
$ npm i

# Install locally
$ python setup.py develop

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

# Run frontend bundler and Django server
$ npm run dev

# Watch and build frontend (dev)
$ npm run watch

# Build frontend (prod)
$ npm run build

# Format python // PEP8
$ npm run yapf

# Upload to PYPI
$ npm run pypi
```
