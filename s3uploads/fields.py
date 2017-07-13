from django.db.models import Field
from django.conf import settings
from s3uploads.widgets import S3UploadsWidget


class S3UploadsField(Field):
    def __init__(self, *args, **kwargs):
        dest = kwargs.pop('dest', None)
        self.widget = S3UploadsWidget(dest=dest)
        super(S3UploadsField, self).__init__(*args, **kwargs)

    def get_internal_type(self):
        return 'TextField'

    def formfield(self, *args, **kwargs):
        kwargs['widget'] = self.widget
        return super(S3UploadsField, self).formfield(*args, **kwargs)


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules
    add_introspection_rules([], ["^s3uploads\.fields\.S3UploadsField"])
