import hashlib
import json
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.utils import override_settings
try:
    from unittest import mock
except ImportError:
    import mock
try:
    from django.urls import resolve, reverse
except ImportError:
    from django.core.urlresolvers import resolve, reverse

from s3direct import widgets
from s3direct.utils import get_aws_credentials


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

def is_authenticated(user):
    if callable(user.is_authenticated): # Django =< 1.9
        return user.is_authenticated()
    return user.is_authenticated

TEST_DESTINATIONS = {
    'misc': {'key': lambda original_filename: 'images/unique.jpg'},
    'files': {'key': '/', 'auth': lambda u: u.is_staff},
    'imgs': {'key': 'uploads/imgs', 'allowed': ['image/jpeg', 'image/png']},
    'thumbs': {'key': 'uploads/thumbs', 'allowed': ['image/jpeg'], 'content_length_range': (1000, 50000)},
    'vids': {'key': 'uploads/vids', 'auth': is_authenticated, 'allowed': ['video/mp4']},
    'cached': {'key': 'uploads/vids', 'auth': is_authenticated, 'allowed': '*',
               'acl': 'authenticated-read', 'bucket': 'astoragebucketname', 'cache_control': 'max-age=2592000',
               'content_disposition': 'attachment', 'server_side_encryption': 'AES256'},
    'accidental-leading-slash': {'key': '/directory/leading'},
    'accidental-trailing-slash': {'key': 'directory/trailing/'},
    'key_args': {'key': lambda original_filename, args: args + '/' +'background.jpg', 'key_args': 'assets/backgrounds'},
}


@override_settings(S3DIRECT_DESTINATIONS=TEST_DESTINATIONS, AWS_ACCESS_KEY_ID='123', AWS_SECRET_ACCESS_KEY='123')
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

    def test_function_object_key_with_args(self):
        data = {'dest': 'key_args', 'name': 'background.jpg', 'type': 'image/jpeg', 'size': 1000}
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'], TEST_DESTINATIONS['key_args']['key_args'] + '/' + data['name'])

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


class AWSCredentialsTest(TestCase):
    @mock.patch('s3direct.utils.InstanceMetadataProvider')
    @mock.patch('s3direct.utils.InstanceMetadataFetcher')
    @override_settings(AWS_ACCESS_KEY_ID=None, AWS_SECRET_ACCESS_KEY=None)
    def test_retrieves_aws_credentials_from_botocore(self, fetcher_mock, provider_mock):
        credentials_mock = mock.Mock(
            token='token',
            secret_key='secret_key',
            access_key='access_key',
        )
        aws_response_mock = mock.Mock()
        aws_response_mock.load.return_value = credentials_mock
        fetcher_mock.return_value = 'metadata'
        provider_mock.return_value = aws_response_mock
        credentials = get_aws_credentials()
        provider_mock.assert_called_once_with(iam_role_fetcher='metadata')
        self.assertEqual(credentials.token, 'token')
        self.assertEqual(credentials.secret_key, 'secret_key')
        self.assertEqual(credentials.access_key, 'access_key')

    @override_settings(AWS_ACCESS_KEY_ID='local_access_key', AWS_SECRET_ACCESS_KEY='local_secret_key')
    def test_retrieves_aws_credentials_from_django_config(self):
        credentials = get_aws_credentials()
        self.assertIsNone(credentials.token)
        self.assertEqual(credentials.secret_key, 'local_secret_key')
        self.assertEqual(credentials.access_key, 'local_access_key')
