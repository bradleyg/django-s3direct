from django.db.models import Field
from django.conf import settings
from s3direct.widgets import S3DirectWidget


class S3DirectField(Field):
    def __init__(self, *args, **kwargs):
        upload_to = kwargs.pop('upload_to', None)
        self.widget = S3DirectWidget(upload_to=upload_to)
        super(S3DirectField, self).__init__(*args, **kwargs)

    def get_internal_type(self):
        return 'TextField'

    def formfield(self, *args, **kwargs):
        kwargs['widget'] = self.widget
        return super(S3DirectField, self).formfield(*args, **kwargs)


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules
    add_introspection_rules([], ["^s3direct\.fields\.S3DirectField"])
