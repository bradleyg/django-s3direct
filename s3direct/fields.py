from django.db.models import Field
from django.forms import widgets
from s3direct.widgets import S3DirectEditor
from django.conf import settings


class S3DirectField(Field):
    def __init__(self, *args, **kwargs):
        upload_to = kwargs.pop('upload_to', '')
        self.widget = S3DirectEditor(upload_to=upload_to)
        super(S3DirectField, self).__init__(*args, **kwargs)

    def get_internal_type(self):
        return "TextField"

    def formfield(self, **kwargs):
        defaults = {'widget': self.widget}
        defaults.update(kwargs)
        return super(S3DirectField, self).formfield(**defaults)
        

if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules
    add_introspection_rules([], ["^s3direct\.fields\.S3DirectField"])