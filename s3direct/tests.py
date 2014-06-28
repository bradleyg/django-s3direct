from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
try:
    import json
except ImportError:
    import simplejson as json
from django.test import TestCase
from s3direct import widgets


HTML_OUTPUT = (
    '<div class="s3direct" data-url="/get_upload_params/foo">\n'
    '    <a class="link" target="_blank" href=""></a>\n'
    '    <a class="remove" href="javascript: void(0)">remove</a>\n'
    '    <input type="hidden" value="" id="" name="some_file" />\n'
    '    <input type="file" class="fileinput" accept="image/jpeg|video/*" />\n'
    '    <div class="progress progress-striped active">\n'
    '        <div class="progress-bar"></div>\n'
    '    </div>\n'
    '</div>'
)

FOO_RESPONSE = {
    u'AWSAccessKeyId': u'',
    u'form_action': u'https://test-storage.s3.amazonaws.com/',
    u'success_action_status': u'201',
    u'acl': u'public-read',
    u'key': u'${filename}',
    u'Content-Type': u'image/jpeg'
}


class WidgetTest(TestCase):

    def setUp(self):
        admin = User.objects.create_superuser('admin', 'admin@email.com', 'admin')
        admin.save()

        user = User.objects.create_user('user', 'user@email.com', 'user')
        user.save()

    def test_widget_html(self):
        """
        Widget renders to proper html code
        """
        widget = widgets.S3DirectFileWidget(upload_to='foo')
        self.assertEqual(widget.render('some_file', None), HTML_OUTPUT)

    def test_signing(self):
        """
        get_upload_params view creates returns a signature and upload params
        """
        response = self.client.post(reverse('s3direct', kwargs={'upload_to': 'foo'}),
                                    {'type': 'image/jpeg', 'name': 'image.jpg'})
        response_dict = json.loads(response.content)
        self.assertTrue(u'signature' in response_dict)
        self.assertTrue(u'policy' in response_dict)
        self.assertDictContainsSubset(FOO_RESPONSE, response_dict)

    def test_signing_invalid_user(self):
        """
        Not authenticated users get a 403 forbidden response.
        """
        response = self.client.post(reverse('s3direct', kwargs={'upload_to': 'bar'}),
                                    {'type': 'image/jpeg', 'name': 'image.jpg'})
        self.assertEqual(response.status_code, 403)

    def test_signing_admin_user(self):
        """
        Tests signing response for super user.
        """
        self.client.login(username='admin', password='admin')
        response = self.client.post(reverse('s3direct', kwargs={'upload_to': 'baz'}),
                                    {'type': 'image/jpeg', 'name': 'image.jpg'})
        self.assertEqual(response.status_code, 200)

    def test_signing_user(self):
        """
        Tests signing response for  user.
        """
        self.client.login(username='user', password='user')
        response = self.client.post(reverse('s3direct', kwargs={'upload_to': 'baz'}),
                                    {'type': 'image/jpeg', 'name': 'image.jpg'})
        self.assertEqual(response.status_code, 200)

    def test_signing_user_permission_denied(self):
        """
        Tests signing response for  user that doesn't have permission.
        """
        self.client.login(username='user', password='user')
        response = self.client.post(reverse('s3direct', kwargs={'upload_to': 'bar'}),
                                    {'type': 'image/jpeg', 'name': 'image.jpg'})
        self.assertEqual(response.status_code, 403)

    def test_mime_type_not_allowed(self):
        """
        Tests signing response for  user that doesn't have permission.
        """
        self.client.login(username='user', password='user')
        response = self.client.post(reverse('s3direct', kwargs={'upload_to': 'foo'}),
                                    {'type': 'image/png', 'name': 'image.png'})
        self.assertEqual(response.status_code, 403)