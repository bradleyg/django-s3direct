from django.db.models import Field
from django.conf import settings

from s3direct.widgets import S3DirectWidget
from s3direct.utils import get_s3direct_destinations, get_presigned_url

class S3DirectField(Field):
    def __init__(self, *args, **kwargs):
        self.dest = kwargs.pop('dest', None)
        self.expires_in = kwargs.pop('expires_in', 3600)
        self.widget = S3DirectWidget(dest=self.dest)
        super().__init__(*args, **kwargs)

    def get_internal_type(self):
        return 'TextField'

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

