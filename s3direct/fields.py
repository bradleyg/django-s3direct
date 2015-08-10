from django.db.models import Field
from django.conf import settings
from s3direct.widgets import S3DirectWidget


class S3DirectField(Field):
    def __init__(self, *args, **kwargs):
        dest = kwargs.pop('dest', None)
        transform = kwargs.pop('transform', self.identity_fn)
        self.widget = S3DirectWidget(dest=dest, transform=transform)
        super(S3DirectField, self).__init__(*args, **kwargs)

    def get_internal_type(self):
        return 'TextField'

    def formfield(self, *args, **kwargs):
        kwargs['widget'] = self.widget
        return super(S3DirectField, self).formfield(*args, **kwargs)

    def identity_fn(self, x):
        return x

if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules
    add_introspection_rules([], ["^s3direct\.fields\.S3DirectField"])
