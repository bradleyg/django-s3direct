from django.test import TestCase
from django.conf import settings
from s3direct.widgets import S3DirectEditor
from django.contrib.admin.templatetags.admin_static import static


class WidgetsTestCase(TestCase):

    def test_s3direct_widget(self):
        HTML = (
            '<div class="s3direct" data-url="/get_upload_params/tests">'
            '    <a class="link" target="_blank" href="test_value">test_value</a>'
            '    <a class="remove" href="#remove">Remove</a>'
            '    <input type="hidden" value="test_value" id="None" name="test_name" />'
            '    <input type="file" class="fileinput" />'
            '    <div class="progress progress-striped active">'
            '        <div class="bar"></div>'
            '    </div>'
            '</div>'
        )

        editor = S3DirectEditor(upload_to='tests')
        rendered = editor.render('test_name', 'test_value')
        self.assertHTMLEqual(rendered, HTML)

    def test_s3direct_widget_no_upload_to_declared(self):
        HTML = (
            '<div class="s3direct" data-url="/get_upload_params/">'
            '    <a class="link" target="_blank" href="test_value">test_value</a>'
            '    <a class="remove" href="#remove">Remove</a>'
            '    <input type="hidden" value="test_value" id="None" name="test_name" />'
            '    <input type="file" class="fileinput" />'
            '    <div class="progress progress-striped active">'
            '        <div class="bar"></div>'
            '    </div>'
            '</div>'
        )

        editor = S3DirectEditor()
        rendered = editor.render('test_name', 'test_value')
        self.assertHTMLEqual(rendered, HTML)