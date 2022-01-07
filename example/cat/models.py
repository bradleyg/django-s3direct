from django.db import models
from s3direct.fields import S3DirectField


class Cat(models.Model):
    custom_filename = S3DirectField(dest='AVATAR')


class Kitten(models.Model):
    mother = models.ForeignKey('Cat', on_delete=models.CASCADE)

    video = S3DirectField(dest='AVATAR')
    image = S3DirectField(dest='AVATAR')
    pdf = S3DirectField(dest='AVATAR')
