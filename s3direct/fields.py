import cgi
import boto3
import botocore
import json
from urllib.parse import unquote

from django import forms

from django.db.models import JSONField
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models.fields import Field
from django.utils.translation import gettext as _

from s3direct.widgets import S3DirectWidget
from s3direct.utils import (
    get_aws_credentials,
    get_s3direct_destinations,
    get_presigned_url,
)


def validate_url(value, dest):
    if not isinstance(value, str):
        raise Exception(_("Not a string."))

    dest = get_s3direct_destinations().get(dest)

    aws_access_key_id = getattr(settings, "AWS_ACCESS_KEY_ID", None)
    aws_secret_access_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
    bucket = dest.get("bucket", getattr(settings, "AWS_STORAGE_BUCKET_NAME", None))
    bucket = dest.get("bucket", getattr(settings, "AWS_STORAGE_BUCKET_NAME", None))
    region = dest.get("region", getattr(settings, "AWS_S3_REGION_NAME", None))
    endpoint = dest.get("endpoint", getattr(settings, "AWS_S3_ENDPOINT_URL", None))

    authentications = [{"source": "AWS"}]
    if aws_access_key_id and aws_secret_access_key:
        authentications.append(
            {
                "source": "OCI",
                "aws_access_key_id": aws_access_key_id,
                "aws_secret_access_key": aws_secret_access_key,
            }
        )

    # HACK: We need to check all the authentications possible to validate the file
    # in AWS and Oracle

    no_such_key = False
    for authentication in authentications:
        source = authentication.pop("source")

        s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            config=botocore.client.Config(signature_version="s3v4"),
            **authentication,
        )

        try:
            head_object = s3_client.head_object(
                Bucket=bucket,
                Key=value,
            )

            content_disposition = head_object["ContentDisposition"]
            header_value, header_params = cgi.parse_header(content_disposition)
            filename = ""
            for param_name in ["filename*", "filename"]:
                if param_name in header_params:
                    filename = header_params[param_name].strip("UTF-8''")
                    filename = unquote(filename)
                    break

            mimetype = head_object["ContentType"]
            return {
                "key": value,
                "filename": filename,
                "mimetype": mimetype,
                "source": source,
            }
        except Exception as e:
            print(e)
            no_such_key = True

    if no_such_key:
        raise ValidationError(_("Object not found."))


class S3DirectDescriptor(object):
    def __init__(self, field):
        self.field = field

    def __get__(self, obj, type=None):
        try:
            value = obj.__dict__.get(self.field.name, None)
            assert len(value["key"]) > 0
        except:
            return None

        file_url = get_presigned_url(
            self.field.dest,
            value["key"],
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

        if value == current_value or (
            current_value is not None and current_value["key"] == value
        ):
            return

        if not isinstance(value, (str, dict)):
            raise Exception(_("Not a str or a dict."))

        if isinstance(value, dict):
            # Got from database, or added manually
            obj.__dict__[self.field.name] = value
            return

        try:
            obj.__dict__[self.field.name] = validate_url(value, self.field.dest)
        except:
            if current_value is None:
                raise Exception(_("Invalid input."))
                return
            else:
                new_file_url = get_presigned_url(
                    self.field.dest,
                    value,
                )
                current_file_url = current_value.split("?")[0]
                new_file_url = new_file_url.split("?")[0]
                if current_file_url == new_file_url:
                    return
                else:
                    raise Exception(_("Object not found."))
                    return


class S3DirectField(JSONField):
    def __init__(
        self,
        *args,
        **kwargs,
    ):
        self.dest = kwargs.pop("dest", None)
        self.expires_in = kwargs.pop("expires_in", 3600)
        self.widget = S3DirectWidget(dest=self.dest)
        kwargs["null"] = True
        kwargs["blank"] = True
        super().__init__(*args, **kwargs)

    def contribute_to_class(self, cls, name):
        super().contribute_to_class(cls, name)
        setattr(cls, name, S3DirectDescriptor(self))

    def get_internal_type(self):
        return "JSONField"

    def formfield(self, *args, **kwargs):
        return Field.formfield(
            self, *args, widget=self.widget, form_class=forms.CharField
        )
