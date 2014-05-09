from django.test import TestCase
from s3direct import widgets


class WidgetTest(TestCase):

    def test_creation(self):
        widget = widgets.S3DirectWidget()
        print(widget.render('some_file', None))