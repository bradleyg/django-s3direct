from __future__ import unicode_literals

import os

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.urlresolvers import reverse
from django.forms import widgets
from django.template.loader import render_to_string
from django.utils.http import urlunquote_plus
from django.utils.safestring import mark_safe

from .utils import get_signed_download_url


class S3UploadWidget(widgets.TextInput):

    class Media:
        js = (
            's3upload/js/django-s3-uploads.min.js',
        )
        css = {
            'all': (
                's3upload/css/bootstrap-progress.min.css',
                's3upload/css/styles.css',
            )
        }

    def __init__(self, dest, **kwargs):
        assert dest, "S3UploadWidget must be initialised with a destination"
        if dest not in settings.S3UPLOAD_DESTINATIONS:
            raise ImproperlyConfigured(
                "S3UploadWidget destination '%s' is not configured. "
                "Please check settings.S3UPLOAD_DESTINATIONS."
                % dest
            )
        self.acl = settings.S3UPLOAD_DESTINATIONS[dest].get('acl', 'public-read')
        self.dest = dest
        super(S3UploadWidget, self).__init__(**kwargs)

    def get_file_url(self, value):
        if value:
            return get_signed_download_url(value) if self.acl == 'private' else value
        else:
            return ''

    def get_attr(self, attrs, key, default=''):
        return self.build_attrs(attrs).get(key, default) if attrs else default

    def render(self, name, value, attrs=None, **kwargs):
        file_name = os.path.basename(urlunquote_plus(value)) if value else ''
        tpl = os.path.join('s3upload', 's3upload-widget.tpl')
        output = render_to_string(tpl, {
            'policy_url': reverse('s3upload'),
            'element_id': self.get_attr(attrs, 'id'),
            'file_name': file_name,
            'dest': self.dest,
            'file_url': self.get_file_url(value),
            'name': name,
            'element_id': self.get_attr(attrs, 'style'),
        })
        return mark_safe(output)
