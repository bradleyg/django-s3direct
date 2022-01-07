from __future__ import unicode_literals


import os
import json

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

        if value is None:
            value = {}

        ctx = {
            'policy_url': reverse('s3direct'),
            'signing_url': reverse('s3direct-signing'),
            'dest': self.dest,
            'name': name,
            'csrf_cookie_name': csrf_cookie_name,
            'file_url': value.get('url', ""),
            'file_name': value.get('filename', ""),
            'file_key': value.get("key", "")
        }

        return mark_safe(
            render_to_string(
                os.path.join('s3direct', 's3direct-widget.tpl'),
                ctx
            )
        )
