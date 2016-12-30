from __future__ import unicode_literals

import os
from django.forms import widgets
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.utils.http import urlunquote_plus


class S3DirectWidget(widgets.TextInput):

    default_html = (
        u'<div class="s3direct" data-policy-url="{policy_url}">'
        '  <a class="file-link" target="_blank" href="{file_url}">{file_name}</a>'
        '  <a class="file-remove" href="#remove">Remove</a>'
        '  <input class="file-url" type="hidden" value="{file_url}" id="{element_id}" name="{name}" />'
        '  <input class="file-dest" type="hidden" value="{dest}">'
        '  <input class="file-input" type="file"  style="{style}"/>'
        '  <div class="progress progress-striped active">'
        '    <div class="bar"></div>'
        '  </div>'
        '</div>'
    )

    class Media:
        js = (
            's3direct/js/scripts.js',
        )
        css = {
            'all': (
                's3direct/css/bootstrap-progress.min.css',
                's3direct/css/styles.css',
            )
        }

    def __init__(self, *args, **kwargs):
        self.dest = kwargs.pop('dest', None)
        self.html = kwargs.pop('html', self.default_html)
        super(S3DirectWidget, self).__init__(*args, **kwargs)

    def render(self, name, value, attrs=None):
        if value:
            file_name = os.path.basename(urlunquote_plus(value))
        else:
            file_name = ''

        output = self.html.format(
            policy_url=reverse('s3direct'),
            element_id=self.build_attrs(attrs).get('id', ''),
            file_name=file_name,
            dest=self.dest,
            file_url=value or '',
            name=name,
            style=self.build_attrs(attrs).get('style', '')
        )

        return mark_safe(output)
