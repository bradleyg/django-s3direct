import datetime
from appconf import AppConf


class S3DirectConf(AppConf):
    UNIQUE_RENAME = False
    EXPIRATION = datetime.timedelta(hours=1)

    class Meta:
        prefix = 'S3DIRECT'
        required = ['DESTINATIONS']