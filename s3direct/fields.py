from django.db.models import Field
from django.conf import settings
from s3direct.widgets import S3DirectWidget


S3DIRECT_DIR = getattr(settings, 'S3DIRECT_DIR', 's3direct')


class S3DirectField(Field):
    def __init__(self, upload_to=S3DIRECT_DIR):
        self.widget = S3DirectWidget(upload_to=upload_to)
        super(S3DirectField, self).__init__()

    def get_internal_type(self):
        return 'URLField'

    def formfield(self, **kwargs):
        kwargs['widget'] = self.widget
        return super(S3DirectField, self).formfield(**kwargs)


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules
    add_introspection_rules([], ["^s3direct\.fields\.S3DirectField"])