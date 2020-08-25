from django.db import models

from s3upload.fields import S3UploadField


class Cat(models.Model):
    custom_filename = S3UploadField(dest="custom_filename", blank=True)


class Kitten(models.Model):
    mother = models.ForeignKey("Cat", on_delete=models.CASCADE)

    video = S3UploadField(dest="vids", blank=True)
    image = S3UploadField(dest="imgs", blank=True)
    pdf = S3UploadField(dest="files", blank=True)
