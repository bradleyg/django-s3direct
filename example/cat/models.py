from django.db import models
from s3direct.fields import S3DirectField


class Cat(models.Model):
    custom_filename = S3DirectField(dest='custom_filename', blank=True)


class Kitten(models.Model):
    mother = models.ForeignKey('Cat', on_delete=models.CASCADE)

    video = S3DirectField(dest='videos', blank=True)
    image = S3DirectField(dest='images', blank=True)
    pdf = S3DirectField(dest='pdfs', blank=True)
