from django.db import models
from s3direct.fields import S3DirectField


class Cat(models.Model):
    video = S3DirectField(upload_to='cat-videos')

    def __unicode__(self):
        return str(self.video)


class Kitten(models.Model):
    video = S3DirectField(upload_to='kitten-videos')
    mother = models.ForeignKey('Cat')

    def __unicode__(self):
        return str(self.video)
