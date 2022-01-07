import boto3
import botocore
import json
from django import forms

from django.db.models import JSONField
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models.fields import Field
from django.utils.translation import gettext as _

from s3direct.widgets import S3DirectWidget
from s3direct.utils import get_s3direct_destinations, get_presigned_url

def validate_url(value, dest):
    if not isinstance(value, str):
        raise Exception(_("Not a string."))

    dest = get_s3direct_destinations().get(dest)
    bucket = dest.get("bucket", getattr(settings, "AWS_STORAGE_BUCKET_NAME", None))
    region = dest.get("region", getattr(settings, "AWS_S3_REGION_NAME", None))
    endpoint = dest.get("endpoint", getattr(settings, "AWS_S3_ENDPOINT_URL", None))
    s3_client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        config=botocore.client.Config(signature_version="s3v4"),
    )

    try:
        head_object = s3_client.head_object(
            Bucket=bucket,
            Key=value,
        )
        obj = head_object["ContentDisposition"].split('filename=')[1]
        return {"key": value, "filename": obj}
    except botocore.exceptions.ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            raise ValidationError(_("Object not found."))

    return None

class S3DirectDescriptor(object):
    def __init__(self, field):
        self.field = field

    def __get__(self, obj, type=None):
        if obj is None:
            return None

        value = obj.__dict__.get(self.field.name, None)

        if value is None:
            return None

        file_url = get_presigned_url(
            self.field.dest,
            value['key'],
        )

        return {
            **value,
            "url": file_url,
        }

    def __set__(self, obj, value):
        # presigned url not supported

        if value is None or (isinstance(value, str) and len(value) == 0):
            obj.__dict__[self.field.name] = None
            return

        current_value = obj.__dict__.get(self.field.name, None)

        if value == current_value or (current_value is not None and current_value['key'] == value):
            return

        if not isinstance(value, (str, dict)):
            raise Exception(_('Not a str or a dict.'))

        if isinstance(value, dict):
            # Got from database, or added manually
            obj.__dict__[self.field.name] = value
            return

        try:
            obj.__dict__[self.field.name] = validate_url(value, self.field.dest)
        except:
            if current_value is None:
                raise Exception(_('Invalid input.'))
                return
            else:
                new_file_url = get_presigned_url(
                    self.field.dest,
                    value,
                )
                current_file_url = current_value.split('?')[0]
                new_file_url = new_file_url.split('?')[0]
                if current_file_url == new_file_url:
                    return
                else:
                    raise Exception (_('Object not found.'))
                    return



class S3DirectField(JSONField):
    def __init__(
        self, *args, **kwargs,
    ):
        self.dest = kwargs.pop('dest', None)
        self.expires_in = kwargs.pop('expires_in', 3600)
        self.widget = S3DirectWidget(dest=self.dest)
        kwargs['null'] = True
        kwargs['blank'] = True
        super().__init__(*args, **kwargs)

    def contribute_to_class(self, cls, name):
        super().contribute_to_class(cls, name)
        setattr(cls, name, S3DirectDescriptor(self))

    def get_internal_type(self):
        return 'JSONField'

    def formfield(self, *args, **kwargs):
        return Field.formfield(
            self,
            *args,
            widget=self.widget,
            form_class=forms.CharField
        )
