from django.conf import settings
from django.db.models import Field

from .widgets import S3UploadWidget
from .utils import get_s3_path_from_url


class S3UploadField(Field):
    def __init__(self, dest=None, *args, **kwargs):
        assert dest, "S3UploadField must be initialised with a destination"
        self.dest = dest
        self.widget = S3UploadWidget(self.dest)
        super(S3UploadField, self).__init__(*args, **kwargs)

    def deconstruct(self):
        name, path, args, kwargs = super(S3UploadField, self).deconstruct()
        kwargs['dest'] = self.dest
        return name, path, args, kwargs

    def get_internal_type(self):
        return 'TextField'

    def formfield(self, *args, **kwargs):
        kwargs['widget'] = self.widget
        return super(S3UploadField, self).formfield(*args, **kwargs)

    def pre_save(self, model_instance, add):
        file_url = getattr(model_instance, self.attname)

        if file_url:
            setattr(model_instance, self.attname, file_url)
            bucket_name = settings.S3UPLOAD_DESTINATIONS[self.dest].get(
                'bucket', settings.AWS_STORAGE_BUCKET_NAME
            )
            return get_s3_path_from_url(
                file_url,
                bucket_name=bucket_name
            )

        return file_url


if 'south' in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules
    add_introspection_rules([], ["^s3upload\.fields\.S3UploadField"])
