import os
import boto
from django.forms import widgets
from django.utils.safestring import mark_safe
from django.core.urlresolvers import reverse
from django.conf import settings


S3DIRECT_DIR = getattr(settings, 'S3DIRECT_DIR', 's3direct')


class S3DirectWidget(widgets.TextInput):

	html = (
		'<div class="s3direct" data-policy-url="{policy_url}">'
		'  <a class="file-link" target="_blank" href="{file_url}">{file_name}</a>'
		'  <a class="file-remove" href="#remove">Remove</a>'
		'  <input class="file-url" type="hidden" value="{file_url}" id="{element_id}" name="{name}" />'
		'  <input class="file-upload-to" type="hidden" value="{upload_to}">'
		'  <input class="file-input" type="file" />'
		'  <div class="progress progress-striped active">'
		'	 <div class="bar"></div>'
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
		self.upload_to = kwargs.pop('upload_to', None) or S3DIRECT_DIR
		super(S3DirectWidget, self).__init__(*args, **kwargs)
		
	def _get_signed_url(self, file_name):
		conn 		= boto.connect_s3(settings.AWS_ACCESS_KEY_ID, settings.AWS_SECRET_ACCESS_KEY)	
		bucket		= conn.get_bucket(settings.AWS_STORAGE_BUCKET_NAME)
		key 		= boto.s3.key.Key(bucket)
		key.name 	= file_name
		return key.generate_url(expires_in=60*60*60, force_http=True)

	def render(self, name, value, attrs=None):
		file_name = os.path.basename(value or '')
		key = '%s/%s' % (self.upload_to, file_name)
		output = self.html.format(
			policy_url=reverse('s3direct'),
			element_id=self.build_attrs(attrs).get('id'),
			file_name=os.path.basename(value or ''),
			upload_to=self.upload_to,
			file_url=self._get_signed_url(key),
			name=name)

		return mark_safe(output)
