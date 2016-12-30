from __future__ import unicode_literals

import os
from django.forms import widgets
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.template.loader import get_template
from django.utils.http import urlunquote_plus


class S3DirectWidget(widgets.TextInput):

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
        super(S3DirectWidget, self).__init__(*args, **kwargs)

    def render(self, name, value, attrs=None):
        if value:
            file_name = os.path.basename(urlunquote_plus(value))
        else:
            file_name = ''

        tpl = get_template('s3direct-widget.tpl')
        output = tpl.render({
            'policy_url': reverse('s3direct'),
            'element_id': self.build_attrs(attrs).get('id', ''),
            'file_name': file_name,
            'dest': self.dest,
            'file_url': value or '',
            'name': name,
            'style': self.build_attrs(attrs).get('style', '')
        })

        return mark_safe(output)
