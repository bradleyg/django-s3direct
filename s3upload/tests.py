import json
from base64 import b64decode

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.core.urlresolvers import reverse, resolve
from django.test import TestCase
from django.test.utils import override_settings

from . import widgets
from .utils import remove_signature


HTML_OUTPUT = (
    '<div class="s3upload" data-policy-url="/get_upload_params/">\n'
    '  <a class="s3upload__file-link" target="_blank" href=""></a>\n'
    '  <a class="s3upload__file-remove" href="#remove">Remove</a>\n'
    '  <input class="s3upload__file-url" type="hidden" value="" id="" name="filename" />\n'
    '  <input class="s3upload__file-dest" type="hidden" value="foo">\n'
    '  <input class="s3upload__file-input" type="file"  style=""/>\n'
    '  <div class="s3upload__error"></div>\n'
    '  <div class="s3upload__progress active">\n'
    '    <div class="s3upload__bar"></div>\n'
    '  </div>\n'
    '</div>\n'
)

FOO_RESPONSE = {
    u'x-amz-algorithm': u'AWS4-HMAC-SHA256',
    u'form_action': u'https://s3.amazonaws.com/{}'.format(settings.AWS_STORAGE_BUCKET_NAME),
    u'success_action_status': 201,
    u'acl': u'public-read',
    u'key': u'uploads/imgs/${filename}',
    u'content-type': u'image/jpeg'
}


class WidgetTest(TestCase):

    def setUp(self):
        admin = User.objects.create_superuser('admin', 'u@email.com', 'admin')
        admin.save()

    def test_init(self):
        # Test initialising the widget without an invalid destination
        self.assertRaises(ImproperlyConfigured, widgets.S3UploadWidget, 'foo')
        self.assertRaises(AssertionError, widgets.S3UploadWidget, None)
        self.assertRaises(AssertionError, widgets.S3UploadWidget, '')
        with override_settings(S3UPLOAD_DESTINATIONS={'foo': {}}):
            widgets.S3UploadWidget('foo')

    def test_check_urls(self):
        reversed_url = reverse('s3upload')
        resolved_url = resolve('/get_upload_params/')
        self.assertEqual(reversed_url, '/get_upload_params/')
        self.assertEqual(resolved_url.view_name, 's3upload')

    @override_settings(S3UPLOAD_DESTINATIONS={'foo': {}})
    def test_check_widget_html(self):
        widget = widgets.S3UploadWidget(dest='foo')
        self.assertEqual(widget.render('filename', None), HTML_OUTPUT)

    def test_check_signing_logged_in(self):
        self.client.login(username='admin', password='admin')
        data = {'dest': 'files', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 200)

    def test_check_signing_logged_out(self):
        data = {'dest': 'files', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 403)

    def test_check_allowed_type(self):
        data = {'dest': 'imgs', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 200)

    def test_check_disallowed_type(self):
        data = {'dest': 'imgs', 'name': 'image.mp4', 'type': 'video/mp4'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 400)

    def test_check_allowed_type_logged_in(self):
        self.client.login(username='admin', password='admin')
        data = {'dest': 'vids', 'name': 'video.mp4', 'type': 'video/mp4'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 200)

    def test_check_disallowed_type_logged_out(self):
        data = {u'dest': u'vids', u'name': u'video.mp4', u'type': u'video/mp4'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 403)

    def test_check_signing_fields(self):
        self.client.login(username='admin', password='admin')
        data = {u'dest': u'imgs', u'name': u'image.jpg',
                u'type': u'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]
        self.assertTrue(u'x-amz-signature' in aws_payload)
        self.assertTrue(u'x-amz-credential' in aws_payload)
        self.assertTrue(u'policy' in aws_payload)
        self.assertDictContainsSubset(FOO_RESPONSE, aws_payload)

    def test_check_signing_fields_unique_filename(self):
        data = {u'dest': u'misc', u'name': u'image.jpg',
                u'type': u'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]
        self.assertTrue(u'x-amz-signature' in aws_payload)
        self.assertTrue(u'x-amz-credential' in aws_payload)
        self.assertTrue(u'policy' in aws_payload)
        changed = FOO_RESPONSE.copy()
        changed['key'] = 'images/unique.jpg'
        self.assertDictContainsSubset(changed, aws_payload)

    def test_check_policy_conditions(self):
        self.client.login(username='admin', password='admin')
        data = {u'dest': u'cached', u'name': u'video.mp4',
                u'type': u'video/mp4'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 200)
        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]
        self.assertTrue('policy' in aws_payload)
        policy_dict = json.loads(b64decode(aws_payload['policy']).decode('utf-8'))
        self.assertTrue('conditions' in policy_dict)
        conditions_dict = policy_dict['conditions']
        self.assertEqual(conditions_dict[0]['bucket'], u'astoragebucketname')
        self.assertEqual(conditions_dict[1]['acl'], u'authenticated-read')
        self.assertEqual(conditions_dict[8]['Cache-Control'], u'max-age=2592000')
        self.assertEqual(conditions_dict[9]['Content-Disposition'], u'attachment')
        self.assertEqual(conditions_dict[10]['x-amz-server-side-encryption'], u'AES256')

    @override_settings(S3UPLOAD_DESTINATIONS={
        'misc': {
            'key': '/',
            'auth': lambda u: True,
            'acl': 'private',
            'bucket': 'test-bucket',
        }
    })
    def test_check_signed_url(self):
        data = {
            u'dest': u'misc',
            u'name': u'image.jpg',
            u'type': u'image/jpeg'
        }
        response = self.client.post(reverse('s3upload'), data)
        response_dict = json.loads(response.content.decode())
        private_access_url = response_dict["private_access_url"]

        self.assertTrue(
            "https://test-bucket.s3.amazonaws.com:443/image.jpg?Signature=" in private_access_url
        )

    def test_content_length_range(self):
        # Content_length_range setting is always sent as part of policy.
        # Initial request data doesn't affect it.
        data = {'dest': 'imgs', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 200)

        response_dict = json.loads(response.content.decode())
        aws_payload = response_dict["aws_payload"]

        self.assertTrue('policy' in aws_payload)
        policy_dict = json.loads(b64decode(aws_payload['policy']).decode('utf-8'))
        self.assertTrue('conditions' in policy_dict)
        conditions_dict = policy_dict['conditions']
        self.assertEqual(conditions_dict[-1], ['content-length-range', 5000, 20000000])


class UtilsTest(TestCase):
    def test_remove_signature(self):
        test_url = "https://test-bucket.s3.amazonaws.com/image.jpg"

        test_1 = remove_signature(test_url)
        self.assertEqual(test_1, test_url)

        test_2 = remove_signature("{0}?t=1&s=2".format(test_url))
        self.assertEqual(test_2, "{0}?t=1&s=2".format(test_url))

        test_3 = remove_signature("{0}?Signature=1&Expires=2&AWSAccessKeyId=3".format(test_url))
        self.assertEqual(test_3, test_url)

        test_4 = remove_signature("{0}?Signature=1&Expires=2&AWSAccessKeyId=3&t=1&s=2".format(test_url))  # noqa
        self.assertEqual(test_4, "{0}?t=1&s=2".format(test_url))
