import os
from warnings import warn
from django import forms
from django.core.files.storage import DefaultStorage
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.conf import settings


HTML_DEPRECATED = (
    '<div class="s3direct" data-url="{policy_url}">'
    '    <a class="link" target="_blank" href="{file_url}">{file_name}</a>'
    '    <a class="remove" href="#remove">Remove</a>'
    '    <input type="hidden" value="{file_url}" id="{element_id}" name="{name}" />'
    '    <input type="file" class="fileinput" />'
    '    <div class="progress progress-striped active">'
    '        <div class="bar"></div>'
    '    </div>'
    '</div>'
)


class S3DirectEditor(forms.widgets.TextInput):
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

    def __init__(self, *args, **kwargs):
        warn(DeprecationWarning('(class)s will be removed in version 1.0. Use S3DirectWidget instead.'))
        self.upload_to = kwargs.pop('upload_to', '')
        super(S3DirectEditor, self).__init__(*args, **kwargs)

    def render(self, name, value, attrs=None):
        final_attrs = self.build_attrs(attrs)
        element_id = final_attrs.get('id')
        kwargs = {'upload_to': self.upload_to}

        policy_url = reverse('s3direct', kwargs=kwargs)
        file_url = value or ''
        file_name = os.path.basename(file_url)

        output = HTML_DEPRECATED.format(policy_url=policy_url,
                                        file_url=file_url,
                                        file_name=file_name,
                                        element_id=element_id,
                                        name=name)

        return mark_safe(output)


class S3DirectWidget(forms.FileInput):
    needs_multipart_form = False

    template = ('<div class="s3direct" data-url="{policy_url}">\n'
                '    <a class="link" target="_blank" href="{file_url}">{file_name}</a>\n'
                '    <a class="remove" href="#remove">Remove</a>\n'
                '    <input type="hidden" value="{file_url}" id="{element_id}" name="{name}" />\n'
                '    <input type="file" class="fileinput" />\n'
                '</div>')

    def __init__(self, upload_path='', *args, **kwargs):
        self.upload_to = upload_path
        super(S3DirectWidget, self).__init__(*args, **kwargs)

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

    def value_from_datadict(self, data, files, name):
        upload = super(S3DirectWidget, self).value_from_datadict(data, files, name)
        if upload:
            return upload
        else:
            bucket = settings.AWS_STORAGE_BUCKET_NAME
            s3_host = settings.BOTO_S3_HOST or 's3.amazonaws.com'

            storage = DefaultStorage()
            url = data[name]
            bucket_url = 'https://%s.%s/' % (bucket, s3_host)
            filename = url.lstrip(settings.MEDIA_URL)
            file = storage.open(filename)
            return file

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