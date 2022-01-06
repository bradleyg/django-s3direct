from __future__ import unicode_literals

import os
from django.forms import widgets
from django.utils.safestring import mark_safe
from django.urls import reverse
from django.template.loader import render_to_string
from django.utils.http import urlunquote_plus
from django.conf import settings

from s3direct.utils import get_presigned_url

class S3DirectWidget(widgets.TextInput):
    class Media:
        js = ('s3direct/dist/index.js', )
        css = {'all': ('s3direct/dist/index.css', )}

    def __init__(self, *args, **kwargs):
        self.dest = kwargs.pop('dest', None)
        super().__init__(*args, **kwargs)

    def render(self, name, value, **kwargs):
        csrf_cookie_name = getattr(settings, 'CSRF_COOKIE_NAME', 'csrftoken')
        file_url = ""
        if value is not None:
            file_name = value['filename']
            file_url = get_presigned_url(
                self.dest,
                value['url'],
            )

        ctx = {
            'policy_url': reverse('s3direct'),
            'signing_url': reverse('s3direct-signing'),
            'dest': self.dest,
            'name': name,
            'csrf_cookie_name': csrf_cookie_name,
            'value': value,
            'file_url': file_url,
            'file_name': file_name,
        }

        return mark_safe(
            render_to_string(
                os.path.join('s3direct', 's3direct-widget.tpl'),
                ctx
            )
        )
