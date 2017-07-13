from __future__ import unicode_literals

import os
from django.forms import widgets
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.template.loader import render_to_string
from django.utils.http import urlunquote_plus


class S3UploadWidget(widgets.TextInput):

    class Media:
        js = (
            's3upload/js/django-s3-upload.min.js',
        )
        css = {
            'all': (
                's3upload/css/bootstrap-progress.min.css',
                's3upload/css/styles.css',
            )
        }

    def __init__(self, *args, **kwargs):
        self.dest = kwargs.pop('dest', None)
        super(S3UploadWidget, self).__init__(*args, **kwargs)

    def render(self, name, value, attrs=None, **kwargs):
        if value:
            file_name = os.path.basename(urlunquote_plus(value))
        else:
            file_name = ''

        tpl = os.path.join('s3upload', 's3upload-widget.tpl')
        output = render_to_string(tpl, {
            'policy_url': reverse('s3upload'),
            'element_id': self.build_attrs(attrs).get('id', '') if attrs else '',
            'file_name': file_name,
            'dest': self.dest,
            'file_url': value or '',
            'name': name,
            'style': self.build_attrs(attrs).get('style', '') if attrs else '',
        })

        return mark_safe(output)
