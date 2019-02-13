from __future__ import unicode_literals

import os
from django.forms import widgets
from django.utils.safestring import mark_safe
try:
    from django.urls import reverse
except ImportError:
    # Django <1.10 compliance
    from django.core.urlresolvers import reverse
from django.template.loader import render_to_string
from django.utils.http import urlunquote_plus
from django.conf import settings


class S3DirectWidget(widgets.TextInput):
    class Media:
        js = ('s3direct/dist/index.js', )
        css = {'all': ('s3direct/dist/index.css', )}

    def __init__(self, *args, **kwargs):
        self.dest = kwargs.pop('dest', None)
        super(S3DirectWidget, self).__init__(*args, **kwargs)

    def render(self, name, value, **kwargs):
        file_url = value or ''
        csrf_cookie_name = getattr(settings, 'CSRF_COOKIE_NAME', 'csrftoken')

        ctx = {
            'policy_url': reverse('s3direct'),
            'signing_url': reverse('s3direct-signing'),
            'dest': self.dest,
            'name': name,
            'csrf_cookie_name': csrf_cookie_name,
            'file_url': file_url,
            'file_name': os.path.basename(urlunquote_plus(file_url)),
        }

        return mark_safe(
            render_to_string(
                os.path.join('s3direct', 's3direct-widget.tpl'), ctx))
