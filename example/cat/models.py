from django.db import models
from s3direct.fields import S3DirectField


class Cat(models.Model):
    custom_filename = S3DirectField(dest='custom_filename')


class Kitten(models.Model):
    mother = models.ForeignKey('Cat', on_delete=models.CASCADE)

    video = S3DirectField(dest='videos')
    image = S3DirectField(dest='images')
    pdf = S3DirectField(dest='pdfs')
