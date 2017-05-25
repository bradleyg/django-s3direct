import json

from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import resolve, reverse
from django.test import TestCase
from django.test.utils import override_settings

from s3direct import widgets


HTML_OUTPUT = (
    '<div class="s3direct" data-policy-url="/get_upload_params/" data-signing-url="/get_aws_v4_signature/">\n'
    '  <a class="file-link" target="_blank" href=""></a>\n'
    '  <a class="file-remove" href="#remove">Remove</a>\n'
    '  <input class="file-url" type="hidden" value="" id="" name="filename" />'
    '\n'
    '  <input class="file-dest" type="hidden" value="foo">\n'
    '  <input class="file-input" type="file"  style=""/>\n'
    '  <div class="progress progress-striped active">\n'
    '    <div class="bar"></div>\n'
    '  </div>\n'
    '</div>\n'
)

POLICY_RESPONSE = {
    u'object_key': u'uploads/imgs/${filename}',
    u'content-type': u'image/jpeg',
    u'access_key_id': settings.AWS_ACCESS_KEY_ID,
    u'region': settings.S3DIRECT_REGION,
    u'bucket': 'astoragebucketname',
    u'bucket_url': 'https://s3.amazonaws.com/astoragebucketname',
    u'cache_control': None,
    u'content_disposition': None,
    u'acl': 'public-read',
    u'server_side_encryption': None,
}


@override_settings(S3DIRECT_DESTINATIONS={
    'misc': {'key': lambda original_filename: 'images/unique.jpg'},
    'files': {'key': 'uploads/files', 'auth': lambda u: u.is_staff},
    'imgs': {'key': 'uploads/imgs', 'auth': lambda u: True, 'allowed': ['image/jpeg', 'image/png']},
    'thumbs': {'key': 'uploads/thumbs', 'allowed': ['image/jpeg'], 'content_length_range': (1000, 50000)},
    'vids': {'key': 'uploads/vids', 'auth': lambda u: u.is_authenticated(), 'allowed': ['video/mp4']},
    'cached': {'key': 'uploads/vids', 'auth': lambda u: u.is_authenticated(), 'allowed': '*',
               'acl': 'authenticated-read', 'bucket': 'astoragebucketname', 'cache_control': 'max-age=2592000',
               'content_disposition': 'attachment', 'server_side_encryption': 'AES256'},
})
class WidgetTestCase(TestCase):
    """
    This allows us to have 2 version of the same tests but with different
    settings. As opposed to inheriting test methods as doing that makes the
    failure stack hard to parse.
    TODO: Get rid of this base class and the appropriate subclass when
    positional setting support is dropped. See #48
    """

    def setUp(self):
        admin = User.objects.create_superuser('admin', 'u@email.com', 'admin')
        admin.save()

    def test_urls(self):
        reversed_url = reverse('s3direct')
        resolved_url = resolve('/get_upload_params/')
        self.assertEqual(reversed_url, '/get_upload_params/')
        self.assertEqual(resolved_url.view_name, 's3direct')

    def test_widget_html(self):
        widget = widgets.S3DirectWidget(dest='foo')
        self.assertEqual(widget.render('filename', None), HTML_OUTPUT)

    def test_get_upload_parameters_logged_in(self):
        self.client.login(username='admin', password='admin')
        data = {'dest': 'files', 'name': 'image.jpg', 'type': 'image/jpeg', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def test_get_upload_parameters_logged_out(self):
        data = {'dest': 'files', 'name': 'image.jpg', 'type': 'image/jpeg', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 403)

    def test_allowed_type(self):
        data = {'dest': 'imgs', 'name': 'image.jpg', 'type': 'image/jpeg', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def test_disallowed_type(self):
        data = {'dest': 'imgs', 'name': 'image.mp4', 'type': 'video/mp4', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 400)

    def test_allowed_size(self):
        data = {'dest': 'thumbs', 'name': 'thumbnail.jpg', 'type': 'image/jpeg', 'size': 20000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def test_disallowed_size(self):
        data = {'dest': 'thumbs', 'name': 'thumbnail.jpg', 'type': 'image/jpeg', 'size': 200000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 400)

    def test_allowed_type_logged_in(self):
        self.client.login(username='admin', password='admin')
        data = {'dest': 'vids', 'name': 'video.mp4', 'type': 'video/mp4', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def test_disallowed_type_logged_out(self):
        data = {u'dest': u'vids', u'name': u'video.mp4', u'type': u'video/mp4', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 403)

    # TODO: test object key functions
    def test_default_upload_key(self):
        pass

    def test_directory_object_key(self):
        pass

    def test_function_object_key(self):
        pass

    def test_policy_conditions(self):
        self.client.login(username='admin', password='admin')
        data = {u'dest': u'cached', u'name': u'video.mp4', u'type': u'video/mp4', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['bucket'], u'astoragebucketname')
        self.assertEqual(policy_dict['acl'], u'authenticated-read')
        self.assertEqual(policy_dict['cache_control'], u'max-age=2592000')
        self.assertEqual(policy_dict['content_disposition'], u'attachment')
        self.assertEqual(policy_dict['server_side_encryption'], u'AES256')


class SignatureViewTestCase(TestCase):
    def setUp(self):
        admin = User.objects.create_superuser('admin', 'u@email.com', 'admin')
        admin.save()

    def test_expected_signature(self):
        # TODO - generate base64 encoding of a policy document and expected signature
        pass

    def test_signing_logged_in(self):
        pass

    def test_signing_logged_out(self):
        pass

    # TODO - test CSRF requirement
