from django import forms

from s3direct.widgets import S3DirectWidget


class S3DirectUploadForm(forms.Form):
    images = forms.URLField(widget=S3DirectWidget(dest='imgs'))