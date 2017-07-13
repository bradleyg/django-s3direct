from django.db import models
from s3uploads.fields import S3UploadsField


class Cat(models.Model):
    custom_filename = S3UploadsField(dest='custom_filename', blank=True)


class Kitten(models.Model):
    mother = models.ForeignKey('Cat')

    video = S3UploadsField(dest='videos', blank=True)
    image = S3UploadsField(dest='images', blank=True)
    pdf = S3UploadsField(dest='pdfs', blank=True)
