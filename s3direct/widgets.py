from urlparse import urlparse
import urllib2
from django.forms import widgets
from django.core.files.storage import DefaultStorage
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.conf import settings
from django.utils.translation import ugettext


class S3DirectBaseWidget(widgets.Input):
    template = (
        '<div class="s3direct" data-url="{policy_url}">\n'
        '    <a class="link" target="_blank" href="{file_url}">{file_url}</a>\n'
        '    <a class="remove" href="javascript: void(0)">{remove}</a>\n'
        '    <input type="hidden" value="{file_url}" id="{element_id}" name="{name}" />\n'
        '    <input type="file" class="fileinput" accept="{acceped_types}" />\n'
        '    <div class="progress progress-striped active">\n'
        '        <div class="progress-bar"></div>\n'
        '    </div>\n'
        '</div>'
    )

    def __init__(self, upload_to, *args, **kwargs):
        destinations = settings.S3DIRECT_DESTINATIONS
        if upload_to in destinations:
            self.destination = dict(map(None, ('path', 'permission', 'accepted-types'), destinations[upload_to]))
            self.upload_to = upload_to
        else:
            raise ValueError("%s in not defined in the S3DIRECT_DESTINATIONS setting." % upload_to)
        super(S3DirectBaseWidget, self).__init__(*args, **kwargs)

    def render(self, name, value, attrs=None):
        final_attrs = self.build_attrs(attrs)
        element_id = final_attrs.get('id')
        kwargs = {'upload_to': self.upload_to}

        policy_url = reverse('s3direct', kwargs=kwargs)
        acceped_types = "|".join(content_type for content_type in self.destination['accepted-types'])

        if value:
            file_url = '%s%s' % (settings.MEDIA_URL, value)
        else:
            file_url = ''

        output = self.template.format(policy_url=policy_url,
                             file_url=file_url,
                             element_id=element_id or '',
                             name=name,
                             acceped_types=acceped_types,
                             remove=ugettext('remove'))

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


class S3DirectFileWidget(S3DirectBaseWidget):
    input_type = 'file'
    needs_multipart_form = False

    def value_from_datadict(self, data, files, name):
        url = data.get(name, False)
        upload = files.get(name, False)
        if url:
            storage = DefaultStorage()
            filename = urllib2.unquote(urlparse(url).path)
            try:
                file = storage.open(filename)
                return file
            except IOError:
                return None
        elif upload:
            return upload
        else:
            return None