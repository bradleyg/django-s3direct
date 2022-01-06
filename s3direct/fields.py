import boto3
import botocore
import json

from django.db.models import JSONField
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

from s3direct.widgets import S3DirectWidget
from s3direct.utils import get_s3direct_destinations, get_presigned_url

class CastOnAssignDescriptor(object):
    """
    A property descriptor which ensures that `field.to_python()` is called on _every_ assignment to the field.
    This used to be provided by the `django.db.models.subclassing.Creator` class, which in turn
    was used by the deprecated-in-Django-1.10 `SubfieldBase` class, hence the reimplementation here.
    """

    def __init__(self, field):
        self.field = field

    def __get__(self, obj, type=None):
        if obj is None:
            return self
        return obj.__dict__[self.field.name]

    def __set__(self, obj, value):
        print(type(value), value)
        try:
            value = json.loads(value)
            'url' in value
            obj.__dict__[self.field.name] = value
        except:
            obj.__dict__[self.field.name] = self.field.to_python(value)


class S3DirectField(JSONField):
    def __init__(
        self, *args, **kwargs,
    ):
        self.dest = kwargs.pop('dest', None)
        self.expires_in = kwargs.pop('expires_in', 3600)
        self.widget = S3DirectWidget(dest=self.dest)
        super().__init__(*args, **kwargs)

    def contribute_to_class(self, cls, name):
        super().contribute_to_class(cls, name)
        setattr(cls, name, CastOnAssignDescriptor(self))

    def get_internal_type(self):
        return 'JSONField'

    def formfield(self, *args, **kwargs):
        kwargs['widget'] = self.widget
        return super().formfield(*args, **kwargs)

    def value_to_string(self, obj):
        value = self.value_from_object(obj)
        if not value:
            return value

        response = get_presigned_url(
            self.dest,
            value,
            self.expires_in
        )

        return self.get_prep_value(response)


    def to_python(self, value):
        value = super().to_python(value)
        value = self.validate_url(value)
        return value

    def get_prep_value(self, value):
        if value is None:
            return None
        return json.dumps(value, cls=self.encoder)

    def validate_url(self, value):
        if not value:
            return None

        if isinstance(value, dict):
            value = value['url']

        dest = get_s3direct_destinations().get(self.dest)

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
            return {"url": value, "filename": obj}
        except botocore.exceptions.ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "404":
                raise ValidationError(_("Object not found."))

        return None

