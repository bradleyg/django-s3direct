from django.db import models
from s3direct.fields import S3DirectField


class Kitten(models.Model):
    video = S3DirectField(upload_to='videos')

    def __unicode__(self):
        return str(self.video)