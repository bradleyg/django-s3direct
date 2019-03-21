import hashlib
import json
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.test.utils import override_settings
from django.utils.html import escape

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
        expected = (
            '<div class="s3direct" data-policy-url="/get_upload_params/" '
            'data-signing-url="/get_aws_v4_signature/">\n'
            '  <a class="file-link" target="_blank" href=""></a>\n'
            '  <a class="file-remove" href="#remove">Remove</a>\n'
            '  <input class="csrf-cookie-name" type="hidden" value="csrftoken">\n'
            '  <input class="file-url" type="hidden" value="" id="" name="filename" />'
            '\n'
            '  <input class="file-dest" type="hidden" value="foo">\n'
            '  <input class="file-key_args" type="hidden" value="">\n'
            '  <input class="file-input" type="file"  style=""/>\n'
            '  <div class="progress progress-striped active">\n'
            '    <div class="bar"></div>\n'
            '  </div>\n'
            '</div>\n')

        widget = widgets.S3DirectWidget(dest='foo')
        self.assertEqual(widget.render('filename', None), expected)

    def test_widget_html_dynamic_key_args(self):
        expected = (
            '<div class="s3direct" data-policy-url="/get_upload_params/" '
            'data-signing-url="/get_aws_v4_signature/">\n'
            '  <a class="file-link" target="_blank" href=""></a>\n'
            '  <a class="file-remove" href="#remove">Remove</a>\n'
            '  <input class="csrf-cookie-name" type="hidden" value="csrftoken">\n'
            '  <input class="file-url" type="hidden" value="" id="" name="filename" />'
            '\n'
            '  <input class="file-dest" type="hidden" value="foo">\n'
            '  <input class="file-key_args" type="hidden" value="'+escape('{"arg": 2}')+'">\n'
            '  <input class="file-input" type="file"  style=""/>\n'
            '  <div class="progress progress-striped active">\n'
            '    <div class="bar"></div>\n'
            '  </div>\n'
            '</div>\n')

        widget = widgets.S3DirectWidget(dest='foo',key_args={"arg": 2})
        self.assertEqual(widget.render('filename', None), expected)

    def test_missing_dest(self):
        data = {'name': 'image.jpg', 'type': 'image/jpeg', 'size': 1000}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 404)

    def test_incorrectly_named_dest(self):
        data = {
            'dest': 'non-existent',
            'name': 'image.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 404)

    def test_missing_key(self):
        data = {
            'dest': 'missing-key',
            'name': 'image.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 500)

    def test_get_upload_parameters_logged_in(self):
        self.client.login(username='admin', password='admin')
        data = {
            'dest': 'login-required',
            'name': 'image.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def test_get_upload_parameters_logged_out(self):
        data = {
            'dest': 'login-required',
            'name': 'image.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 403)

    def test_allowed_type(self):
        data = {
            'dest': 'only-images',
            'name': 'image.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def test_disallowed_type(self):
        data = {
            'dest': 'only-images',
            'name': 'filename.mp4',
            'type': 'video/mp4',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 400)

    def test_allowed_size(self):
        data = {
            'dest': 'limited-size',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 20000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def test_disallowed_size(self):
        data = {
            'dest': 'limited-size',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 200000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 400)

    def test_root_object_key(self):
        data = {
            'dest': 'generic',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'], data['name'])

    def test_directory_object_key(self):
        data = {
            'dest': 'folder-upload',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'],
                         'uploads/folder/%s' % data['name'])

    def test_directory_object_key_with_leading_slash(self):
        data = {
            'dest': 'accidental-leading-slash',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'],
                         'uploads/folder/filename.jpg')

    def test_directory_object_key_with_trailing_slash(self):
        data = {
            'dest': 'accidental-trailing-slash',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['object_key'],
                         'uploads/folder/filename.jpg')

    def test_function_object_key(self):
        data = {
            'dest': 'function-object-key',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertNotEqual(policy_dict['object_key'], data['name'])

    def test_function_object_key_with_args(self):
        data = {
            'dest': 'function-object-key-args',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(
            policy_dict['object_key'],
            settings.S3DIRECT_DESTINATIONS['function-object-key-args']
            ['key_args'] + '/' + data['name'])

    def test_function_object_key_with_dynamic_args(self):
        data = {
            'dest': 'function-object-dynamic-key-args',
            'keyArgs': '"uploads/folder"', # This is a json serialized string
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(
            policy_dict['object_key'],
            'uploads/folder' + '/' + data['name'])

    def test_policy_conditions(self):
        self.client.login(username='admin', password='admin')
        data = {
            'dest': 'policy-conditions',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['bucket'], u'astoragebucketname')
        self.assertEqual(policy_dict['acl'], u'authenticated-read')
        self.assertEqual(policy_dict['cache_control'], u'max-age=2592000')
        self.assertEqual(policy_dict['content_disposition'], u'attachment')
        self.assertEqual(policy_dict['server_side_encryption'], u'AES256')

    def test_custom_existence_optimisation_true(self):
        data = {
            'dest': 'allow-existence-optimisation',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['allow_existence_optimization'], True)

    def test_custom_existence_optimisation_false(self):
        data = {
            'dest': 'disallow-existence-optimisation',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['allow_existence_optimization'], False)

    def test_custom_existence_optimisation_unset(self):
        data = {
            'dest': 'unset-existence-optimisation',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['allow_existence_optimization'], False)

    def test_custom_region_bucket(self):
        data = {
            'dest': 'custom-region-bucket',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['endpoint'],
                         'https://s3.cn-north-1.amazonaws.com.cn')

    def test_optional_param_content_disposition_callable(self):
        data = {
            'dest': 'optional-content-disposition-callable',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000,
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['content_disposition'],
                         'attachment; filename="filename.jpg"')

    def test_optional_param_cache_control_non_callable(self):
        data = {
            'dest': 'optional-cache-control-non-callable',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000,
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        policy_dict = json.loads(response.content.decode())
        self.assertEqual(policy_dict['cache_control'], 'public')


@override_settings(AWS_STORAGE_BUCKET_NAME=None)
class WidgetTestCaseOverideBucket(TestCase):
    def test_missing_bucket(self):
        data = {
            'dest': 'generic',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 500)


@override_settings(AWS_S3_REGION_NAME=None)
class WidgetTestCaseOverideRegion(TestCase):
    def test_missing_region(self):
        data = {
            'dest': 'generic',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 500)


@override_settings(AWS_S3_ENDPOINT_URL=None)
class WidgetTestCaseOverideEndpoint(TestCase):
    def test_missing_endpoint(self):
        data = {
            'dest': 'generic',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 500)


@override_settings(AWS_ACCESS_KEY_ID=None)
class WidgetTestCaseOverideAccessKey(TestCase):
    def test_missing_access_key(self):
        data = {
            'dest': 'generic',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 500)


@override_settings(AWS_SECRET_ACCESS_KEY=None)
class WidgetTestCaseOverideSecretAccessKey(TestCase):
    def test_missing_secret_key(self):
        data = {
            'dest': 'generic',
            'name': 'filename.jpg',
            'type': 'image/jpeg',
            'size': 1000
        }
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 500)


class SignatureViewTestCase(TestCase):
    EXAMPLE_SIGNING_DATE = datetime(2017, 4, 6, 8, 30)
    EXPECTED_SIGNATURE = '76ea6730e10ddc9d392f40bf64872ddb1728cab58301dccb9efb67cb560a9272'

    def setUp(self):
        admin = User.objects.create_superuser('admin', 'u@email.com', 'admin')
        admin.save()

    def create_dummy_signing_request(self):
        signing_date = self.EXAMPLE_SIGNING_DATE
        canonical_request = (
            '{request_method}\n/{bucket}/{object_key}\nhost={host}\nx-amz-'
            'date:{request_datetime}\n\nhost;x-amz-date\n{hashed_payload}'
        ).format(
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
        hashed_canonical_request = hashlib.sha256(
            canonical_request.encode('utf-8')).hexdigest()
        string_to_sign = (
            '{algorithm}\n{request_datetime}\n{credential_scope}'
            '\n{hashed_canonical_request}').format(
                algorithm='AWS-HMAC-SHA256',
                request_datetime=datetime.strftime(signing_date,
                                                   '%Y%m%dT%H%M%SZ'),
                credential_scope=credential_scope,
                hashed_canonical_request=hashed_canonical_request,
            )
        return string_to_sign, signing_date,

    def test_signing(self):
        """Check that the signature is as expected for a known signing request."""
        string_to_sign, signing_date = self.create_dummy_signing_request()
        response = self.client.post(
            reverse('s3direct-signing'),
            data={
                'to_sign': string_to_sign,
                'datetime': datetime.strftime(signing_date, '%Y%m%dT%H%M%SZ'),
                'dest': 'login-not-required'
            },
            enforce_csrf_checks=True,
        )
        expected = '{"s3ObjKey": "%s"}' % self.EXPECTED_SIGNATURE
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, expected.encode('utf-8'))

    def test_signing_with_protected(self):
        """Check login accepted to generate signature."""
        string_to_sign, signing_date = self.create_dummy_signing_request()
        self.client.login(username='admin', password='admin')
        response = self.client.post(
            reverse('s3direct-signing'),
            data={
                'to_sign': string_to_sign,
                'datetime': datetime.strftime(signing_date, '%Y%m%dT%H%M%SZ'),
                'dest': 'login-required'
            },
            enforce_csrf_checks=True,
        )
        expected = '{"s3ObjKey": "%s"}' % self.EXPECTED_SIGNATURE
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, expected.encode('utf-8'))

    def test_signing_with_protected_without_valid_auth(self):
        """Check denied if not logged in to generate signature."""
        string_to_sign, signing_date = self.create_dummy_signing_request()
        response = self.client.post(
            reverse('s3direct-signing'),
            data={
                'to_sign': string_to_sign,
                'datetime': datetime.strftime(signing_date, '%Y%m%dT%H%M%SZ'),
                'dest': 'login-required'
            },
            enforce_csrf_checks=True,
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.content, b'{"error": "Permission denied."}')


class AWSCredentialsTest(TestCase):
    @mock.patch('s3direct.utils.InstanceMetadataProvider')
    @mock.patch('s3direct.utils.InstanceMetadataFetcher')
    @override_settings(AWS_ACCESS_KEY_ID=None, AWS_SECRET_ACCESS_KEY=None)
    def test_retrieves_aws_credentials_from_botocore(self, fetcher_mock,
                                                     provider_mock):
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

    @override_settings(
        AWS_ACCESS_KEY_ID='local_access_key',
        AWS_SECRET_ACCESS_KEY='local_secret_key')
    def test_retrieves_aws_credentials_from_django_config(self):
        credentials = get_aws_credentials()
        self.assertIsNone(credentials.token)
        self.assertEqual(credentials.secret_key, 'local_secret_key')
        self.assertEqual(credentials.access_key, 'local_access_key')
