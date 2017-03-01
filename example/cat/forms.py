from django import forms

from s3direct.widgets import S3DirectWidget


class S3DirectUploadForm(forms.Form):
    misc = forms.URLField(widget=S3DirectWidget(dest='misc'))
