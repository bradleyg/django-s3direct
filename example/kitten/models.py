from django.db import models


class Kitten(models.Model):
    file = models.FileField(upload_to='path/to/dir')
    url = models.URLField(upload_to='path/to/dir')

    def __unicode__(self):
        return str(self.file)