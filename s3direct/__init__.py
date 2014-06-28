from appconf import AppConf
from django.utils import timezone


class S3DirectConf(AppConf):
    UNIQUE_RENAME = False
    EXPIRATION = timezone.timedelta(hours=1)

    class Meta:
        prefix = 'S3DIRECT'
        required = ['DESTINATIONS']