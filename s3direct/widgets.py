import os
from django.forms import widgets
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.utils import simplejson as json
from django.conf import settings


HTML = """
<div class="s3direct" data-url="{policy_url}">
    <a class="link" target="_blank" href="{file_url}">{file_name}</a>
    <a class="remove" href="#remove">Remove</a>
    <input type="hidden" value="{file_url}" id="{element_id}" name="{name}" />
    <input type="file" class="fileinput" />
    <div class="progress progress-striped active">
        <div class="bar"></div>
    </div>
</div>
"""


class S3DirectEditor(widgets.TextInput):

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
        self.upload_to = kwargs.pop('upload_to', '')
        super(S3DirectEditor, self).__init__(*args, **kwargs)


    def render(self, name, value, attrs=None):
        final_attrs = self.build_attrs(attrs)
        element_id = final_attrs.get('id')
        kwargs = {'upload_to': self.upload_to}
        
        policy_url = reverse('s3direct', kwargs=kwargs)
        file_url = value if value else ''
        file_name = os.path.basename(file_url)

        output = HTML.format(policy_url=policy_url,
                             file_url=file_url,
                             file_name=file_name,
                             element_id=element_id,
                             name=name)

        return mark_safe(output)
