from django.core.urlresolvers import reverse
from django.test import TestCase
from s3direct import widgets


class WidgetTest(TestCase):

    def test_creation(self):
        widget = widgets.S3DirectWidget()
        print(widget.render('some_file', None))

    def test_view(self):
        response = self.client.post(reverse('s3direct', kwargs={'upload_to': ''}),
                                    {'type': 'image/jpeg', 'name': 'image.jpg'})
        print(response)