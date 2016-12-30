import json
from base64 import b64decode

from django.test.utils import override_settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse, resolve
from django.test import TestCase

from s3direct import widgets


HTML_OUTPUT = (
    '<div class="s3direct" data-policy-url="/get_upload_params/">\n'
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

FOO_RESPONSE = {
    u'x-amz-algorithm': u'AWS4-HMAC-SHA256',
    u'form_action': u'https://s3.amazonaws.com/test-bucket',
    u'success_action_status': 201,
    u'acl': u'public-read',
    u'key': u'uploads/imgs/${filename}',
    u'content-type': u'image/jpeg'
}


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

    def check_urls(self):
        reversed_url = reverse('s3direct')
        resolved_url = resolve('/get_upload_params/')
        self.assertEqual(reversed_url, '/get_upload_params/')
        self.assertEqual(resolved_url.view_name, 's3direct')

    def check_widget_html(self):
        widget = widgets.S3DirectWidget(dest='foo')
        self.assertEqual(widget.render('filename', None), HTML_OUTPUT)

    def check_signing_logged_in(self):
        self.client.login(username='admin', password='admin')
        data = {'dest': 'files', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def check_signing_logged_out(self):
        data = {'dest': 'files', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 403)

    def check_allowed_type(self):
        data = {'dest': 'imgs', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def check_disallowed_type(self):
        data = {'dest': 'imgs', 'name': 'image.mp4', 'type': 'video/mp4'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 400)

    def check_allowed_type_logged_in(self):
        self.client.login(username='admin', password='admin')
        data = {'dest': 'vids', 'name': 'video.mp4', 'type': 'video/mp4'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

    def check_disallowed_type_logged_out(self):
        data = {u'dest': u'vids', u'name': u'video.mp4', u'type': u'video/mp4'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 403)

    def check_signing_fields(self):
        self.client.login(username='admin', password='admin')
        data = {u'dest': u'imgs', u'name': u'image.jpg',
                u'type': u'image/jpeg'}
        response = self.client.post(reverse('s3direct'), data)
        response_dict = json.loads(response.content.decode())
        self.assertTrue(u'x-amz-signature' in response_dict)
        self.assertTrue(u'x-amz-credential' in response_dict)
        self.assertTrue(u'policy' in response_dict)
        self.assertDictContainsSubset(FOO_RESPONSE, response_dict)

    def check_signing_fields_unique_filename(self):
        data = {u'dest': u'misc', u'name': u'image.jpg',
                u'type': u'image/jpeg'}
        response = self.client.post(reverse('s3direct'), data)
        response_dict = json.loads(response.content.decode())
        self.assertTrue(u'x-amz-credential' in response_dict)
        self.assertTrue(u'x-amz-credential' in response_dict)
        self.assertTrue(u'policy' in response_dict)
        changed = FOO_RESPONSE.copy()
        changed['key'] = 'images/unique.jpg'
        self.assertDictContainsSubset(changed, response_dict)

    def check_policy_conditions(self):
        self.client.login(username='admin', password='admin')
        data = {u'dest': u'cached', u'name': u'video.mp4',
                u'type': u'video/mp4'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)
        response_dict = json.loads(response.content.decode())
        self.assertTrue('policy' in response_dict)
        policy_dict = json.loads(
                b64decode(response_dict['policy']).decode('utf-8'))
        self.assertTrue('conditions' in policy_dict)
        conditions_dict = policy_dict['conditions']
        self.assertEqual(
                conditions_dict[0]['bucket'], u'astoragebucketname')
        self.assertEqual(
                conditions_dict[1]['acl'], u'authenticated-read')
        self.assertEqual(
                conditions_dict[8]['Cache-Control'], u'max-age=2592000')
        self.assertEqual(
                conditions_dict[9]['Content-Disposition'], u'attachment')
        self.assertEqual(
                conditions_dict[10]['x-amz-server-side-encryption'], u'AES256')


@override_settings(S3DIRECT_DESTINATIONS={
    'misc': (lambda original_filename: 'images/unique.jpg',),
    'files': ('uploads/files', lambda u: u.is_staff,),
    'imgs': ('uploads/imgs', lambda u: True, ['image/jpeg', 'image/png'],),
    'vids': ('uploads/vids', lambda u: u.is_authenticated(), ['video/mp4'],),
    'cached': ('uploads/vids', lambda u: u.is_authenticated(), '*',
               'authenticated-read', 'astoragebucketname', 'max-age=2592000',
               'attachment', 'AES256'),
})
class OldStyleSettingsWidgetTest(WidgetTestCase):
    """
    Test coverage for the older "positional" style of specifying settings.
    TODO: Remove me when positional settings are no longer supported.
    """

    def setUp(self):
        super(OldStyleSettingsWidgetTest, self).setUp()

    def test_urls(self):
        self.check_urls()

    def test_widget_html(self):
        self.check_widget_html()

    def test_signing_logged_in(self):
        self.check_signing_logged_in()

    def test_signing_logged_out(self):
        self.check_signing_logged_out()

    def test_allowed_type(self):
        self.check_allowed_type()

    def test_disallowed_type(self):
        self.check_disallowed_type()

    def test_allowed_type_logged_in(self):
        self.check_allowed_type_logged_in()

    def test_disallowed_type_logged_out(self):
        self.check_disallowed_type_logged_out()

    def test_signing_fields(self):
        self.check_signing_fields()

    def test_signing_fields_unique_filename(self):
        self.check_signing_fields_unique_filename()

    def test_policy_conditions(self):
        self.check_policy_conditions()


class WidgetTest(WidgetTestCase):

    def setUp(self):
        super(WidgetTest, self).setUp()

    def test_urls(self):
        self.check_urls()

    def test_widget_html(self):
        self.check_widget_html()

    def test_signing_logged_in(self):
        self.check_signing_logged_in()

    def test_signing_logged_out(self):
        self.check_signing_logged_out()

    def test_allowed_type(self):
        self.check_allowed_type()

    def test_disallowed_type(self):
        self.check_disallowed_type()

    def test_allowed_type_logged_in(self):
        self.check_allowed_type_logged_in()

    def test_disallowed_type_logged_out(self):
        self.check_disallowed_type_logged_out()

    def test_signing_fields(self):
        self.check_signing_fields()

    def test_signing_fields_unique_filename(self):
        self.check_signing_fields_unique_filename()

    def test_policy_conditions(self):
        self.check_policy_conditions()

    """Tests for features only available with new-style settings"""
    def test_content_length_range(self):
        # Content_length_range setting is always sent as part of policy.
        # Initial request data doesn't affect it.
        data = {'dest': 'imgs', 'name': 'image.jpg', 'type': 'image/jpeg'}
        response = self.client.post(reverse('s3direct'), data)
        self.assertEqual(response.status_code, 200)

        response_dict = json.loads(response.content.decode())
        self.assertTrue('policy' in response_dict)
        policy_dict = json.loads(
                b64decode(response_dict['policy']).decode('utf-8'))
        self.assertTrue('conditions' in policy_dict)
        conditions_dict = policy_dict['conditions']
        self.assertEqual(
                conditions_dict[-1], ['content-length-range', 5000, 20000000])
