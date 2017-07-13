from django.db import models
from s3upload.fields import S3UploadField


class Cat(models.Model):
    custom_filename = S3UploadField(dest='custom_filename', blank=True)


class Kitten(models.Model):
    mother = models.ForeignKey('Cat')

    video = S3UploadField(dest='videos', blank=True)
    image = S3UploadField(dest='images', blank=True)
    pdf = S3UploadField(dest='pdfs', blank=True)
