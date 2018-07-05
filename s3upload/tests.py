import json
from base64 import b64decode
from urllib.parse import urlparse, parse_qs

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse, resolve

from . import widgets
from .utils import get_s3_path_from_url

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
    u'key': u'uploads/imgs/image.jpg',
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

    def test_check_disallowed_extensions(self):
        data = {'dest': 'imgs', 'name': 'image.jfif', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 415)

    def test_check_allowed_extensions(self):
        data = {'dest': 'imgs', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 200)

    def test_check_disallowed_extensions__uppercase(self):
        data = {'dest': 'imgs', 'name': 'image.JFIF', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 415)

    def test_check_allowed_extensions__uppercase(self):
        data = {'dest': 'imgs', 'name': 'image.JPG', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3upload'), data)
        self.assertEqual(response.status_code, 200)

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
        parsed_url = urlparse(response_dict["private_access_url"])
        parsed_qs = parse_qs(parsed_url.query)
        self.assertEqual(parsed_url.scheme, 'https')
        self.assertEqual(parsed_url.netloc, 'test-bucket.s3.amazonaws.com')
        self.assertTrue('Signature' in parsed_qs)
        self.assertTrue('Expires' in parsed_qs)

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
    def test_get_s3_path_from_url(self):
        path = 'folder1/folder2/file1.json'
        test_s3_url_1 = 's3://{0}/folder1/folder2/file1.json'.format(settings.AWS_STORAGE_BUCKET_NAME)
        test_s3_url_2 = 'https://{0}.s3-aws-region.amazonaws.com/folder1/folder2/file1.json?test=1&test1=2'.format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_3 = 'https://{0}.s3.amazonaws.com:443/folder1/folder2/file1.json'.format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_4 = 'https://s3-aws-region.amazonaws.com/{0}/folder1/folder2/file1.json'.format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_5 = 'https://s3-aws-region.amazonaws.com:443/{0}/folder1/folder2/file1.json'.format(
            settings.AWS_STORAGE_BUCKET_NAME
        )
        test_s3_url_6 = 'https%3a%2f%2fs3-aws-region.amazonaws.com%3a443%2f{0}%2ffolder1%2ffolder2%2ffile1.json'.format(
            settings.AWS_STORAGE_BUCKET_NAME
        )

        test_1 = get_s3_path_from_url(test_s3_url_1)
        self.assertEqual(test_1, path)

        test_2 = get_s3_path_from_url(test_s3_url_2)
        self.assertEqual(test_2, path)

        test_3 = get_s3_path_from_url(test_s3_url_3)
        self.assertEqual(test_3, path)

        test_4 = get_s3_path_from_url(test_s3_url_4)
        self.assertEqual(test_4, path)

        test_5 = get_s3_path_from_url(test_s3_url_5)
        self.assertEqual(test_5, path)

        test_6 = get_s3_path_from_url(test_s3_url_6)
        self.assertEqual(test_6, path)
