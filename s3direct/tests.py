import hashlib
import json
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.urls import resolve, reverse
from django.test import TestCase
from django.test.utils import override_settings

from s3direct import widgets


HTML_OUTPUT = (
    '<div class="s3direct" data-policy-url="/get_upload_params/" data-signing-url="/get_aws_v4_signature/">\n'
    '  <a class="file-link" target="_blank" href=""></a>\n'
    '  <a class="file-remove" href="#remove">Remove</a>\n'
    '  <input class="csrf-cookie-name" type="hidden" value="csrftoken">\n'
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

TEST_DESTINATIONS = {
    'misc': {'key': lambda original_filename: 'images/unique.jpg'},
    'files': {'key': '/', 'auth': lambda u: u.is_staff},
    'imgs': {'key': 'uploads/imgs', 'allowed': ['image/jpeg', 'image/png']},
    'thumbs': {'key': 'uploads/thumbs', 'allowed': ['image/jpeg'], 'content_length_range': (1000, 50000)},
    'vids': {'key': 'uploads/vids', 'auth': lambda u: u.is_authenticated, 'allowed': ['video/mp4']},
    'cached': {'key': 'uploads/vids', 'auth': lambda u: u.is_authenticated, 'allowed': '*',
               'acl': 'authenticated-read', 'bucket': 'astoragebucketname', 'cache_control': 'max-age=2592000',
               'content_disposition': 'attachment', 'server_side_encryption': 'AES256'},
    'accidental-leading-slash': {'key': '/directory/leading'},
    'accidental-trailing-slash': {'key': 'directory/trailing/'},
}


@override_settings(S3DIRECT_DESTINATIONS=TEST_DESTINATIONS)
class WidgetTestCase(TestCase):

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

    def test_default_upload_key(self):
        data = {'dest': 'files', 'name': 'image.jpg', 'type': 'image/jpeg', 'size': 1000}
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'], data['name'])

    def test_directory_object_key(self):
        data = {'dest': 'imgs', 'name': 'image.jpg', 'type': 'image/jpeg', 'size': 1000}
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'], 'uploads/imgs/%s' % data['name'])

    def test_directory_object_key_with_leading_slash(self):
        """Don't want <bucket>//directory/leading/filename.jpeg"""
        data = {'dest': 'accidental-leading-slash', 'name': 'filename.jpeg', 'type': 'image/jpeg', 'size': 1000}
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'], 'directory/leading/filename.jpeg')

    def test_directory_object_key_with_trailing_slash(self):
        """Don't want <bucket>/directory/trailing//filename.jpeg"""
        data = {'dest': 'accidental-trailing-slash', 'name': 'filename.jpeg', 'type': 'image/jpeg', 'size': 1000}
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'], 'directory/trailing/filename.jpeg')

    def test_function_object_key(self):
        data = {'dest': 'misc', 'name': 'image.jpg', 'type': 'image/jpeg', 'size': 1000}
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertNotEqual(policy_dict['object_key'], data['name'])

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


@override_settings(AWS_ACCESS_KEY_ID='abc', AWS_SECRET_ACCESS_KEY='123')
class SignatureViewTestCase(TestCase):
    EXAMPLE_SIGNING_DATE = datetime(2017, 4, 6, 8, 30)
    EXPECTED_SIGNATURE = b'76ea6730e10ddc9d392f40bf64872ddb1728cab58301dccb9efb67cb560a9272'

    def setUp(self):
        admin = User.objects.create_superuser('admin', 'u@email.com', 'admin')
        admin.save()

    def create_dummy_signing_request(self):
        signing_date = self.EXAMPLE_SIGNING_DATE
        canonical_request = '{request_method}\n/{bucket}/{object_key}\nhost={host}\nx-amz-date:{request_datetime}\n\nhost;x-amz-date\n{hashed_payload}'.format(
                request_method='GET',
                bucket='abucketname',
                object_key='an/object/key',
                host='s3.amazonaws.com',
                request_datetime=datetime.strftime(signing_date, '%Y%m%dT%H%M%SZ'),
                hashed_payload='blahblahblah',
        )
        credential_scope = '{request_date}/{region}/s3/aws4_request'.format(
                request_date=datetime.strftime(signing_date, '%Y%m%d'),
                region='eu-west-1',
        )
        hashed_canonical_request = hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
        string_to_sign = '{algorithm}\n{request_datetime}\n{credential_scope}\n{hashed_canonical_request}'.format(
                algorithm='AWS-HMAC-SHA256',
                request_datetime=datetime.strftime(signing_date, '%Y%m%dT%H%M%SZ'),
                credential_scope=credential_scope,
                hashed_canonical_request=hashed_canonical_request,
        )
        return string_to_sign, signing_date,

    def test_signing(self):
        """Check that the signature is as expected for a known signing request."""
        string_to_sign, signing_date = self.create_dummy_signing_request()
        self.client.login(username='admin', password='admin')
        response = self.client.post(
            reverse('s3direct-signing'),
            data={'to_sign': string_to_sign, 'datetime': datetime.strftime(signing_date, '%Y%m%dT%H%M%SZ')},
            enforce_csrf_checks=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, self.EXPECTED_SIGNATURE)
