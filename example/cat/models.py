from django.db import models
from s3direct.fields import S3DirectField


class Cat(models.Model):
    video = S3DirectField(dest='custom_filename', blank=True)

    def __unicode__(self):
        return str(self.video)


class Kitten(models.Model):
    mother = models.ForeignKey('Cat')

    video = S3DirectField(dest='vids', blank=True)
    image = S3DirectField(dest='imgs', blank=True)
    pdf = S3DirectField(dest='files', blank=True)

    def __unicode__(self):
        return str(self.video)
