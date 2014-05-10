from appconf import AppConf


class S3DirectConf(AppConf):
    UNIQUE_RENAME = False
    ENDPOINT = 's3.amazonaws.com'

    class Meta:
        prefix = 'S3DIRECT'
        required = ['DESTINATIONS']