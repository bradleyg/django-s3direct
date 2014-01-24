from django.test import TestCase
from django.conf import settings
from s3direct.views import create_upload_data
from django.contrib.admin.templatetags.admin_static import static

from mock import patch


class UuidMock(object):
    hex = 'test-unique'


class ViewsTestCase(TestCase):

    @patch('uuid.uuid4', return_value=UuidMock)
    def test_s3direct_view(self, mock_uuid):
        expected = {
            'form_action': 'https://test_bucket.s3.amazonaws.com',
            'AWSAccessKeyId': 'test_key',
            'key': 'test_upload/6d9be0ea65ea49348b397471bafcc989/${filename}',
            'signature': 'K8PxP7gPrVvA2rbMlpXukrbDakk=',
            'policy': ('eyJjb25kaXRpb25zIjogW3siYnVja2V0IjogInRlc3RfYnVja2V0'
                       'In0sIHsiYWNsIjogInB1YmxpYy1yZWFkIn0sIHsiQ29udGVudC1Ue'
                       'XBlIjogInRleHQvcGxhaW4ifSwgWyJzdGFydHMtd2l0aCIsICIka2'
                       'V5IiwgIiJdLCB7InN1Y2Nlc3NfYWN0aW9uX3N0YXR1cyI6ICIyMDE'
                       'ifV0sICJleHBpcmF0aW9uIjogIjIwMTMtMTItMDRUMTM6NDk6MTQu'
                       'MDAwWiJ9'),
            'success_action_status': '201',
            'Content-Type': 'text/plain',
            'acl': 'public-read'
        }

        data = create_upload_data('text/plain', 'filename', 'test_upload')

        self.assertItemsEqual(expected, data)