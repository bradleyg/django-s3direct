from django.db import models
from s3direct.fields import S3DirectField


class Kitten(models.Model):
    file = S3DirectField(upload_to='files')

    def __unicode__(self):
        return str(self.file)