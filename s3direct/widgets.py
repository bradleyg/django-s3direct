import os
from warnings import warn
from django.forms import widgets
from django.core.files.storage import DefaultStorage
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.conf import settings


class S3DirectBaseWidget(widgets.Input):
    template = (
        '<div class="s3direct" data-url="{policy_url}">\n'
        '    <a class="link" target="_blank" href="{file_url}">{file_name}</a>\n'
        '    <a class="remove" href="#remove">Remove</a>\n'
        '    <input type="hidden" value="{file_url}" id="{element_id}" name="{name}" />\n'
        '    <input type="file" class="fileinput" />\n'
        '    <div class="progress progress-striped active">\n'
        '        <div class="bar"></div>\n'
        '    </div>\n'
        '</div>'
    )

    def __init__(self, upload_to, *args, **kwargs):
        self.upload_to = upload_to
        super(S3DirectBaseWidget, self).__init__(*args, **kwargs)

    def render(self, name, value, attrs=None):
        final_attrs = self.build_attrs(attrs)
        element_id = final_attrs.get('id')
        kwargs = {'upload_to': self.upload_to}

        policy_url = reverse('s3direct', kwargs=kwargs)
        file_url = value or ''
        file_name = os.path.basename(file_url)

        output = self.template.format(policy_url=policy_url,
                             file_url=file_url,
                             file_name=file_name,
                             element_id=element_id,
                             name=name)

        return mark_safe(output)

    class Media:
        js = (
            's3direct/js/jquery-1.10.2.min.js',
            's3direct/js/jquery.iframe-transport.js',
            's3direct/js/jquery.ui.widget.js',
            's3direct/js/jquery.fileupload.js',
            's3direct/js/s3direct.js',
        )
        css = {
            'all': (
                's3direct/css/bootstrap-progress.min.css',
                's3direct/css/styles.css',
            )
        }


class S3DirectURLWidget(S3DirectBaseWidget):
    input_type = 'url'


class S3DirectEditor(S3DirectURLWidget):
    def __init__(self, *args, **kwargs):
        warn(DeprecationWarning('(class)s is deprecated. Please use S3DirectURLWidget instead.'))
        super(S3DirectEditor, self).__init__(*args, **kwargs)


class S3DirectFileWidget(S3DirectBaseWidget):
    input_type = 'file'
    needs_multipart_form = False

    def value_from_datadict(self, data, files, name):
        upload = super(S3DirectFileWidget, self).value_from_datadict(data, files, name)
        if upload:
            return upload
        else:
            bucket = settings.AWS_STORAGE_BUCKET_NAME
            s3_host = settings.S3DIRECT_ENDPOINT

            storage = DefaultStorage()
            url = data[name]
            bucket_url = 'https://%s.%s/' % (bucket, s3_host)
            filename = url.lstrip(bucket_url)
            file = storage.open(filename)
            return file